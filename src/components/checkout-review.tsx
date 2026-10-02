"use client";

import { useState } from "react";
import type { PurchaseView } from "@/lib/view";

export function CheckoutReview({ purchase, now, busy, merchantUrl, onVerify, onApprove }: {
  purchase: PurchaseView; now: number; busy: boolean; merchantUrl: string | null;
  onVerify: (checkoutId: string) => Promise<unknown>; onApprove: () => Promise<unknown>;
}) {
  const [reference, setReference] = useState("");
  const verification = purchase.checkoutVerification;
  const expired = !!verification.expiresAt && now >= Date.parse(verification.expiresAt);
  const verified = verification.status === "verified" && !expired;
  const approved = verified && purchase.purchaseApproval === "approved";
  return <section className="checkout-verification" aria-label="Merchant checkout total">
    <div className="notice subtle">
      <strong>{verified ? "Final merchant total verified" : expired ? "Merchant total needs a fresh check" : "Final checkout total unknown"}</strong>
      <p>{expired ? "The previous checkout evidence expired. Verify the merchant’s current terms before approving." : verification.message}</p>
      {verified && <><p className="checkout-total">{purchase.checkout.merchantTotalDisplay}</p><small>Read from {verification.merchantOrigin} · valid for {Math.max(0, Math.ceil((Date.parse(verification.expiresAt!) - now) / 60_000))} min</small></>}
      {merchantUrl && <p><a href={merchantUrl} target="_blank" rel="noopener noreferrer">Review delivery and price at the merchant ↗</a></p>}
      <p>Opening the merchant page does not approve a purchase. SuperTab does not submit payment or place an order.</p>
      {verification.readAvailable && <details className="review-details"><summary>Read an existing merchant checkout</summary>
        <p>Use the checkout reference supplied by the merchant integration after you have reviewed delivery details. SuperTab reads the total; it never completes the checkout.</p>
        <form onSubmit={event => { event.preventDefault(); void onVerify(reference).then(() => setReference("")); }} className="checkout-reference-form">
          <label htmlFor="merchant-checkout-reference">Merchant checkout reference</label>
          <input id="merchant-checkout-reference" type="password" autoComplete="off" value={reference} maxLength={2048}
            onChange={event => setReference(event.target.value)} disabled={busy} placeholder="Merchant-provided checkout ID" />
          <button className="secondary" disabled={busy || !reference.trim()}>Verify merchant total</button>
        </form>
      </details>}
      {verified && <div className="checkout-approval">
        <button className="secondary" disabled={busy || approved} onClick={() => void onApprove()}>
          {approved ? "Purchase terms approved" : `Approve purchase terms · ${purchase.checkout.merchantTotalDisplay}`}
        </button>
        <p>{approved ? "Your approval covers only these current product and price terms. It expires with checkout verification. No money has moved." : "This records your approval of this exact product and final amount. Wallet signing and payment are separate steps."}</p>
      </div>}
    </div>
  </section>;
}
