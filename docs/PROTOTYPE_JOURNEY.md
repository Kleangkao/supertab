# Prototype journey — October 9, 2026

Original goal: a shopper describes a product → SuperTab finds and compares real offers → checks Solana wallet funding → reviews final purchase terms → obtains explicit approval → converts assets when needed → pays the merchant → receives verified order evidence → can track or recover the outcome.

Shopping search and merchant handoff are portions of that journey, not a replacement product definition.

## Stage classification

| Stage | Classification | Notes |
| --- | --- | --- |
| Describe product | Live and verified | Gemini configured on production; deterministic fallback exists |
| Find and compare offers | Live and verified | Shopify/eBay, shortlist, structured comparison |
| Check Solana funding | Live for reads/quotes; signing not live | Balances and DFlow quotes; production swap signing disabled |
| Review final purchase terms | Implemented; live retail total not repeatably verified | Authenticated checkout pricing code exists; often blocked by provider access |
| Explicit purchase approval | Implemented; fixture-tested | Bound to exact product/variant/currency/amount; unavailable without verified total |
| Convert assets | Implemented quotes; execution gated off | Unsigned preparation can be format-checked; financial gate refuses execute |
| Pay the merchant | Provider-blocked; local simulation available | Card rail not connected; rehearsal is `local_simulation` only |
| Verified order evidence | Provider-blocked for retail; simulated and historical exist | Simulated order fixture is not a retailer order; refunded/paid devnet orders are a separate product |
| Track / recover | Implemented for local ledger/pending rules | Pending payment ≠ missing order; unresolved attempt refuses a second start |

## UI connections (this pass)

- Purchase review opens with a journey map derived from the live `PurchaseView`.
- The goal headline stays “AI shopping that uses Solana assets to complete purchases,” with a nearby prototype-limit note that retail payment and merchant order completion are unavailable.
- Badges mean capability or current read status, not that the shopper finished that stage. Sample balances are `simulated`. Funding quotes use `quoteFreshness === "live"`.
- Live payment/order statuses remain on the card-rail panel.
- Local rehearsal shows simulated and live statuses side by side, binds to `termsId`, and resets when product/quantity/terms change.
- A lost-response pending state can receive late fixture authorization or decline evidence without starting a second payment or creating an order.
- Historical quote/devnet evidence is collapsed away from the primary shopping composer.
- Intro copy names discover → fund → approve → complete without claiming retail payment works.
- Shortlist items are dated browser snapshots, not live merchant totals.

## What this is not

A continuous independently verified retail purchase has not been completed. Do not present the labeled simulation or the owner-controlled devnet refund as payment for the selected retailer.
