"use client";

import { useEffect, useState } from "react";
import type { PreparedDigitalPurchase } from "@/lib/digital-purchase-service";

export function DigitalPurchase({ suggestedAddress = "" }: { suggestedAddress?: string }) {
  const [review, setReview] = useState<PreparedDigitalPurchase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!review) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [review]);

  const expired = !!review && now >= Date.parse(review.terms.expiresAt);

  async function requestQuote() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/digital-purchase/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: suggestedAddress }),
      });
      const body = await response.json() as PreparedDigitalPurchase & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The quote could not be prepared.");
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
    <p className="eyebrow">PREPARED PURCHASE — NOT PAID</p>
    <h2>A Bitcoin Anchor, quantity 1.</h2>
    <p>SCVD General Store sells this as a one-time digital timestamp. SuperTab can request the Solana USDC quote. It cannot sign or send it.</p>
    <div className="wallet-actions">
      <button className="secondary" type="button" disabled={busy} onClick={() => void requestQuote()}>
        {busy ? "Requesting the merchant quote…" : "Request fresh quote"}
      </button>
    </div>
    <p>{suggestedAddress ? "The balance read uses the wallet selected for this page and does not print the address here." : "No wallet is selected, so this quote will not compare a balance."}</p>
    {error && <div className="notice warning" role="alert">{error}</div>}
    {review && <article className="path-card">
      <div className="detail-row"><span>Merchant</span><strong>{review.terms.merchant}</strong></div>
      <div className="detail-row"><span>Product</span><strong>{review.terms.productName}</strong></div>
      <div className="detail-row"><span>Quantity</span><strong>{review.terms.quantity}</strong></div>
      <div className="detail-row"><span>Network</span><strong>Solana mainnet</strong></div>
      <div className="detail-row"><span>USDC mint</span><strong>{review.terms.mint}</strong></div>
      <div className="detail-row"><span>Merchant total</span><strong>{review.terms.amountDisplay}</strong></div>
      <div className="detail-row"><span>Quote expires</span><strong>{expired ? "Expired" : review.terms.expiresAt}</strong></div>
      <div className="detail-row"><span>Merchant recipient</span><strong>{review.terms.payTo}</strong></div>
      <div className="detail-row"><span>Fee payer</span><strong>Quoted sponsor pays the merchant-payment network fee</strong></div>
      <div className="detail-row"><span>Wallet USDC</span><strong>{review.wallet.usdcDisplay ?? "Not read"}</strong></div>
      <div className="detail-row"><span>Wallet SOL</span><strong>{review.wallet.solDisplay ?? "Not read"}</strong></div>
      <div className="detail-row"><span>Conversion</span><strong>{review.conversion.status}</strong></div>
      {review.conversion.inputDisplay && <div className="detail-row"><span>Conversion input</span><strong>{review.conversion.inputDisplay}</strong></div>}
      {review.conversion.minimumUsdcDisplay && <div className="detail-row"><span>Minimum USDC received</span><strong>{review.conversion.minimumUsdcDisplay}</strong></div>}
      {review.conversion.slippageBps != null && <div className="detail-row"><span>Slippage</span><strong>{review.conversion.slippageBps} bps</strong></div>}
      <div className="detail-row"><span>Proposed SOL cap</span><strong>{review.spend.solDisplay ?? "Not bounded"}</strong></div>
      <div className="detail-row"><span>Ready for approval</span><strong>{review.readyForApproval && !expired ? "Yes, still unsigned" : "No"}</strong></div>
      <p>{review.delivery.method} {review.delivery.thailand}</p>
      <p>{review.delivery.orderRead}</p>
      <p>{review.delivery.refund}</p>
      <p>{review.spend.unusedUsdc}</p>
      {review.blockers.length > 0 && <ul>{review.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}
      <p>Signing and sending stay unavailable. A later approval has to name this product and the spending cap shown here.</p>
    </article>}
  </section>;
}
