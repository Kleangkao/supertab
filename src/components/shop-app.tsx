"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { PaymentRehearsal } from "@/components/payment-rehearsal";
import { connectStandardWallet, discoverStandardWallets, type StandardWallet } from "@/lib/wallet-standard";
import type { HealthView, OfferView, PurchaseView, SessionView } from "@/lib/view";

// An explicit convenience for this demo session, never an application wallet default.
const DEMO_ADDRESS = "JCVsKd4TMg1fvEs7rjf5YgLYbJfNC8Dwb4x1PchFkGM7";
const STORAGE_KEY = "supertab.shopping-session.v1";
type WalletMode = PurchaseView["walletMode"];
const currentTime = () => Date.now();

export function ShopApp() {
  const [health, setHealth] = useState<HealthView | null>(null);
  const [session, setSession] = useState<SessionView | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletMode, setWalletMode] = useState<WalletMode>("none");
  const [address, setAddress] = useState("");
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [fundingMint, setFundingMint] = useState<string | null>(null);
  const [walletChoices, setWalletChoices] = useState<StandardWallet[]>([]);
  const [now, setNow] = useState(0);
  const lock = useRef(false);
  const reviewRef = useRef<HTMLElement>(null);
  const selectedOfferId = session?.selectedOfferId;
  useEffect(() => {
    if (selectedOfferId) reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedOfferId]);

  useEffect(() => {
    discoverStandardWallets(window);
    const controller = new AbortController();
    void fetch("/api/health", { signal: controller.signal }).then(async response => {
      if (response.ok) setHealth(await response.json() as HealthView);
    }).catch(() => undefined);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
    if (saved) {
      lock.current = true;
      queueMicrotask(() => { if (!controller.signal.aborted) setBusy("Restoring your shopping session…"); });
      void fetch(`/api/shop?sessionId=${encodeURIComponent(saved)}`, { signal: controller.signal }).then(async response => {
        if (!response.ok) throw new Error("Your previous search expired. Let’s find something new.");
        const restored = await response.json() as SessionView;
        if (restored.purchase?.walletMode === "connected") {
          restored.purchase = { ...restored.purchase, walletMode: "address", walletKind: "read_only", signatureCapability: "disabled" };
        }
        setSession(restored);
        setWalletMode(restored.purchase?.walletMode === "connected" ? "address" : restored.purchase?.walletMode ?? "none");
        setAddress(restored.purchase?.walletAddress ?? "");
        setFundingMint(restored.purchase?.funding?.candidateMint ?? null);
        setNow(Date.now());
      }).catch(caught => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Could not restore your search.");
      }).finally(() => { if (!controller.signal.aborted) { lock.current = false; setBusy(null); } });
    }
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);

  async function request(path: string, payload: object, loading: string) {
    if (lock.current) return;
    lock.current = true; setBusy(loading); setError(null);
    try {
      const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(90_000) });
      const body = await response.json() as SessionView & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Please try again.");
      setSession(body); setNow(currentTime());
      try { sessionStorage.setItem(STORAGE_KEY, body.sessionId); } catch { /* Storage is optional. */ }
      return body;
    } catch (caught) {
      setError(caught instanceof Error && caught.name !== "TimeoutError" ? caught.message : "This is taking too long. Your selection is still here; please try again.");
    } finally { lock.current = false; setBusy(null); }
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    const body = await request("/api/shop", { sessionId: session?.sessionId, message: draft }, "Finding real products for you…");
    if (body) { setDraft(""); setFundingMint(null); }
  }

  async function selectOffer(offerId: string, mode = walletMode, nextAddress = address, mint = fundingMint, signatureAvailable = false) {
    if (!session) return;
    const body = await request("/api/purchase", { sessionId: session.sessionId, offerId, walletMode: mode, address: nextAddress, fundingMint: mint, signatureAvailable }, mode === "none" ? "Opening your purchase review…" : "Reading assets & preparing your funding plan…");
    if (body) {
      setWalletMode(mode); setAddress(nextAddress); setFundingMint(mint);
      setShowAddressInput(!!body.purchase?.balanceError);
    }
  }

  async function connectWallet(chosen?: StandardWallet) {
    if (lock.current) return;
    const wallets = discoverStandardWallets(window);
    if (!chosen && wallets.length > 1) { setWalletChoices([...wallets]); return; }
    const wallet = chosen ?? wallets[0];
    if (!wallet) { setError("No Solana wallet extension was found. Use the real demo wallet in read-only mode instead."); return; }
    setWalletChoices([]);
    lock.current = true; setBusy(`Connecting ${wallet.name}…`); setError(null);
    try {
      const connected = await connectStandardWallet(wallet);
      lock.current = false;
      if (session?.selectedOfferId) await selectOffer(session.selectedOfferId, "connected", connected.address, null, connected.canRequestSignature);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The wallet did not connect."); }
    finally { lock.current = false; setBusy(null); }
  }

  const purchase = session?.purchase;
  const selected = session?.exact.find(offer => offer.id === session.selectedOfferId);
  const expiresAt = purchase?.funding?.quoteExpiresAt ? Date.parse(purchase.funding.quoteExpiresAt) : 0;
  const expired = purchase?.funding?.quoteFreshness === "stale" || (!!expiresAt && now >= expiresAt);
  const live = purchase?.funding?.quoteFreshness === "live" && !expired;
  const prepared = purchase?.unsignedTransaction === "prepared" && live;

  return <main className="app-shell">
    <nav className="topbar" aria-label="Main navigation"><Link className="wordmark" href="/" aria-label="SuperTab home"><span className="brand-icon">s<span>↗</span></span>SuperTab<span className="beta">DEMO</span></Link><span className="demo-note"><span className="status-dot" />Explore freely. Money stays put.</span></nav>
    <div className={`workspace ${purchase ? "has-review" : ""}`}>
      <section className="shopping">
        <header className={`hero ${session ? "compact" : ""}`}>
          <p className="eyebrow">A little help finding your next favorite.</p>
          <h1>{session ? "Find your next favorite." : <>Good finds.<br /><span>Powered by your wallet.</span></>}</h1>
          {!session && <p className="hero-copy">Tell us what you’re looking for. SuperTab finds real products and helps you plan how to fund them with your Solana assets.</p>}
        </header>
        <form onSubmit={search} className="composer"><label className="sr-only" htmlFor="request">Shopping request</label><textarea id="request" value={draft} onChange={event => setDraft(event.target.value)} rows={2} maxLength={2000} disabled={!!busy} placeholder={session ? "Refine your search. Try “Navy is fine too.”" : "Find me a black polo under $50."} /><div className="composer-bottom"><span>✦ {session ? "Your earlier requirements stay with us" : "Your taste. Your budget. Real stores."}</span><button className="primary" disabled={!!busy || !draft.trim()}>Find it <span aria-hidden="true">↗</span></button></div></form>
        {!session && <div className="suggestions"><span>Try a little inspiration</span>{["Find me a black polo under $50.", "Find me running shoes under $120."].map(prompt => <button key={prompt} disabled={!!busy} onClick={() => setDraft(prompt)}>{prompt.replace("Find me ", "").replace(".", "")} <span aria-hidden="true">↗</span></button>)}</div>}
        {busy && <div className="loading-note" role="status"><span className="spinner" />{busy}<span className="loading-hint">Live providers can take a moment.</span></div>}
        {error && <div className="notice warning" role="alert">{error}<button onClick={() => setError(null)} aria-label="Dismiss message">×</button></div>}
        {session ? <section className="results" aria-label="Shopping results" aria-busy={!!busy}>
          <div className="conversation"><span className="assistant-mark">✦</span><div><p className="eyebrow">SUPERTAB FINDS</p><p>{session.assistantMessage}</p></div></div>
          <div className="requirements"><span>Looking for</span><strong>{session.constraintsLabel}</strong></div>
          <details className="conversation-history"><summary>Your conversation · {session.messages.filter(message => message.role === "user").length} requests</summary>{session.messages.map((message, index) => <p key={index}><strong>{message.role === "user" ? "You" : "SuperTab"}</strong> {message.text}</p>)}</details>
          <div className="results-heading"><h2>{session.exact.length ? "Your shortlist" : "Let’s widen the search"}</h2><span>{session.exact.length} matches · real merchant listings</span></div>
          {session.exact.length ? <div className="product-grid">{session.exact.map(offer => <OfferCard key={offer.id} offer={offer} selected={offer.id === session.selectedOfferId} disabled={!!busy} onSelect={() => void selectOffer(offer.id, walletMode, address, null)} />)}</div> : <div className="empty-state"><span>⌕</span><h3>No exact matches yet</h3><p>Try another color, a higher budget, or fewer requirements. We’ll keep the rest of your request.</p><button className="secondary" disabled={!!busy} onClick={() => { setDraft("Navy is fine too."); document.getElementById("request")?.focus(); }}>Try navy too</button></div>}
          {session.excluded.length > 0 && <details className="excluded"><summary>{session.excluded.length} other listings · missing a requirement</summary><div className="product-grid">{session.excluded.map(item => <OfferCard key={item.offer.id} offer={item.offer} reasons={item.reasons} />)}</div></details>}
        </section> : <section className="intro-steps" aria-label="How SuperTab works"><div><span>01 / DISCOVER</span><h2>Ask for what you love.</h2><p>Real finds from Shopify and eBay, shaped around your preferences.</p></div><div><span>02 / PLAN</span><h2>Put your assets in context.</h2><p>See your USDC balance and a live conversion quote for the difference.</p></div><div><span>03 / REVIEW</span><h2>You stay in control.</h2><p>Review an unsigned transaction. This demo stops before money moves.</p></div></section>}
      </section>
      {purchase && <aside className="purchase-review" ref={reviewRef} aria-label="Purchase review" aria-busy={!!busy}>
        <div className="review-header"><p className="eyebrow">YOUR NEXT FIND</p><h2>Let’s make a plan.</h2><span className="badge">Purchase review</span></div>
        <div className="review-product">{selected && <ProductImage offer={selected} />}<div><small>{purchase.product.merchant ?? purchase.product.source}</small><h3>{purchase.product.title}</h3><p>{purchase.product.variant ?? "Variant not specified"}</p></div></div>
        <div className="price-summary"><span>Item {purchase.checkout.itemKind === "catalog" ? "catalog" : "listing"} price</span><strong>{purchase.checkout.itemDisplay ?? "Unknown"}</strong><p>Quantity {purchase.checkout.quantity} · final total pending</p></div>
        <div className="notice subtle"><strong>Final checkout total unknown</strong><p>Final shipping and tax need merchant confirmation. This plan includes only the prices currently known.</p>{selected?.merchantReviewUrl && <a href={selected.merchantReviewUrl} target="_blank" rel="noopener noreferrer">Review price and delivery at the merchant ↗</a>}<p>Opening the merchant page does not approve a purchase or verify its final total in SuperTab.</p></div>
        <details className="review-details"><summary>Price breakdown</summary><Row label="Shipping" value={purchase.checkout.shippingDisplay ?? "Not yet known"} /><Row label="Tax" value={purchase.checkout.taxDisplay ?? "Not yet known"} /><Row label="Discount" value={purchase.checkout.discountDisplay ?? "None reported"} /><p>{purchase.checkout.note}</p></details>
        <Block step="1" title="Your spending assets"><p className="section-copy">Read your wallet to see how this purchase could be funded.</p>
          <div className="wallet-actions"><button className="secondary" disabled={!!busy} onClick={() => void selectOffer(session!.selectedOfferId!, "address", DEMO_ADDRESS, null)}>Use real demo wallet <span>Read-only</span></button><div className="wallet-options"><button disabled={!!busy} onClick={() => setShowAddressInput(value => !value)}>Enter address</button><button disabled={!!busy} onClick={() => void connectWallet()}>Connect wallet</button><button disabled={!!busy} onClick={() => void selectOffer(session!.selectedOfferId!, "sample", "", null)}>Sample preview</button></div></div>
          {showAddressInput && <form className="address-form" onSubmit={event => { event.preventDefault(); void selectOffer(session!.selectedOfferId!, "address", address.trim(), null); }}><label className="sr-only" htmlFor="wallet-address">Public Solana address</label><input id="wallet-address" value={address} onChange={event => setAddress(event.target.value)} placeholder="Public Solana address" disabled={!!busy} required /><button className="primary" disabled={!!busy || !address.trim()}>Look up</button></form>}
          <div className={`wallet-state ${purchase.walletKind === "sample" ? "sample" : ""}`}><span className="badge">{walletLabel(purchase)}</span>{purchase.walletAddress && <span className="mono" title={purchase.walletAddress}>{maskAddress(purchase.walletAddress)}</span>}</div>
          {walletChoices.length > 0 && <div className="wallet-options" aria-label="Choose a wallet">{walletChoices.map((wallet, index) => <button key={index} disabled={!!busy} onClick={() => void connectWallet(wallet)}>Connect {wallet.name}</button>)}<button onClick={() => setWalletChoices([])}>Cancel</button></div>}
          {purchase.walletKind === "sample" && <p className="sample-note">Illustrative balances, not your assets. No transaction is prepared for a sample wallet.</p>}
          {purchase.balanceError && <p className="inline-error" role="alert">We couldn’t read this wallet. {purchase.balanceError}</p>}
          {purchase.assets.length > 0 && <div className="assets">{purchase.assets.filter(asset => asset.isUsdc || asset.kind === "native").map(asset => <Row key={asset.mint} label={asset.symbol ?? "Token"} value={asset.amountDisplay} />)}{purchase.assets.some(asset => !asset.isUsdc && asset.kind !== "native") && <details className="review-details"><summary>Other tokens in this wallet</summary>{purchase.assets.filter(asset => !asset.isUsdc && asset.kind !== "native").map(asset => <Row key={asset.mint} label={asset.symbol ?? maskAddress(asset.mint)} value={asset.amountDisplay} />)}<p>Unrecognized tokens are shown by mint address. They have no assumed dollar value or guaranteed conversion route.</p></details>}</div>}
          {purchase.assets.some(asset => !asset.isUsdc && asset.kind !== "native") && <label className="asset-select">Use an asset for the difference<select disabled={!!busy} value={fundingMint ?? ""} onChange={event => void selectOffer(session!.selectedOfferId!, walletMode, address, event.target.value || null)}><option value="">Suggest SOL</option>{purchase.assets.filter(asset => !asset.isUsdc).map(asset => <option key={asset.mint} value={asset.mint}>{asset.symbol ?? asset.mint}</option>)}</select></label>}
        </Block>
        <Block step="2" title="Cover the difference">
          {purchase.balanceSource === "none" || purchase.balanceSource === "error" ? <p className="section-copy">Your funding plan appears once real or sample assets are loaded.</p> : purchase.funding ? <>
            <div className="funding-math"><Row label="Planning amount" value={purchase.funding.planningDisplay ?? "Unknown"} /><Row label="USDC available" value={purchase.funding.existingUsdc} /><div className="deficit"><span>{purchase.funding.readiness === "covered_by_usdc" ? "Covered by your USDC" : "Still needed"}</span><strong>{spendingGap(purchase.funding.deficit)}</strong></div></div>
            {purchase.funding.readiness !== "covered_by_usdc" && <div className={`quote-box ${live ? "is-live" : ""}`}><div className="quote-heading"><span className="badge">{live ? "● Live DFlow quote" : expired || purchase.funding.quoteFreshness === "stale" ? "Quote expired" : "Quote unavailable"}</span>{live && <span className="countdown">{Math.max(0, Math.ceil((expiresAt - now) / 1000))}s left</span>}</div>
              {live ? <><p>{purchase.funding.fundable ? `Use ${purchase.funding.candidateSymbol ?? "your asset"} to cover the difference` : "Your available asset does not cover this purchase yet."}</p><div className="conversion"><strong>{purchase.funding.requiredInput}</strong><span>↓</span><strong>{purchase.funding.expectedOutput}</strong></div><small>Minimum received: {purchase.funding.minimumOutput ?? "Not reported"}</small>{!purchase.funding.fundable && <p className="inline-error">This live quote is below the funding gap. Choose a lower-priced product or another funding asset. No transaction will be prepared.</p>}</> : <p>{expired ? "Markets move. Refresh your quote to prepare a current transaction for this same product." : "A live conversion is not available right now. Your product and wallet stay here; try refreshing or choose another asset."}</p>}
              <button className="secondary" disabled={!!busy} onClick={() => void selectOffer(session!.selectedOfferId!, walletMode, address, fundingMint)}>{busy ? "Preparing…" : "Refresh funding quote"} <span aria-hidden="true">↻</span></button>
            </div>}
            <details className="review-details"><summary>Conversion details & network reserve</summary><Row label="Exact funding gap" value={purchase.funding.deficit} /><Row label="Price impact" value={live ? purchase.funding.priceImpact ?? "Not reported" : "Refresh quote"} /><Row label="Slippage tolerance" value={purchase.funding.slippageBps == null ? "Not reported" : `${purchase.funding.slippageBps / 100}%`} /><Row label="SOL kept for fees" value={purchase.funding.reserve} /><Row label="Platform fee" value={purchase.funding.platformFee ?? "Not reported"} /><ul>{purchase.funding.notes.map(note => <li key={note}>{note}</li>)}</ul></details>
          </> : <p>Funding is temporarily unavailable. Your selected product is preserved.</p>}
        </Block>
        <Block step="3" title="You approve the next step"><div className={`approval-state ${prepared ? "ready" : ""}`}><span className="badge">{prepared ? "Transaction prepared" : expired ? "Refresh required" : "Swap not executed"}</span><h3>{prepared ? "Ready for your approval" : purchase.walletKind === "sample" ? "This is a sample preview" : live && !purchase.funding?.fundable ? "More funding needed." : live ? "Quote ready. Transaction not prepared." : "Your money stays in your wallet."}</h3><p>{prepared ? "A real unsigned transaction has been prepared and its format checked. It would convert the asset amount above into USDC, subject to the quote’s minimum received and slippage." : live && !purchase.funding?.fundable ? "This asset cannot cover the full funding gap while preserving the network reserve." : live ? "A live quote is available. Use a real wallet and refresh to try preparing an unsigned transaction." : "No swap has been signed or broadcast."}</p>{prepared && <strong className="approval-label">AWAITING USER APPROVAL</strong>}<p className="section-copy">Wallet signing and financial execution are disabled in this demo. Swap not executed.</p></div></Block>
        <div className="next-rail"><p className="eyebrow">WHAT COMES NEXT</p><h3>From wallet to an ordinary merchant.</h3><div className="rail-path">Solana assets → DFlow → USDC<br />→ wallet-backed CardRail → merchant</div><span className="badge">Card rail not connected</span><p>Preferred integration: Bridge + Stripe Issuing. Sandbox access is blocked; no card has been issued. Merchant order creation is not implemented.</p><div className="end-states"><span>Payment not executed</span><span>Order not created</span></div><details><summary>Integration status</summary><p>{purchase.cardRail.message}</p></details></div>
        <p className="section-copy">Purchase approval becomes available after the final merchant total is verified. A live conversion quote does not mean USDC is ready or a payment has been approved.</p>
        {selected?.currency === "USD" && selected.priceMinor && BigInt(selected.priceMinor) > 0n && <PaymentRehearsal key={`${selected.id}:${selected.priceMinor}:${purchase.checkout.quantity}`} itemMinor={selected.priceMinor} quantity={purchase.checkout.quantity} title={selected.title} />}
      </aside>}
    </div>
    <footer><span>SuperTab · AI shopping, powered by what you hold.</span><details><summary>Live services & demo status</summary>{health ? <div><p>Assistant: {health.gemini === "configured" ? health.geminiModel : "Not configured"}</p><p>Shopify: {health.shopify} · eBay: {health.ebay}</p><p>Solana: {health.solana} · DFlow: {["live_quote", "available", "authenticated"].includes(health.dflow) ? "Available at last check" : "Temporarily unavailable"}</p><p>CardRail not connected · financial execution disabled</p></div> : <p>Checking live services…</p>}</details></footer>
  </main>;
}

