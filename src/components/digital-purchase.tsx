"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { reviewStillBound } from "@/lib/digital-purchase";
import type { PreparedDigitalPurchase } from "@/lib/digital-purchase-service";
import { EXECUTION_GATE_LABEL, WORKFLOW_STAGES, WORKFLOW_STAGE_LABELS } from "@/lib/purchase-status";
import {
  CLAIM_REVIEW,
  createPreparedAttempt,
  parseStoredAttempt,
  persistConnectedAttempt,
  readAttemptServerSnapshot,
  readAttemptSnapshot,
  readStoredAttempt,
  rememberPreparedQuote,
  resumeAttempt,
  subscribeAttempts,
} from "@/lib/purchase-recovery";

type ServerPurchase = {
  executionGate?: "off" | "on";
  error?: string | null;
  purpose?: string | null;
  unsignedTransaction?: string | null;
  workflow?: { state?: string; mismatch?: string | null; usdcPreserved?: boolean; paymentAuthorization?: string } | null;
};

export function DigitalPurchase({
  address = "",
  network = "",
  walletSource = "not_selected",
  onUseReadOnly,
  signTransaction,
}: {
  address?: string;
  network?: "solana:mainnet" | "solana:devnet" | "";
  walletSource?: "connected" | "read_only" | "not_selected";
  onUseReadOnly?: () => void;
  signTransaction?: (transaction: Uint8Array) => Promise<Uint8Array>;
}) {
  const [review, setReview] = useState<PreparedDigitalPurchase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryNote, setRecoveryNote] = useState<string | null>(null);
  const [workflowLabel, setWorkflowLabel] = useState<string | null>(null);
  const [server, setServer] = useState<ServerPurchase | null>(null);
  const [preparedTransaction, setPreparedTransaction] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const storedRaw = useSyncExternalStore(subscribeAttempts, readAttemptSnapshot, readAttemptServerSnapshot);
  const storedAttempt = parseStoredAttempt(storedRaw);
  const resumed = walletSource === "connected" && network === "solana:mainnet" && address
    ? resumeAttempt(storedAttempt, address)
    : { current: null, foreign: false };
  const mainnet = network === "solana:mainnet" && !!address;
  const bound = !!review && reviewStillBound({
    reviewAddress: review.wallet.address,
    reviewNetwork: review.wallet.network,
    currentAddress: address,
    currentNetwork: network,
  });

  useEffect(() => {
    if (!review) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [review]);

  const visible = bound && review?.wallet.source === walletSource ? review : null;
  const attemptId = resumed.current?.id ?? visible?.recovery.idempotencyKey ?? null;
  useEffect(() => {
    if (!attemptId || walletSource !== "connected") return;
    let cancel = false;
    void fetch(`/api/digital-purchase/status?attemptId=${encodeURIComponent(attemptId)}`, { method: "POST", headers: { accept: "application/json" } })
      .then((response) => response.json() as Promise<ServerPurchase>)
      .then((body) => { if (!cancel) setServer(body); })
      .catch(() => { if (!cancel) setServer(null); });
    return () => { cancel = true; };
  }, [attemptId, walletSource, workflowLabel]);

  const executionGate = server?.executionGate ?? visible?.executionGate ?? "off";
  const serverState = server?.workflow?.state ?? workflowLabel;
  const unresolved = resumed.current != null && resumed.current.state !== "prepared_not_submitted" && resumed.current.state !== "bitcoin_anchoring_verified";
  const merchantExpired = !!visible && now >= Date.parse(visible.terms.expiresAt);
  const conversionExpired = !!visible?.conversion.expiresAt && now >= Date.parse(visible.conversion.expiresAt);
  const expired = merchantExpired || conversionExpired;

  async function recordTerms() {
    if (!visible || walletSource !== "connected" || !visible.recovery.idempotencyKey || !visible.wallet.address || !visible.spend.solLamports) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/digital-purchase/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attemptId: visible.recovery.idempotencyKey,
          terms: {
            wallet: visible.wallet.address,
            network: "solana:mainnet",
            productId: "bitcoin_anchor",
            digest: visible.payload.digest,
            amountAtomic: visible.terms.amountAtomic,
            recipient: visible.terms.payTo,
            sponsor: visible.terms.feePayer,
            merchantExpiresAt: visible.terms.expiresAt,
            conversionInputLamports: visible.conversion.inputLamports,
            minimumOutputAtomic: visible.conversion.minimumUsdcAtomic,
            slippageBps: visible.conversion.slippageBps,
            prioritizationFeeLamports: visible.conversion.prioritizationFeeLamports ?? "0",
            solCapLamports: visible.spend.solLamports,
            reserveLamports: visible.spend.reserveLamports,
          },
        }),
      });
      const body = await response.json() as { error?: string; workflow?: { state?: string } };
      if (!response.ok) throw new Error(body.error ?? "The terms were not recorded.");
      setWorkflowLabel(body.workflow?.state ?? null);
      setServer(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The terms were not recorded.");
    } finally {
      setBusy(false);
    }
  }

  async function postAttempt(action: string, signedTransaction?: string) {
    if (executionGate !== "on" || !attemptId || !address) return null;
    const response = await fetch("/api/digital-purchase/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, attemptId, wallet: address, ...(signedTransaction ? { signedTransaction } : {}) }),
    });
    const body = await response.json() as ServerPurchase;
    setServer(body);
    setWorkflowLabel(body.workflow?.state ?? null);
    if (body.purpose) setPurpose(body.purpose);
    if (body.unsignedTransaction) setPreparedTransaction(body.unsignedTransaction);
    if (!response.ok || body.error) throw new Error(body.error ?? "The attempt did not continue.");
    return body;
  }

  async function prepareSignature(action: "prepare_swap" | "prepare_payment") {
    if (executionGate !== "on") return;
    setBusy(true);
    setError(null);
    try {
      await postAttempt(action);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The transaction was not prepared.");
    } finally {
      setBusy(false);
    }
  }

  async function signPrepared(action: "accept_swap_signature" | "accept_payment_signature") {
    if (executionGate !== "on" || !signTransaction || !preparedTransaction || !purpose) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = Uint8Array.from(atob(preparedTransaction), (char) => char.charCodeAt(0));
      const signed = await signTransaction(bytes);
      let binary = "";
      signed.forEach((byte) => { binary += String.fromCharCode(byte); });
      await postAttempt(action, btoa(binary));
      setPreparedTransaction(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The signature was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPrepared(action: "submit_swap" | "submit_payment" | "reconcile" | "verify_certificate" | "replay_payment") {
    if (executionGate !== "on") return;
    setBusy(true);
    setError(null);
    try {
      await postAttempt(action);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The attempt did not continue.");
    } finally {
      setBusy(false);
    }
  }

  async function requestQuote() {
    if (!mainnet) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/digital-purchase/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          walletSource: walletSource === "connected" ? "connected" : "read_only",
        }),
      });
      const body = await response.json() as PreparedDigitalPurchase & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The quote could not be prepared.");
      if (body.wallet.address !== address || body.wallet.network !== network) {
        throw new Error("The quote was not for the wallet now selected.");
      }
      if (body.wallet.source !== walletSource) {
        throw new Error("The quote was not bound to this wallet connection.");
      }
      setRecoveryNote(null);
      if (walletSource === "connected" && body.readyForApproval && body.recovery.idempotencyKey && body.wallet.address) {
        const prepared = createPreparedAttempt({
          id: body.recovery.idempotencyKey,
          walletSource: "connected",
          walletAddress: body.wallet.address,
          digest: body.payload.digest,
          idempotencyKey: body.recovery.idempotencyKey,
          amountAtomic: body.terms.amountAtomic,
          payTo: body.terms.payTo,
          feePayer: body.terms.feePayer,
          merchantExpiresAt: body.terms.expiresAt,
          nowIso: new Date().toISOString(),
        });
        const remembered = rememberPreparedQuote(readStoredAttempt(window.localStorage), prepared);
        persistConnectedAttempt(remembered.attempt, window.localStorage);
        if (remembered.reason) setRecoveryNote(remembered.reason);
      }
      setReview(body);
      setNow(Date.now());
    } catch (caught) {
      setReview(null);
      setError(caught instanceof Error ? caught.message : "The quote could not be prepared.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="prototype-paths" aria-label="Prepared digital purchase">
    <p className="eyebrow">TIMESTAMP SERVICE — QUOTE ONLY</p>
    <h2>A Bitcoin Anchor, quantity 1.</h2>
    <p>This is a digital timestamping-service test. It can later prove a SOL to USDC conversion, a merchant payment, and a certificate for one digest. It does not prove a physical purchase or shipping to Thailand.</p>
    <div className="wallet-actions">
      {onUseReadOnly && <button className="secondary" type="button" onClick={onUseReadOnly}>Use read-only demo wallet</button>}
      <button className="secondary" type="button" disabled={busy || !mainnet} onClick={() => void requestQuote()}>
        {busy ? "Refreshing the unpaid quote…" : "Refresh unpaid quote"}
      </button>
    </div>
    <p>{walletSource === "connected" && mainnet
      ? `Connected wallet ${address} on Solana mainnet. Balances, conversion, purchase terms, and recovery identity use this address. This is not an approval to pay.`
      : walletSource === "read_only"
        ? "Read-only exploration. This address cannot produce an approval package, and it is not stored as a recoverable payment."
        : network === "solana:devnet"
          ? "The connected wallet is not on Solana mainnet, so this review is cleared."
          : "Choose the read-only demo wallet or connect a wallet before requesting a quote. This panel does not ask for a signature."}{mainnet ? " Refreshing a quote does not approve a purchase, request a signature, or move funds." : ""}</p>
    {error && <div className="notice warning" role="alert">{error}</div>}
    {recoveryNote && <div className="notice warning" role="status">{recoveryNote}</div>}
    {resumed.foreign && <p>A stored attempt belongs to a different wallet and is not continued.</p>}
    {walletSource === "read_only" && storedAttempt?.walletAddress === address && <p>This browser has a stored attempt for this address. Exploration mode does not continue it and does not pay.</p>}
    {visible && <article className="path-card">
      <div className="detail-row"><span>Wallet</span><strong>{visible.wallet.address}</strong></div>
      <div className="detail-row"><span>Wallet source</span><strong>{visible.wallet.source === "connected" ? "Connected" : "Read-only exploration"}</strong></div>
      <div className="detail-row"><span>Network</span><strong>{visible.wallet.network === "solana:mainnet" ? "Solana mainnet" : "Not mainnet"}</strong></div>
      <div className="detail-row"><span>Product</span><strong>{visible.terms.productName}, quantity {visible.terms.quantity}</strong></div>
      <div className="detail-row"><span>Delivery</span><strong>{visible.delivery.method}</strong></div>
      <div className="detail-row"><span>Payload</span><strong>{visible.payload.preimage}</strong></div>
      <div className="detail-row"><span>Digest</span><strong>{visible.payload.digest}</strong></div>
      <div className="detail-row"><span>Submitted</span><strong>{visible.payload.submitted}</strong></div>
      <div className="detail-row"><span>Anchoring</span><strong>{visible.payload.anchoring}</strong></div>
      <div className="detail-row"><span>Merchant total</span><strong>{visible.terms.amountDisplay}</strong></div>
      <div className="detail-row"><span>USDC mint</span><strong>{visible.terms.mint}</strong></div>
      <div className="detail-row"><span>Recipient</span><strong>{visible.terms.payTo}</strong></div>
      <div className="detail-row"><span>Fee payer</span><strong>{visible.spend.shopperNetworkFee === "paid by the quoted fee payer" ? visible.terms.feePayer : "Not the reviewed sponsor"}</strong></div>
      <div className="detail-row"><span>Merchant quote expires</span><strong>{merchantExpired ? "Expired" : visible.terms.expiresAt}</strong></div>
      <div className="detail-row"><span>Wallet USDC</span><strong>{visible.wallet.usdcDisplay ?? "Not read"}</strong></div>
      <div className="detail-row"><span>Wallet SOL</span><strong>{visible.wallet.solDisplay ?? "Not read"}</strong></div>
      <div className="detail-row"><span>Conversion</span><strong>{visible.conversion.status}</strong></div>
      {visible.conversion.inputDisplay && <div className="detail-row"><span>SOL input</span><strong>{visible.conversion.inputDisplay}</strong></div>}
      {visible.conversion.minimumUsdcDisplay && <div className="detail-row"><span>Minimum USDC received</span><strong>{visible.conversion.minimumUsdcDisplay}</strong></div>}
      {visible.conversion.slippageBps != null && <div className="detail-row"><span>Slippage</span><strong>{visible.conversion.slippageBps} bps</strong></div>}
      {visible.conversion.expiresAt && <div className="detail-row"><span>Conversion expires</span><strong>{conversionExpired ? "Expired" : visible.conversion.expiresAt}</strong></div>}
      <div className="detail-row"><span>SOL cap</span><strong>{visible.spend.solDisplay ?? "Not bounded"}</strong></div>
      <div className="detail-row"><span>Previous comparison</span><strong>0.008585479 SOL, not authorization</strong></div>
      <div className="detail-row"><span>SOL reserve</span><strong>0.010000000 SOL kept back</strong></div>
      <div className="detail-row"><span>Spending review</span><strong>{visible.wallet.source === "connected" && visible.readyForApproval && !expired && !unresolved ? "Spending review only. Not an approval to pay." : "Not an approval package"}</strong></div>
      <div className="detail-row"><span>Execution gate</span><strong>{executionGate === "off" ? "Off" : "On. Spending still requires this stored approval."}</strong></div>
      <div className="detail-row"><span>Recorded terms</span><strong>{serverState ? WORKFLOW_STAGE_LABELS[serverState as keyof typeof WORKFLOW_STAGE_LABELS] ?? serverState : "Not recorded"}</strong></div>
      <div className="detail-row"><span>Execution</span><strong>{executionGate === "off" ? "Unavailable" : "Gated"}</strong></div>
      <p>SOL spent on a conversion is the quoted input plus its network fees. The 0.01 SOL reserve stays outside that cap. USDC above the 1 USDC payment stays in the wallet. The 1 USDC total is not added again as SOL.</p>
      <div className="wallet-actions">
        <button className="secondary" type="button" disabled={busy || walletSource !== "connected" || !visible.readyForApproval || expired || unresolved || !visible.recovery.idempotencyKey} onClick={() => void recordTerms()}>Record these terms</button>
      </div>
      {visible.paymentPreview && <div role="status"><strong>Merchant payment preview: unsigned</strong><p>{visible.paymentPreview.detail}</p></div>}
      <p>{visible.spend.unusedUsdc}</p>
      <p>{visible.payload.retained} {visible.payload.returned}</p>
      <p>{visible.delivery.orderRead}</p>
      <p>{visible.delivery.recovery}</p>
      <p>{visible.recovery.summary}</p>
      <p>Quote validation is not simulation, signing, execution, or delivery. Stages: {visible.stages.quote}, {visible.stages.simulation}, {visible.stages.signing}, {visible.stages.execution}, {visible.stages.delivery}.</p>
      {visible.blockers.length > 0 && <ul>{visible.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}
    </article>}
    {resumed.current && <article className="path-card">
      <div className="detail-row"><span>Stored attempt</span><strong>{resumed.current.state}</strong></div>
      <div className="detail-row"><span>Recovery wallet</span><strong>{resumed.current.walletAddress}</strong></div>
      <div className="detail-row"><span>Recovery network</span><strong>Solana mainnet</strong></div>
      <div className="detail-row"><span>Payment authorization</span><strong>Not stored</strong></div>
      <p>A lost response stays on this attempt. It does not start another swap or payment.</p>
    </article>}
    <article className="path-card">
      <h3>Purchase progress</h3>
      <p>{executionGate === "off" ? EXECUTION_GATE_LABEL : "The execution gate is on. Each signature and each submission is a separate action, and only the stored attempt can move."}</p>
      <p>A conversion signature would approve one SOL to USDC swap for the reviewed input, minimum USDC, slippage, and fee. It does not pay the merchant.</p>
      <p>A merchant-payment signature is slot 1 of the sponsored 1.000000 USDC transfer. Slot 0 stays empty for the sponsor. SuperTab does not broadcast that transaction.</p>
      {purpose && <p>{purpose}</p>}
      {server?.workflow?.usdcPreserved && <div className="notice warning" role="status">Converted USDC stays in this wallet. The purchase stopped before merchant payment. Do not send another payment to recover it.</div>}
      {server?.error && <div className="notice warning" role="status">{server.error}</div>}
      <ol>
        {WORKFLOW_STAGES.map((stage) => <li key={stage}>{WORKFLOW_STAGE_LABELS[stage]}{serverState === stage ? " — current" : ""}</li>)}
      </ol>
      <div className="wallet-actions">
        <button className="secondary" type="button" disabled={busy || executionGate !== "on" || serverState !== "approved_terms"} onClick={() => void prepareSignature("prepare_swap")}>Prepare conversion signature</button>
        <button className="secondary" type="button" disabled={busy || executionGate !== "on" || !preparedTransaction || !purpose || serverState !== "swap_prepared"} onClick={() => void signPrepared("accept_swap_signature")}>Sign conversion</button>
        <button className="secondary" type="button" disabled={busy || executionGate !== "on" || serverState !== "swap_signed"} onClick={() => void submitPrepared("submit_swap")}>Submit conversion</button>
        <button className="secondary" type="button" disabled={busy || executionGate !== "on" || serverState !== "funding_rechecked"} onClick={() => void prepareSignature("prepare_payment")}>Prepare merchant payment</button>
        <button className="secondary" type="button" disabled={busy || executionGate !== "on" || !preparedTransaction || !purpose || serverState !== "payment_prepared"} onClick={() => void signPrepared("accept_payment_signature")}>Sign merchant payment</button>
        <button className="secondary" type="button" disabled={busy || executionGate !== "on" || serverState !== "payment_signed"} onClick={() => void submitPrepared("submit_payment")}>Submit merchant payment</button>
        <button className="secondary" type="button" disabled={busy || executionGate !== "on"} onClick={() => void submitPrepared("reconcile")}>Reconcile the original attempt</button>
        <button className="secondary" type="button" disabled={busy || executionGate !== "on"} onClick={() => void submitPrepared("replay_payment")}>Replay the original payment</button>
      </div>
      <p>Signing and sending stay unavailable while the gate is off. An unresolved attempt stays on this purchase. These actions do not start another swap or payment.</p>
    </article>
    <article className="path-card">
      <h3>Wallet claim, not requested</h3>
      <p>{CLAIM_REVIEW.purpose}</p>
      <p>{CLAIM_REVIEW.distinguishes}</p>
      <p>{CLAIM_REVIEW.message}</p>
      <button className="secondary" type="button" disabled>Claim signature unavailable</button>
    </article>
  </section>;
}
