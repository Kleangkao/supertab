"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { PaymentRehearsal } from "@/components/payment-rehearsal";
import { AssetConversion } from "@/components/asset-conversion";
import { DigitalPurchase } from "@/components/digital-purchase";
import { PrototypePaths } from "@/components/prototype-paths";
import { CheckoutReview } from "@/components/checkout-review";
import { connectStandardWallet, discoverStandardWallets, signDevnetCheck, signMainnetTransaction, signWalletMessage, supportsDevnetSigning, supportsWalletMessage, watchStandardWallet, type StandardWallet, type StandardWalletAccount } from "@/lib/wallet-standard";
import type { WalletChallenge } from "@/lib/wallet-proof";
import type { DevnetSigningCheck } from "@/lib/devnet-memo";
import { clearWalletReview } from "@/lib/wallet-review";
import {
  classifyWalletFailure,
  clearShoppingSessionId,
  isAndroidShell,
  readShoppingSessionId,
  walletFailureMessage,
  writeShoppingSessionId,
} from "@/lib/android-shell";
import { ensureAndroidWallet } from "@/lib/mobile-wallet";
import { SHOPPING_MESSAGE_LIMIT } from "@/lib/constraints";
import type { HealthView, OfferView, PurchaseView, SessionView } from "@/lib/view";
import { emptyStateActions, EvidenceList, MerchantHandoffLinks, RequirementControls, saveOffer, ShortlistPanel } from "@/components/shopping-decisions";

// An explicit convenience for this demo session, never an application wallet default.
const DEMO_ADDRESS = "JCVsKd4TMg1fvEs7rjf5YgLYbJfNC8Dwb4x1PchFkGM7";
type WalletMode = PurchaseView["walletMode"];
const currentTime = () => Date.now();

function subscribeNothing() { return () => {}; }
function androidShellSnapshot() { return isAndroidShell(navigator.userAgent); }
function androidShellServer() { return false; }
function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}
function onlineSnapshot() { return navigator.onLine; }
function onlineServer() { return true; }

