"use client";

import Link from "next/link";
import { useState } from "react";
import { MerchantOrderRecord } from "@/components/merchant-order-record";
import type { DevnetMerchantOrder } from "@/lib/devnet-merchant-client";
import { fetchDevnetMerchantOrder } from "@/lib/devnet-merchant-client";
import { VERIFIED_DEVNET_ORDER_ID } from "@/lib/devnet-checkout-guidance";
import { recordedTeeQuote } from "@/lib/recorded-merchant-quote";

export function PrototypePaths({ compact = false }: { compact?: boolean }) {
  const quote = recordedTeeQuote;
  const [order, setOrder] = useState<DevnetMerchantOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function viewVerifiedOrder() {
    setBusy(true);
    setError(null);
    try {
      setOrder(await fetchDevnetMerchantOrder(VERIFIED_DEVNET_ORDER_ID));
    } catch (caught) {
      setOrder(null);
      setError(caught instanceof Error ? caught.message : "The merchant order could not be read.");
    } finally {
      setBusy(false);
    }
  }

  const body = <div className="path-grid">
    <article className="path-card" aria-label="Real product quote only">
      <p className="eyebrow">REAL PRODUCT — QUOTE ONLY</p>
      <h3>{quote.title}</h3>
      <p>{quote.merchant} · {quote.variant} · quantity {quote.quantity}</p>
      <p>Checked {quote.checkedOn}. Destination scope: {quote.destinationScope}. This is the quote recorded that day, not a live total.</p>
      <div className="detail-row"><span>Item</span><strong>{quote.item}</strong></div>
      <div className="detail-row"><span>{quote.shippingName} shipping</span><strong>{quote.shipping}</strong></div>
      <div className="detail-row"><span>Displayed tax</span><strong>{quote.displayedTax}</strong></div>
      <div className="detail-row"><span>Merchant total that day</span><strong>{quote.merchantTotal}</strong></div>
      <div className="detail-row"><span>Visible USDC option that day</span><strong>{quote.visibleUsdcOption}</strong></div>
      <div className="detail-row"><span>Estimated delivery</span><strong>{quote.estimatedDelivery}</strong></div>
      <div className="detail-row"><span>Duties</span><strong>{quote.duties}</strong></div>
      <div className="detail-row"><span>Network fees</span><strong>{quote.networkFees}</strong></div>
      <p>SuperTab cannot refresh this quote. The store is not on the Shopify checkout allowlist, and no quote call is made from here. Open the merchant and calculate a new total there.</p>
      <p>Opening the merchant does not submit an address, connect a wallet, approve a purchase, or pay. Payment, approval, funding, and signing stay unavailable from this record.</p>
      <div className="wallet-actions">
        <a className="secondary" href={quote.freshQuoteUrl} target="_blank" rel="noreferrer">Open Solana Spaces for a fresh quote</a>
      </div>
      <details className="review-details">
        <summary>Limits of this evidence</summary>
        <ul>
          <li>No payment or order was submitted on {quote.checkedOn}.</li>
          <li>Duties and network fees were not verified, so this is not a landed cost.</li>
          <li>The devnet test order did not buy this shirt.</li>
        </ul>
      </details>
    </article>
    <article className="path-card" aria-label="Devnet test purchase">
      <p className="eyebrow">DEVNET TEST PURCHASE</p>
      <h3>Devnet test marker</h3>
      <p>This is a separate owner-controlled product. It is not the Just Build It Tee, and paying it does not buy the shirt.</p>
      <p>On the devnet page: connect Phantom on Solana devnet, review the merchant checkout, approve that total, sign, then send. The merchant confirms the order. A refund returns that test payment. Each of those actions asks before it signs or sends.</p>
      <p>The USDC amount is the test merchant’s price. Devnet SOL pays the network fee separately and does not change the USDC total.</p>
      <div className="wallet-actions">
        <Link className="secondary" href="/devnet">Open devnet test purchase</Link>
        <button className="secondary" type="button" disabled={busy} onClick={() => void viewVerifiedOrder()}>View verified test order</button>
      </div>
      <p>View verified test order reads merchant order {VERIFIED_DEVNET_ORDER_ID}. It does not sign, send, or create a checkout.</p>
      {error && <div className="notice warning" role="alert">{error}</div>}
      {order && <MerchantOrderRecord order={order} heading="Merchant record" />}
      <details className="review-details">
        <summary>What a new checkout would do</summary>
        <p>A new checkout is another 1.000000 devnet USDC payment. It does not recover an existing payment. Use it only when you intend to pay again.</p>
      </details>
    </article>
  </div>;

  if (compact) {
    return <details className="prototype-paths">
      <summary>Prototype paths · real quote or devnet test</summary>
      {body}
    </details>;
  }

  return <section className="prototype-paths" aria-label="Prototype paths">
    <p className="eyebrow">PROTOTYPE</p>
    <h2>Two ways to look at the evidence.</h2>
    <p>Choose a recorded retail quote, or the separate devnet purchase. Neither path spends mainnet funds.</p>
    {body}
  </section>;
}