function OfferCard({ offer, selected, disabled, onSelect, reasons }: { offer: OfferView; selected?: boolean; disabled?: boolean; onSelect?: () => void; reasons?: string[] }) {
  return <article className={`product-card ${selected ? "selected" : ""}`}><div className="product-image-wrap"><ProductImage offer={offer} /><span className="source-tag">{offer.source === "shopify" ? "Shopify" : "eBay"}</span>{selected && <span className="selected-tag">✓ Selected</span>}</div><div className="product-info"><p className="merchant">{offer.merchant ?? "Independent merchant"}</p><h3>{offer.title}</h3><p className="variant">{[offer.variantLabel, offer.condition].filter(Boolean).join(" · ") || "Variant not specified"}</p><div className="product-price"><strong>{offer.priceDisplay ?? "Price unknown"}</strong><span>{offer.availability === "in_stock" ? "In stock" : "Stock unconfirmed"}</span></div><p className="price-note">{offer.priceKind === "catalog" ? "Catalog" : "Listing"} price · shipping & tax may apply</p>{reasons && <p className="inline-error">{reasons.join(" ")}</p>}{onSelect && <button className={selected ? "secondary" : "primary"} disabled={disabled} onClick={onSelect}>{selected ? "Review selected product" : "Make a purchase plan"}<span aria-hidden="true">↗</span></button>}</div></article>;
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