export function ShopApp() {
  const [health, setHealth] = useState<HealthView | null>(null);
  const [session, setSession] = useState<SessionView | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [walletMode, setWalletMode] = useState<WalletMode>("none");
  const [address, setAddress] = useState("");
  const [walletChains, setWalletChains] = useState<readonly string[]>([]);
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [fundingMint, setFundingMint] = useState<string | null>(null);
  const [walletChoices, setWalletChoices] = useState<StandardWallet[]>([]);
  const [walletChallenge, setWalletChallenge] = useState<WalletChallenge | null>(null);
  const [canSignMessage, setCanSignMessage] = useState(false);
  const [devnetCheck, setDevnetCheck] = useState<DevnetSigningCheck | null>(null);
  const [canSignDevnet, setCanSignDevnet] = useState(false);
  const [walletSigned, setWalletSigned] = useState(false);
  const [now, setNow] = useState(0);
  const androidShell = useSyncExternalStore(subscribeNothing, androidShellSnapshot, androidShellServer);
  const offline = !useSyncExternalStore(subscribeOnline, onlineSnapshot, onlineServer);
  const lock = useRef(false);
  const walletEpoch = useRef(0);
  const walletOff = useRef<(() => void) | null>(null);
  const activeWallet = useRef<StandardWallet | null>(null);
  const activeAccount = useRef<StandardWalletAccount | null>(null);
  const walletDesk = useRef<{ sessionId: string; termsId: string; address: string } | null>(null);
  const latestSession = useRef<SessionView | null>(null);
  const pendingWalletReset = useRef<{ sessionId: string; offerId: string; quantity: number } | null>(null);
  const pendingShopTurnId = useRef<string | null>(null);
  const pendingShopTurnText = useRef<string | null>(null);
  const reviewRef = useRef<HTMLElement>(null);
  const selectedOfferId = session?.selectedOfferId;
  useEffect(() => {
    if (selectedOfferId) reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedOfferId]);

  useEffect(() => {
    void ensureAndroidWallet().finally(() => discoverStandardWallets(window));
    const controller = new AbortController();
    void fetch("/api/health", { signal: controller.signal }).then(async response => {
      if (response.ok) setHealth(await response.json() as HealthView);
    }).catch(() => undefined);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    let saved: string | null = null;
    try { saved = readShoppingSessionId(sessionStorage, localStorage); } catch { /* Storage is optional. */ }
    if (saved) {
      lock.current = true;
      queueMicrotask(() => { if (!controller.signal.aborted) setBusy("Restoring your shopping session…"); });
      void fetch(`/api/shop?sessionId=${encodeURIComponent(saved)}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
        if (response.status === 503) throw new Error("Shopping session storage is temporarily unavailable. Your shortlist is still here; try restoring again in a moment.");
        if (!response.ok) throw new Error("Your previous search expired. Let’s find something new.");
        const restored = await response.json() as SessionView;
        if (restored.purchase?.walletMode === "connected") {
          restored.purchase = { ...restored.purchase, walletMode: "address", walletKind: "read_only", signatureCapability: "disabled", walletControl: null, devnetSigning: null };
        }
        latestSession.current = restored;
        setSession(restored);
        setWalletMode(restored.purchase?.walletMode === "connected" ? "address" : restored.purchase?.walletMode ?? "none");
        setAddress(restored.purchase?.walletAddress ?? "");
        setFundingMint(restored.purchase?.funding?.candidateMint ?? null);
        setNow(Date.now());
      }).catch(caught => {
        if (controller.signal.aborted) return;
        const message = caught instanceof Error ? caught.message : "Could not restore your search.";
        if (message.includes("expired")) {
          try { clearShoppingSessionId(sessionStorage, localStorage); } catch { /* Storage is optional. */ }
        }
        setError(message);
      }).finally(() => { if (!controller.signal.aborted) { lock.current = false; setBusy(null); } });
    }
    return () => { controller.abort(); window.clearInterval(timer); walletOff.current?.(); };
  }, []);

  useEffect(() => {
    function onUnavailable() {
      lock.current = false;
      setBusy(null);
      setError(walletFailureMessage("unavailable"));
    }
    function onViewport() {
      const viewport = window.visualViewport;
      const overlap = viewport ? Math.max(0, window.innerHeight - viewport.height) : 0;
      document.documentElement.style.setProperty("--keyboard-overlap", `${overlap}px`);
    }
    window.addEventListener("supertab-wallet-unavailable", onUnavailable);
    window.visualViewport?.addEventListener("resize", onViewport);
    onViewport();
    return () => {
      window.removeEventListener("supertab-wallet-unavailable", onUnavailable);
      window.visualViewport?.removeEventListener("resize", onViewport);
    };
  }, []);

  async function request(path: string, payload: object, loading: string) {
    if (lock.current) return;
    const epoch = walletEpoch.current;
    lock.current = true; setBusy(loading); setError(null);
    try {
      const shopMessage = path === "/api/shop" && payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message.trim()
        : "";
      if (path === "/api/shop" && pendingShopTurnText.current !== shopMessage) {
        pendingShopTurnId.current = null;
        pendingShopTurnText.current = shopMessage;
      }
      const turnId = path === "/api/shop"
        ? (pendingShopTurnId.current ?? crypto.randomUUID())
        : null;
      if (path === "/api/shop" && turnId) pendingShopTurnId.current = turnId;
      const bodyPayload = path === "/api/shop" ? { ...payload, turnId } : payload;
      const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(bodyPayload), signal: AbortSignal.timeout(90_000) });
      const body = await response.json() as SessionView & { error?: string; session?: SessionView };
      if (!response.ok) {
        if (body.session && epoch === walletEpoch.current) {
          latestSession.current = body.session; setSession(body.session); setNow(currentTime());
        }
        if (response.status === 409) {
          pendingShopTurnId.current = null;
          pendingShopTurnText.current = null;
          throw new Error(body.error ?? "This search was updated somewhere else. Refresh before trying again.");
        }
        throw new Error(body.error ?? "Please try again.");
      }
      if (epoch !== walletEpoch.current) return;
      if (path === "/api/shop") {
        pendingShopTurnId.current = null;
        pendingShopTurnText.current = null;
      }
      latestSession.current = body;
      setSession(body); setNow(currentTime());
      try { writeShoppingSessionId(sessionStorage, localStorage, body.sessionId); } catch { /* Storage is optional. */ }
      return body;
    } catch (caught) {
      if (epoch !== walletEpoch.current) return;
      setError(caught instanceof Error && caught.name !== "TimeoutError" ? caught.message : "This is taking too long. Your selection is still here; please try again.");
    } finally { lock.current = false; setBusy(null); flushWalletReset(); }
  }

  function flushWalletReset() {
    if (lock.current || !pendingWalletReset.current) return;
    const reset = pendingWalletReset.current;
    pendingWalletReset.current = null;
    void request("/api/purchase", { ...reset, walletMode: "none" }, "Clearing the previous wallet’s funding plan…");
  }

  function invalidateWallet() {
    walletOff.current?.(); walletOff.current = null;
    activeWallet.current = null; activeAccount.current = null; setWalletChallenge(null); setCanSignMessage(false); setDevnetCheck(null); setCanSignDevnet(false); setWalletSigned(false); walletDesk.current = null;
    walletEpoch.current++;
    setWalletMode("none"); setAddress(""); setWalletChains([]); setFundingMint(null);
    const current = latestSession.current;
    if (current) {
      latestSession.current = clearWalletReview(current);
      setSession(latestSession.current);
      if (current.selectedOfferId) pendingWalletReset.current = { sessionId: current.sessionId, offerId: current.selectedOfferId, quantity: current.purchase?.checkout.quantity ?? 1 };
    }
    setError("Your wallet accounts or network changed. Reconnect to review a fresh funding plan. Your search is still here.");
    flushWalletReset();
  }

  async function submitShopping(message: string, clearDraft: boolean) {
    const body = await request("/api/shop", { sessionId: session?.sessionId, message }, "Finding real products for you…");
    if (body && clearDraft) { setDraft(""); setFundingMint(null); }
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    await submitShopping(draft, true);
  }

  async function selectOffer(offerId: string, mode = walletMode, nextAddress = address, mint = fundingMint, signatureAvailable?: boolean, quantity?: number) {
    if (!session) return;
    setWalletChallenge(null);
    setDevnetCheck(null);
    if (mode !== "connected") { walletOff.current?.(); walletOff.current = null; activeWallet.current = null; activeAccount.current = null; setCanSignMessage(false); setCanSignDevnet(false); }
    const canSign = signatureAvailable ?? (mode === "connected" && !!activeWallet.current?.features["solana:signTransaction"]);
    const body = await request("/api/purchase", { sessionId: session.sessionId, offerId, quantity: quantity ?? (session.selectedOfferId === offerId ? session.purchase?.checkout.quantity ?? 1 : 1), walletMode: mode, address: nextAddress, fundingMint: mint, signatureAvailable: canSign }, mode === "none" ? "Opening your purchase review…" : "Reading assets & preparing your funding plan…");
    if (body) {
      setWalletMode(mode); setAddress(nextAddress); setFundingMint(mint);
      if (mode === "address") setWalletChains(["solana:mainnet"]);
      else if (mode === "sample" || mode === "none") setWalletChains([]);
      setShowAddressInput(!!body.purchase?.balanceError);
    }
  }

  async function connectWallet(chosen?: StandardWallet) {
    if (lock.current) return;
    const wallets = discoverStandardWallets(window);
    if (!chosen && wallets.length > 1) { setWalletChoices([...wallets]); return; }
    const wallet = chosen ?? wallets[0];
    if (!wallet) { setError(isAndroidShell(window.navigator.userAgent) ? walletFailureMessage("unavailable") : "No Solana wallet extension was found in this browser. Open SuperTab in the browser where your wallet is installed, then connect. Connecting requests no message or transaction signature."); return; }
    setWalletChoices([]);
    lock.current = true; setBusy(`Connecting ${wallet.name}…`); setError(null);
    try {
      const connected = await connectStandardWallet(wallet);
      walletDesk.current = null; setWalletSigned(false);
      activeWallet.current = wallet; activeAccount.current = connected.account; setWalletChains(connected.account.chains ?? []); setWalletChallenge(null); setCanSignMessage(supportsWalletMessage(wallet));
      setDevnetCheck(null); setCanSignDevnet(supportsDevnetSigning(wallet, connected.address, connected.account));
      walletOff.current?.();
      const epoch = walletEpoch.current;
      walletOff.current = watchStandardWallet(wallet, invalidateWallet);
      lock.current = false;
      if (epoch !== walletEpoch.current) return;
      if (session?.selectedOfferId) await selectOffer(session.selectedOfferId, "connected", connected.address, null, connected.canRequestSignature);
      else {
        walletDesk.current = null;
        setWalletSigned(false);
        setAddress(connected.address);
        setWalletMode("connected");
      }
    } catch (caught) { setError(walletFailureMessage(classifyWalletFailure(caught))); }
    finally { lock.current = false; setBusy(null); flushWalletReset(); }
  }

  async function checkWalletControl(sign = false) {
    const current = latestSession.current;
    const wallet = activeWallet.current;
    const desk = walletDesk.current;
    if (lock.current || !wallet || !activeAccount.current) return;
    const epoch = walletEpoch.current;
    lock.current = true; setError(null); setBusy(sign ? "Waiting for your wallet’s message signature…" : "Preparing a wallet control check…");
    try {
      if (!current?.purchase && !desk && !sign) {
        const response = await fetch("/api/wallet/control", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "start", address: activeAccount.current.address }), signal: AbortSignal.timeout(12_000) });
        const started = await response.json() as { sessionId: string; termsId: string; challenge: WalletChallenge; error?: string };
        if (!response.ok) throw new Error(started.error ?? "Could not prepare the wallet check.");
        if (epoch !== walletEpoch.current) return;
        walletDesk.current = { sessionId: started.sessionId, termsId: started.termsId, address: activeAccount.current.address };
        setWalletChallenge(started.challenge);
        return;
      }
      if (!current?.purchase && !desk) return;
      const terms = current?.purchase
        ? { sessionId: current.sessionId, termsId: current.purchase.termsId }
        : { sessionId: desk!.sessionId, termsId: desk!.termsId };
      if (!sign) {
        const response = await fetch("/api/wallet/control", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...terms, action: "challenge" }), signal: AbortSignal.timeout(12_000) });
        const body = await response.json() as WalletChallenge & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Could not prepare the wallet check.");
        if (epoch === walletEpoch.current) setWalletChallenge(body);
        return;
      }
      const challenge = walletChallenge;
      const expectedAddress = current?.purchase?.walletAddress ?? desk?.address;
      if (!challenge || challenge.address !== expectedAddress || challenge.termsId !== terms.termsId
        || currentTime() >= Date.parse(challenge.expiresAt)) throw new Error("Request a fresh wallet check before signing.");
      const signature = await signWalletMessage(wallet, challenge.address, challenge.message, activeAccount.current ?? undefined);
      if (epoch !== walletEpoch.current) return;
      const response = await fetch("/api/wallet/control", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...terms, action: "verify", challengeId: challenge.id, signature }), signal: AbortSignal.timeout(12_000) });
      const body = await response.json() as SessionView & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The signature could not be verified.");
      if (epoch !== walletEpoch.current) return;
      if (current?.purchase) { latestSession.current = body; setSession(body); }
      else setWalletSigned(true);
      setNow(currentTime()); setWalletChallenge(null);
    } catch (caught) {
      if (epoch === walletEpoch.current) {
        setWalletChallenge(null);
        const failure = classifyWalletFailure(caught);
        setError(failure === "failed" && caught instanceof Error ? caught.message : walletFailureMessage(failure));
      }
    } finally { lock.current = false; setBusy(null); flushWalletReset(); }
  }

  async function checkDevnetSigning(sign = false) {
    const current = latestSession.current;
    const wallet = activeWallet.current;
    if (lock.current || !current?.purchase?.walletAddress || !wallet) return;
    const epoch = walletEpoch.current;
    lock.current = true; setError(null); setBusy(sign ? "Waiting for your devnet signature…" : "Preparing a devnet memo check…");
    try {
      const terms = { sessionId: current.sessionId, termsId: current.purchase.termsId };
      if (!sign) {
        const response = await fetch("/api/wallet/devnet", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...terms, action: "prepare" }), signal: AbortSignal.timeout(15_000) });
        const body = await response.json() as DevnetSigningCheck & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Could not prepare the devnet check.");
        if (epoch === walletEpoch.current) setDevnetCheck(body);
        return;
      }
      const check = devnetCheck;
      if (!check || check.address !== current.purchase.walletAddress || check.termsId !== terms.termsId
        || currentTime() >= Date.parse(check.expiresAt)) throw new Error("Prepare a current devnet signing check first.");
      const signedTransaction = await signDevnetCheck(wallet, check, activeAccount.current ?? undefined);
      if (epoch !== walletEpoch.current) return;
      const response = await fetch("/api/wallet/devnet", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...terms, action: "verify", checkId: check.id, signedTransaction }), signal: AbortSignal.timeout(12_000) });
      const body = await response.json() as SessionView & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The devnet signature could not be verified.");
      if (epoch !== walletEpoch.current) return;
      latestSession.current = body; setSession(body); setNow(currentTime()); setDevnetCheck(null);
    } catch (caught) {
      if (epoch === walletEpoch.current) {
        setDevnetCheck(null);
        const failure = classifyWalletFailure(caught);
        setError(failure === "failed" && caught instanceof Error ? caught.message : walletFailureMessage(failure));
      }
    } finally { lock.current = false; setBusy(null); flushWalletReset(); }
  }

  const walletExpired = !!session?.purchase?.balanceExpiresAt && now >= Date.parse(session.purchase.balanceExpiresAt);
  const purchase = walletExpired && session?.purchase ? { ...session.purchase,
    assets: [], funding: null, balanceSource: "error" as const,
    balanceError: "Wallet balances expired. Refresh your wallet to review current funds.",
    swapApproval: null, walletControl: null, devnetSigning: null,
    unsignedTransaction: "not_requested" as const, purchaseApproval: "required" as const,
    paymentStatus: "PAYMENT_NOT_READY" as const } : session?.purchase;
  const selected = session?.exact.find(offer => offer.id === session.selectedOfferId);
  const expiresAt = purchase?.funding?.quoteExpiresAt ? Date.parse(purchase.funding.quoteExpiresAt) : 0;
  const expired = purchase?.funding?.quoteFreshness === "stale" || (!!expiresAt && now >= expiresAt);
  const live = purchase?.funding?.quoteFreshness === "live" && !expired;
  const prepared = purchase?.unsignedTransaction === "prepared" && live;
  const checkoutExpired = !!purchase?.checkoutVerification.expiresAt && now >= Date.parse(purchase.checkoutVerification.expiresAt);
  const checkoutVerified = purchase?.checkoutVerification.status === "verified" && !checkoutExpired;
  const checkoutCalculated = purchase?.checkoutVerification.status === "calculated" && !checkoutExpired;

  useEffect(() => {
    if (!checkoutExpired || busy || !session?.sessionId) return;
    const controller = new AbortController();
    const termsId = purchase?.termsId;
    void fetch(`/api/shop?sessionId=${encodeURIComponent(session.sessionId)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) return;
        const current = await response.json() as SessionView;
        if (!controller.signal.aborted && latestSession.current?.purchase?.termsId === termsId) {
          latestSession.current = current; setSession(current);
        }
      }).catch(() => undefined);
    return () => controller.abort();
  }, [checkoutExpired, busy, session?.sessionId, purchase?.termsId]);

  return <main className="app-shell">
    <nav className="topbar" aria-label="Main navigation"><Link className="wordmark" href="/" aria-label="SuperTab home"><span className="brand-icon">s<span>↗</span></span>SuperTab<span className="beta">DEMO</span></Link><Link href="/devnet">Devnet test product</Link><span className="demo-note"><span className="status-dot" />Explore freely. Money stays put.</span></nav>
    {offline && <p className="notice warning" role="status">You are offline. Search and balance reads need a connection. Nothing was charged.</p>}
    {androidShell && <p className="android-note">Android app. Connecting a wallet reads balances and does not move funds.</p>}
    <div className={`workspace ${purchase ? "has-review" : ""}`}>
      <section className="shopping">
        <header className={`hero ${session ? "compact" : ""}`}>
          <p className="eyebrow">A little help finding your next favorite.</p>
          <h1>{session ? "Find your next favorite." : <>Good finds.<br /><span>Powered by your wallet.</span></>}</h1>
          {!session && <p className="hero-copy">Tell us what you’re looking for. SuperTab finds real products and helps you plan how to fund them with your Solana assets.</p>}
        </header>
        {session ? <PrototypePaths compact /> : <PrototypePaths />}
        <DigitalPurchase
          key={`${purchase?.walletKind === "sample" ? "" : address}:${purchase?.walletKind === "sample" ? "" : walletChains.join(",")}:${walletMode}`}
          address={purchase?.walletKind === "sample" ? "" : address}
          network={!address || purchase?.walletKind === "sample" ? "" : walletChains.includes("solana:devnet") && !walletChains.includes("solana:mainnet") ? "solana:devnet" : walletChains.includes("solana:mainnet") ? "solana:mainnet" : ""}
          walletSource={!address || purchase?.walletKind === "sample" || !walletChains.includes("solana:mainnet") ? "not_selected" : walletMode === "connected" ? "connected" : "read_only"}
          signTransaction={walletMode === "connected" ? async (transaction) => {
            const wallet = activeWallet.current;
            if (!wallet) throw new Error("Connect the wallet that reviewed these terms.");
            return signMainnetTransaction(wallet, address, transaction, activeAccount.current ?? undefined);
          } : undefined}
          onUseReadOnly={() => { walletOff.current?.(); walletOff.current = null; activeWallet.current = null; activeAccount.current = null; walletDesk.current = null; walletEpoch.current++; setWalletSigned(false); setWalletChallenge(null); setCanSignMessage(false); setWalletMode("address"); setAddress(DEMO_ADDRESS); setWalletChains(["solana:mainnet"]); }}
        />
        <AssetConversion key={purchase?.walletKind === "sample" ? "sample" : address || "none"} suggestedAddress={purchase?.walletKind === "sample" ? "" : address} />
        <form onSubmit={search} className="composer"><label className="sr-only" htmlFor="request">Shopping request</label><textarea id="request" value={draft} onChange={event => setDraft(event.target.value)} rows={2} maxLength={SHOPPING_MESSAGE_LIMIT} disabled={!!busy} placeholder={session ? "Refine your search. Try “Navy is fine too.”" : "Find me a black polo under $50."} /><div className="composer-bottom"><span>{draft.length}/{SHOPPING_MESSAGE_LIMIT}. {session ? "A message that starts with Find starts a new search. Your shortlist stays." : "Your taste. Your budget. Real stores."}</span><button className="primary" disabled={!!busy || !draft.trim()}>Find it <span aria-hidden="true">↗</span></button></div></form>
        {!session && <div className="wallet-control"><p className="section-copy">Connect to review your wallet and quotes. Connection requests no signature and approves no payment. Wallet control proof is optional and separate.</p>{walletSigned ? <p>Wallet control verified. No purchase was approved and no transaction was broadcast.</p> : <button className="secondary" disabled={!!busy} onClick={() => void connectWallet()}>Connect wallet</button>}
          {walletMode === "connected" && <><p>Connected wallet: {address}. Control proof {walletSigned ? "verified" : "not requested"}.</p>{!walletChallenge && !walletSigned && <button className="secondary" disabled={!!busy || !canSignMessage} onClick={() => void checkWalletControl()}>Review optional wallet control message</button>}</>}
          {walletChoices.length > 0 && <div className="wallet-options" aria-label="Choose a wallet">{walletChoices.map((wallet, index) => <button key={index} disabled={!!busy} onClick={() => void connectWallet(wallet)}>Connect {wallet.name}</button>)}<button onClick={() => setWalletChoices([])}>Cancel</button></div>}
          {walletChallenge && !walletSigned && <><pre className="wallet-message">{walletChallenge.message}</pre><button className="secondary" disabled={!!busy} onClick={() => void checkWalletControl(true)}>Sign wallet control message</button></>}
        </div>}
        {!session && <div className="suggestions"><span>Try a little inspiration</span>{["Find me a black polo under $50.", "Find me running shoes under $120."].map(prompt => <button key={prompt} disabled={!!busy} onClick={() => setDraft(prompt)}>{prompt.replace("Find me ", "").replace(".", "")} <span aria-hidden="true">↗</span></button>)}</div>}
        {busy && <div className="loading-note" role="status"><span className="spinner" />{busy}<span className="loading-hint">Live providers can take a moment.</span></div>}
        {error && <div className="notice warning" role="alert">{error}<button onClick={() => setError(null)} aria-label="Dismiss message">×</button></div>}
        {note && <p id="shopping-note" className="section-copy" role="status" tabIndex={-1}>{note}</p>}
        {session ? <section className="results" aria-label="Shopping results" aria-busy={!!busy}>
          <div className="conversation"><span className="assistant-mark">✦</span><div><p className="eyebrow">SUPERTAB FINDS</p><p>{session.assistantMessage}</p></div></div>
          <div className="requirements"><span>Looking for</span><strong>{session.constraintsLabel}</strong><button type="button" className="secondary" disabled={!!busy} onClick={() => { setDraft("Find "); document.getElementById("request")?.focus(); }}>New search</button></div>
          <RequirementControls constraints={session.constraints} disabled={!!busy} onApply={(message) => void submitShopping(message, false)} />
          <details className="conversation-history"><summary>Your conversation · {session.messages.filter(message => message.role === "user").length} requests</summary>{session.messages.map((message, index) => <p key={index}><strong>{message.role === "user" ? "You" : "SuperTab"}</strong> {message.text}</p>)}</details>
          <ShortlistPanel currentIds={new Set([...session.exact, ...session.uncertain].map(item => "offer" in item ? item.offer.id : item.id))} onReview={(id) => void selectOffer(id, walletMode, address, null)} onRefind={(title) => { setDraft(`Find ${title}`); document.getElementById("request")?.focus(); }} />
          <div className="results-heading"><h2>{session.exact.length ? "Good finds for you" : "Let’s widen the search"}</h2><span>{session.exact.length} confirmed matches</span></div>
          {session.exact.length ? <div className="product-grid">{session.exact.map(offer => <OfferCard key={offer.id} offer={offer} selected={offer.id === session.selectedOfferId} disabled={!!busy} onSelect={() => void selectOffer(offer.id, walletMode, address, null)} onSave={() => { const text = saveOffer(offer); setNote(text); queueMicrotask(() => document.getElementById("shopping-note")?.focus()); }} />)}</div> : <div className="empty-state"><span>⌕</span><h3>No confirmed matches yet</h3><p>Nothing was dropped silently. Remove a requirement only if you want that restriction gone.</p>{emptyStateActions(session.constraints).map(action => <button key={action.label} className="secondary" type="button" disabled={!!busy} onClick={() => void submitShopping(action.message, false)}>{action.label}</button>)}</div>}
          {session.uncertain.length > 0 && <details className="excluded" open><summary>{session.uncertain.length} listings · requirement not confirmed</summary><div className="product-grid">{session.uncertain.map(item => <OfferCard key={item.offer.id} offer={item.offer} reasons={item.reasons} disabled={!!busy} onSelect={() => void selectOffer(item.offer.id, walletMode, address, null)} onSave={() => { const text = saveOffer(item.offer); setNote(text); queueMicrotask(() => document.getElementById("shopping-note")?.focus()); }} />)}</div></details>}
          {session.excluded.length > 0 && <details className="excluded"><summary>{session.excluded.length} other listings · a requirement conflicts</summary><div className="product-grid">{session.excluded.map(item => <OfferCard key={item.offer.id} offer={item.offer} reasons={item.reasons} />)}</div></details>}
        </section> : <section className="intro-steps" aria-label="How SuperTab works"><div><span>01 / DISCOVER</span><h2>Ask for what you love.</h2><p>Real finds from Shopify and eBay, shaped around your preferences.</p></div><div><span>02 / PLAN</span><h2>Put your assets in context.</h2><p>See your USDC balance and a live conversion quote for the difference.</p></div><div><span>03 / REVIEW</span><h2>You stay in control.</h2><p>Review an unsigned transaction. This demo stops before money moves.</p></div></section>}
      </section>
      {purchase && <aside className="purchase-review" ref={reviewRef} aria-label="Purchase review" aria-busy={!!busy}>
        <div className="review-header"><p className="eyebrow">YOUR NEXT FIND</p><h2>Cost &amp; funding</h2><span className="badge">Purchase review</span></div>
        <div className="review-product">{selected && <ProductImage offer={selected} />}<div><small>{purchase.product.merchant ?? purchase.product.source}</small><h3>{purchase.product.title}</h3><p>{purchase.product.variant ?? "Variant not specified"}</p></div></div>
        <div className="price-summary"><span>{checkoutVerified ? "Final merchant checkout total" : checkoutCalculated ? "Merchant-calculated total · can still change" : `Item ${purchase.checkout.itemKind === "catalog" ? "catalog" : purchase.checkout.itemKind === "merchant_checkout" ? "merchant" : "listing"} price`}</span><strong>{checkoutVerified || checkoutCalculated ? purchase.checkout.merchantTotalDisplay : purchase.checkout.itemDisplay ?? "Unknown"}</strong><p>Quantity {purchase.checkout.quantity} · {checkoutVerified ? "current merchant terms" : checkoutCalculated ? "not approvable until the merchant marks checkout ready" : "final total pending"}</p></div>
        <label className="asset-select">Quantity<select aria-label="Product quantity" disabled={!!busy} value={purchase.checkout.quantity}
          onChange={event => void selectOffer(session!.selectedOfferId!, walletMode, address, fundingMint, purchase.signatureCapability === "available", Number(event.target.value))}>
          {Array.from({ length: 20 }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}
        </select></label>
        <CheckoutReview key={`${session!.selectedOfferId}:${purchase.checkout.quantity}`} purchase={purchase} now={now} busy={!!busy} productUrl={selected?.productUrl ?? null} cartUrl={selected?.merchantCartUrl ?? null} otherUrl={selected?.merchantReviewUrl ?? null}
          onVerify={checkoutId => request("/api/purchase/checkout", { sessionId: session!.sessionId, termsId: purchase.termsId, checkoutId }, "Verifying the merchant’s current checkout…")}
          onCalculate={destination => request("/api/purchase/checkout", { sessionId: session!.sessionId, termsId: purchase.termsId, destination }, "Asking the merchant to calculate shipping, tax and discounts…")}
          onApprove={() => request("/api/purchase/intent", { sessionId: session!.sessionId, termsId: purchase.termsId }, "Recording approval of these purchase terms…")} />
        <details className="review-details"><summary>Price breakdown</summary><Row label="Items" value={purchase.checkout.itemDisplay ?? "Unknown"} /><Row label="Shipping" value={purchase.checkout.shippingDisplay ?? "Not yet known"} /><Row label="Tax" value={purchase.checkout.taxDisplay ?? "Not yet known"} /><Row label="Other fees" value={purchase.checkout.feeDisplay ?? "None reported"} /><Row label="Discount" value={purchase.checkout.discountDisplay ?? "None reported"} /><p>{purchase.checkout.note}</p></details>
        <Block step="1" title="Your spending assets"><p className="section-copy">Read your wallet to see how this purchase could be funded.</p>
          <details className="review-details"><summary>Explore without connecting</summary>
            <div className="wallet-actions"><button className="secondary merchant-handoff" disabled={!!busy} onClick={() => void selectOffer(session!.selectedOfferId!, "address", DEMO_ADDRESS, null)}>Demo wallet · read-only</button><div className="wallet-options"><button disabled={!!busy} onClick={() => setShowAddressInput(value => !value)}>Enter address</button><button disabled={!!busy} onClick={() => void connectWallet()}>Connect wallet</button><button disabled={!!busy} onClick={() => void selectOffer(session!.selectedOfferId!, "sample", "", null)}>Sample preview</button></div></div>
          </details>
          {showAddressInput && <form className="address-form" onSubmit={event => { event.preventDefault(); void selectOffer(session!.selectedOfferId!, "address", address.trim(), null); }}><label className="sr-only" htmlFor="wallet-address">Public Solana address</label><input id="wallet-address" value={address} onChange={event => setAddress(event.target.value)} placeholder="Public Solana address" disabled={!!busy} required /><button className="primary" disabled={!!busy || !address.trim()}>Look up</button></form>}
          <div className={`wallet-state ${purchase.walletKind === "sample" ? "sample" : ""}`}><span className="badge">{walletLabel(purchase)}</span>{purchase.walletAddress && <span className="mono" title={purchase.walletAddress}>{maskAddress(purchase.walletAddress)}</span>}</div>
          {walletChoices.length > 0 && <div className="wallet-options" aria-label="Choose a wallet">{walletChoices.map((wallet, index) => <button key={index} disabled={!!busy} onClick={() => void connectWallet(wallet)}>Connect {wallet.name}</button>)}<button onClick={() => setWalletChoices([])}>Cancel</button></div>}
          {purchase.walletKind !== "none" && <button className="secondary" disabled={!!busy} onClick={invalidateWallet}>Clear wallet review</button>}
          {purchase.walletKind === "connected" && <div className="wallet-control">
            {purchase.walletControl && now < Date.parse(purchase.walletControl.expiresAt)
              ? <p className="section-copy">Wallet control verified with a message signature. Swap and purchase approval are still separate.</p>
              : canSignMessage
                ? <><p className="section-copy">Prove this wallet is yours with a short message. This approves no purchase and moves no funds.</p>
                  {walletChallenge && walletChallenge.termsId === purchase.termsId && now < Date.parse(walletChallenge.expiresAt) ? <><pre className="wallet-message">{walletChallenge.message}</pre><button className="secondary" disabled={!!busy} onClick={() => void checkWalletControl(true)}>Sign wallet control message</button></>
                    : <button className="secondary" disabled={!!busy} onClick={() => void checkWalletControl()}>Review wallet control message</button>}</>
                : <p className="section-copy">This connection has no message-signing capability. Wallet control remains unverified.</p>}
          </div>}
          {purchase.walletKind === "connected" && <details className="review-details"><summary>Test wallet transaction signing · Devnet</summary>
            <p>Optional signing check on Solana Devnet. One memo instruction, no asset transfer. SuperTab verifies the signature and discards the signed transaction without broadcasting it. This does not convert assets or approve this purchase.</p>
            {purchase.devnetSigning ? <p className="section-copy">Devnet transaction signature verified. Not broadcast. Swap not executed; USDC readiness is unchanged.</p>
              : !canSignDevnet ? <p>This wallet account does not advertise support for legacy devnet signing.</p>
                : !purchase.walletControl || now >= Date.parse(purchase.walletControl.expiresAt) ? <p>Verify wallet control above before preparing this check.</p>
                  : devnetCheck && devnetCheck.termsId === purchase.termsId && now < Date.parse(devnetCheck.expiresAt) ? <>
                    <pre className="wallet-message">{devnetCheck.memo}</pre><p>Network: Devnet · transfer amount: 0 · broadcast: disabled. The wallet may show a network fee estimate; SuperTab submits no transaction and incurs no network fee.</p>
                    <button className="secondary" disabled={!!busy} onClick={() => void checkDevnetSigning(true)}>Sign devnet memo only</button></>
                    : <button className="secondary" disabled={!!busy} onClick={() => void checkDevnetSigning()}>Prepare devnet signing check</button>}
          </details>}
          {purchase.walletKind === "sample" && <p className="sample-note">Illustrative balances, not your assets. No transaction is prepared for a sample wallet.</p>}
          {purchase.balanceError && <p className="inline-error" role="alert">{purchase.balanceError}</p>}
          {purchase.walletAddress && <button className="secondary" disabled={!!busy} onClick={() => void selectOffer(session!.selectedOfferId!, walletMode, address, fundingMint)}>Refresh wallet balances</button>}
          {purchase.assets.length > 0 && <div className="assets">{purchase.assets.filter(asset => asset.isUsdc || asset.kind === "native").map(asset => <Row key={asset.mint} label={asset.symbol ?? "Token"} value={asset.amountDisplay} />)}{purchase.assets.some(asset => !asset.isUsdc && asset.kind !== "native") && <details className="review-details"><summary>Other tokens in this wallet</summary>{purchase.assets.filter(asset => !asset.isUsdc && asset.kind !== "native").map(asset => <Row key={asset.mint} label={asset.symbol ?? maskAddress(asset.mint)} value={asset.amountDisplay} />)}<p>Unrecognized tokens are shown by mint address. They have no assumed dollar value or guaranteed conversion route.</p></details>}</div>}
          {purchase.assets.some(asset => !asset.isUsdc && asset.kind !== "native") && <label className="asset-select">Use an asset for the difference<select disabled={!!busy} value={fundingMint ?? ""} onChange={event => void selectOffer(session!.selectedOfferId!, walletMode, address, event.target.value || null)}><option value="">Suggest SOL</option>{purchase.assets.filter(asset => !asset.isUsdc).map(asset => <option key={asset.mint} value={asset.mint}>{asset.symbol ?? asset.mint}</option>)}</select></label>}
        </Block>
        <Block step="2" title="Cover the difference">
          {purchase.balanceSource === "none" || purchase.balanceSource === "error" ? <p className="section-copy">Your funding plan appears once real or sample assets are loaded.</p> : purchase.funding ? <>
            <div className="funding-math"><Row label="Planning amount" value={purchase.funding.planningDisplay ?? "Unknown"} /><Row label="USDC available" value={purchase.funding.existingUsdc} /><div className="deficit"><span>{purchase.funding.readiness === "covered_by_usdc" ? "Covered by your USDC" : "Still needed"}</span><strong>{spendingGap(purchase.funding.deficit)}</strong></div></div>
            <p className="section-copy">An estimated conversion is not subtracted from this gap and is not added to USDC available. Use Asset conversion — quote only for a separate quote.</p>
            {purchase.funding.readiness !== "covered_by_usdc" && <div className={`quote-box ${live ? "is-live" : ""}`}><div className="quote-heading"><span className="badge">{live ? "● Live DFlow quote" : expired || purchase.funding.quoteFreshness === "stale" ? "Quote expired" : "Quote unavailable"}</span>{live && <span className="countdown">{Math.max(0, Math.ceil((expiresAt - now) / 1000))}s left</span>}</div>
              {live ? <><p>{purchase.funding.fundable ? `Use ${purchase.funding.candidateSymbol ?? "your asset"} to cover the difference` : "Your available asset does not cover this purchase yet."}</p><div className="conversion"><strong>{purchase.funding.requiredInput}</strong><span>↓</span><strong>{purchase.funding.expectedOutput}</strong></div><small>Minimum received: {purchase.funding.minimumOutput ?? "Not reported"}</small>{!purchase.funding.fundable && <p className="inline-error">This live quote is below the funding gap. Choose a lower-priced product or another funding asset. No transaction will be prepared.</p>}</> : <p>{expired ? "Markets move. Refresh your quote to prepare a current transaction for this same product." : "A live conversion is not available right now. Your product and wallet stay here; try refreshing or choose another asset."}</p>}
              <button className="secondary" disabled={!!busy} onClick={() => void selectOffer(session!.selectedOfferId!, walletMode, address, fundingMint)}>{busy ? "Preparing…" : "Refresh funding quote"} <span aria-hidden="true">↻</span></button>
            </div>}
            <details className="review-details"><summary>Conversion details & network reserve</summary><Row label="Exact funding gap" value={purchase.funding.deficit} /><Row label="Price impact" value={live ? purchase.funding.priceImpact ?? "Not reported" : "Refresh quote"} /><Row label="Slippage tolerance" value={purchase.funding.slippageBps == null ? "Not reported" : `${purchase.funding.slippageBps / 100}%`} /><Row label="SOL kept for fees" value={purchase.funding.reserve} /><Row label="Platform fee" value={purchase.funding.platformFee ?? "Not reported"} /><ul>{purchase.funding.notes.map(note => <li key={note}>{note}</li>)}</ul></details>
          </> : <p>Funding is temporarily unavailable. Your selected product is preserved.</p>}
        </Block>
        <Block step="3" title="You approve the next step"><div className={`approval-state ${prepared ? "ready" : ""}`}><span className="badge">{prepared ? "Transaction prepared" : expired ? "Refresh required" : "Swap not executed"}</span><h3>{prepared ? "Ready for your approval" : purchase.walletKind === "sample" ? "This is a sample preview" : live && !purchase.funding?.fundable ? "More funding needed." : live ? "Quote ready. Transaction not prepared." : "Your money stays in your wallet."}</h3><p>{prepared ? "A real unsigned transaction has been prepared and its format checked. It would convert the asset amount above into USDC, subject to the quote’s minimum received and slippage." : live && !purchase.funding?.fundable ? "This asset cannot cover the full funding gap while preserving the network reserve." : live ? "A live quote is available. Use a real wallet and refresh to try preparing an unsigned transaction." : "No swap has been signed or broadcast."}</p>{prepared && <strong className="approval-label">AWAITING USER APPROVAL</strong>}<p className="section-copy">Production transaction signing and financial execution are disabled. The separate devnet signing check does not approve or execute a swap.</p></div></Block>
        <div className="next-rail"><p className="eyebrow">WHAT COMES NEXT</p><h3>From wallet to an ordinary merchant.</h3><div className="rail-path">Solana assets → DFlow → USDC<br />→ ordinary merchant payment</div><span className="badge">Card rail not connected</span><p>No card is issuing or paying. Bridge sandbox access stays blocked. Immersve’s published sandbox keys returned API_KEY_DISABLED, so no sandbox authorization was run. Solana funding stays separate. A sandbox payment would not create a merchant order.</p><div className="end-states"><span>Payment not executed</span><span>Order not created</span></div><details><summary>Integration status</summary><p>{purchase.cardRail.message}</p></details></div>
        <p className="section-copy">Purchase approval becomes available after the final merchant total is verified. A live conversion quote does not mean USDC is ready or a payment has been approved.</p>
        {selected?.currency === "USD" && selected.priceMinor && BigInt(selected.priceMinor) > 0n && <PaymentRehearsal key={`${selected.id}:${selected.priceMinor}:${purchase.checkout.quantity}`} itemMinor={selected.priceMinor} quantity={purchase.checkout.quantity} title={selected.title} />}
      </aside>}
    </div>
    <footer><span>SuperTab · AI shopping, powered by what you hold.</span><details><summary>Live services & demo status</summary>{health ? <div><p>Assistant: {health.gemini === "configured" ? health.geminiModel : "Not configured"}</p><p>Shopify: {health.shopify} · eBay: {health.ebay}</p><p>Solana: {health.solana} · DFlow: {["live_quote", "available", "authenticated"].includes(health.dflow) ? "Available at last check" : "Temporarily unavailable"}</p><p>CardRail not connected · financial execution disabled</p></div> : <p>Checking live services…</p>}</details></footer>
  </main>;
}

function OfferCard({ offer, selected, disabled, onSelect, onSave, reasons }: { offer: OfferView; selected?: boolean; disabled?: boolean; onSelect?: () => void; onSave?: () => void; reasons?: string[] }) {
  return <article className={`product-card ${selected ? "selected" : ""}`}><div className="product-image-wrap"><ProductImage offer={offer} /><span className="source-tag">{offer.source === "shopify" ? "Shopify" : "eBay"}</span>{selected && <span className="selected-tag">✓ Selected</span>}</div><div className="product-info"><p className="merchant">{offer.merchant ?? "Independent merchant"}</p><h3>{offer.title}</h3><p className="variant">{[offer.variantLabel, offer.condition].filter(Boolean).join(" · ") || "Variant not specified"}</p><div className="product-price"><strong>{offer.priceDisplay ?? "Price unknown"}</strong><span>{offer.availability === "in_stock" ? "In stock" : offer.availability === "out_of_stock" ? "Out of stock" : "Stock not returned"}</span></div><p className="price-note">{offer.priceKind === "catalog" ? "Catalog" : offer.priceKind === "listing" ? "Listing" : "Item"} price · shipping {offer.shippingDisplay ?? "not returned"} · tax not returned</p><EvidenceList evidence={offer.evidence} />{reasons && <p className="inline-error">{reasons.join(" ")}</p>}{onSave && <button className="secondary" type="button" disabled={disabled} onClick={onSave}>Save to shortlist</button>}{onSelect && <button className={selected ? "secondary" : "primary"} disabled={disabled} onClick={onSelect}>{selected ? "View purchase review" : "Review purchase"}<span aria-hidden="true">↗</span></button>}<MerchantHandoffLinks productUrl={offer.productUrl} cartUrl={offer.merchantCartUrl} otherUrl={offer.merchantReviewUrl} /></div></article>;
}
function ProductImage({ offer }: { offer: OfferView }) {
  const [failed, setFailed] = useState(false);
  return <div className="product-image">{offer.imageUrl && !failed ?
    // Real merchant hosts are only known at search time.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={offer.imageUrl} alt={offer.title} loading="lazy" onError={() => setFailed(true)} /> : <span className="image-fallback">↗<small>Image unavailable</small></span>}</div>;
}
function Row({ label, value }: { label: string; value: string }) { return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div>; }
function Block({ step, title, children }: { step: string; title: string; children: ReactNode }) { return <section className="review-block"><h3><span className="step-number">{step}</span>{title}</h3>{children}</section>; }
function maskAddress(value: string) { return `${value.slice(0, 4)}…${value.slice(-4)}`; }
function spendingGap(value: string) {
  const match = /^(\d+)(?:\.(\d+))? USDC$/.exec(value);
  if (!match) return value;
  const base = BigInt(match[1]!) * 1_000_000n + BigInt((match[2] ?? "").padEnd(6, "0"));
  const cents = (base + 9_999n) / 10_000n;
  return `${base % 10_000n ? "≈ " : ""}${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")} USDC`;
}
function walletLabel(purchase: PurchaseView) {
  if (purchase.balanceSource === "error") return "Wallet read unavailable";
  if (purchase.walletKind === "sample") return "Sample preview";
  if (purchase.walletKind === "read_only") return "Read-only real wallet";
  if (purchase.walletKind === "connected") return "Connected wallet";
  return "No wallet selected";
}
