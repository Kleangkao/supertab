"use client";

import { useEffect, useState } from "react";
import { reviewStillBound } from "@/lib/digital-purchase";
import type { PreparedDigitalPurchase } from "@/lib/digital-purchase-service";

export function DigitalPurchase({
  address = "",
  network = "",
  onUseReadOnly,
}: {
  address?: string;
  network?: "solana:mainnet" | "solana:devnet" | "";
  onUseReadOnly?: () => void;
}) {
  const [review, setReview] = useState<PreparedDigitalPurchase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
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

  const visible = bound ? review : null;
  const merchantExpired = !!visible && now >= Date.parse(visible.terms.expiresAt);
  const conversionExpired = !!visible?.conversion.expiresAt && now >= Date.parse(visible.conversion.expiresAt);
  const expired = merchantExpired || conversionExpired;

  async function requestQuote() {
    if (!mainnet) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/digital-purchase/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const body = await response.json() as PreparedDigitalPurchase & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The quote could not be prepared.");
      if (body.wallet.address !== address || body.wallet.network !== network) {
        throw new Error("The quote was not for the wallet now selected.");
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
    <p>{mainnet ? "Refreshing a quote does not approve a purchase, request a signature, or move funds." : network === "solana:devnet" ? "The connected wallet is not on Solana mainnet, so this review is cleared." : "Choose the read-only demo wallet or connect a wallet before requesting a quote. This panel does not ask for a signature."}</p>
    {error && <div className="notice warning" role="alert">{error}</div>}
    {visible && <article className="path-card">
      <div className="detail-row"><span>Wallet</span><strong>{visible.wallet.address}</strong></div>
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
      <div className="detail-row"><span>Spending review</span><strong>{visible.readyForApproval && !expired ? "Quote checked, still unsigned" : "Not ready"}</strong></div>
      <div className="detail-row"><span>Execution</span><strong>Unavailable</strong></div>
      <p>{visible.spend.unusedUsdc}</p>
      <p>{visible.payload.retained} {visible.payload.returned}</p>
      <p>{visible.delivery.orderRead}</p>
      <p>{visible.delivery.recovery}</p>
      <p>{visible.recovery.summary}</p>
      <p>Quote validation is not simulation, signing, execution, or delivery. Stages: {visible.stages.quote}, {visible.stages.simulation}, {visible.stages.signing}, {visible.stages.execution}, {visible.stages.delivery}.</p>
      {visible.blockers.length > 0 && <ul>{visible.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}
    </article>}
  </section>;
}
