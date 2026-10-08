"use client";

import { useState } from "react";
import type { PurchaseView } from "@/lib/view";

const EMPTY = { email: "", firstName: "", lastName: "", streetAddress: "", line2: "", city: "", region: "", postalCode: "", country: "", discountCode: "" };

export function CheckoutReview({ purchase, now, busy, merchantUrl, onVerify, onCalculate, onApprove }: {
  purchase: PurchaseView; now: number; busy: boolean; merchantUrl: string | null;
  onVerify: (checkoutId: string) => Promise<unknown>;
  onCalculate: (destination: typeof EMPTY) => Promise<unknown>;
  onApprove: () => Promise<unknown>;
}) {
  const [reference, setReference] = useState("");
  const [destination, setDestination] = useState(EMPTY);
  const verification = purchase.checkoutVerification;
  const expired = !!verification.expiresAt && now >= Date.parse(verification.expiresAt);
  const verified = verification.status === "verified" && !expired;
  const calculated = verification.status === "calculated" && !expired;
  const stated = verification.status === "stated" && !expired;
  const approved = verified && purchase.purchaseApproval === "approved";
  const field = (key: keyof typeof EMPTY, label: string, type = "text") => <label>{label}<input type={type} autoComplete="off" value={destination[key]} maxLength={key === "streetAddress" ? 200 : key === "email" ? 254 : 80} disabled={busy} onChange={event => setDestination(current => ({ ...current, [key]: event.target.value }))} /></label>;
  return <section className="checkout-verification" aria-label="Merchant checkout total">
    <div className="notice subtle">
      <strong>{verified ? "Final merchant total verified" : calculated ? "Merchant calculated this total" : stated ? "Merchant stated an amount that is not a funding total" : expired ? "Merchant total needs a fresh check" : "Final checkout total unknown"}</strong>
      <p>{expired ? "The previous checkout evidence expired. Ask the merchant to calculate the current destination again before approving." : verification.message}</p>
      {(verified || calculated) && <><p className="checkout-total">{purchase.checkout.merchantTotalDisplay}</p><small>{calculated ? "Shipping, tax and merchant discounts are included. This can still change, so purchase approval stays closed." : `Read from ${verification.merchantOrigin} · valid for ${Math.max(0, Math.ceil((Date.parse(verification.expiresAt!) - now) / 60_000))} min`}</small></>}
      {purchase.merchantStatement && <div>
        <p>Merchant-stated {purchase.merchantStatement.currency} checkout · {purchase.merchantStatement.status} · {purchase.merchantStatement.reconciled ? "breakdown matches the total" : `breakdown does not match the total by ${purchase.merchantStatement.gapDisplay}`}</p>
        <p>Subtotal {purchase.merchantStatement.subtotalDisplay} · Shipping {purchase.merchantStatement.shippingDisplay ?? "not returned"} · Tax {purchase.merchantStatement.taxDisplay ?? "not returned"} · Duty {purchase.merchantStatement.dutyDisplay ?? "not returned"} · Discounts {purchase.merchantStatement.discountDisplay ?? "not returned"} · Total {purchase.merchantStatement.totalDisplay}</p>
        {purchase.merchantStatement.deliveryMethod && <p>Delivery method returned: {purchase.merchantStatement.deliveryMethod}</p>}
        {purchase.merchantStatement.missingCodes.length > 0 && <p>Still required by the merchant: {purchase.merchantStatement.missingCodes.join(", ")}</p>}
      </div>}
      {merchantUrl && <p><a className="merchant-handoff" href={merchantUrl} target="_blank" rel="noopener noreferrer">Check price &amp; delivery</a></p>}
      <p>You’ll review checkout at the merchant. Opening it sends no payment.</p>
      <details className="review-details"><summary>About retail payments</summary>
        <p>SuperTab does not submit payment or place an order at the merchant.</p>
        <p>Order not created.</p>
        <p>Payment not executed.</p>
      </details>
      {verification.readAvailable && <form className="checkout-reference-form" onSubmit={event => {
        event.preventDefault();
        void onCalculate(destination).then(() => setDestination(EMPTY)).catch(() => undefined);
      }}>
        <p>The merchant calculates shipping, tax and discounts. Enter the real delivery destination. SuperTab sends it only for this pricing request, does not store it in the review, and does not pay.</p>
        {field("email", "Email", "email")}
        {field("firstName", "First name")}
        {field("lastName", "Last name")}
        {field("streetAddress", "Street address")}
        {field("line2", "Address line 2")}
        {field("city", "City")}
        {field("region", "Region")}
        {field("postalCode", "Postal code")}
        {field("country", "Country code")}
        {field("discountCode", "Discount code, if you have one")}
        <button className="secondary" disabled={busy}>Ask the merchant to calculate the total</button>
      </form>}
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
