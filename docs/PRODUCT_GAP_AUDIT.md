# Product gap audit — October 8, 2026

A completed retail purchase is one path: a selected retail product, a merchant-calculated final total, Solana funding, explicit approval of that exact total, a payment the provider accepts, and an order record that comes from the merchant. Separate successes do not add up to that purchase.

This audit reads the current code and the recorded evidence. It does not authorize execution. `SUPERTAB_MAINNET_EXECUTION` stays off.

## Retail

| Step | Status | Evidence |
| --- | --- | --- |
| Search and follow-up | Implemented and live-verified | `src/lib/shopping.ts`, `src/lib/gemini.ts`. Public health reports Gemini configured. Constraints stay in application code. |
| Product selection | Implemented and live-verified | `ShoppingService.review` in `src/lib/shopping.ts`. Shopify and eBay offers come from `src/lib/shopify.ts` and `src/lib/ebay.ts`. |
| Catalog or listing price | Implemented. Planning only. | `payableFromOffer` in `src/lib/offers.ts`. `approvePurchase` rejects it in `tests/domain.test.ts`. |
| Shopify final total | Implemented. Fixture-tested. One historical live read was not approvable. | `verifyCheckout` and `classifyCreatedCheckout` in `src/lib/merchant-checkout.ts`. Rejection coverage is in `tests/merchant-checkout.test.ts`: wrong variant, quantity, extra line, currency, expired time, buyer-review message, subtotal-only total, provisional discount, and a changed ready total after approval. `complete_checkout` is not called. |
| Repeatable live merchant total | Externally blocked | `docs/CHECKOUT_RESEARCH.md`. The October 3 True Classic reads were `requires_escalation`. The Bangkok API breakdown did not reconcile, and the currency was THB. No current buyer destination is stored in this audit, and none was invented for a new live call. |
| Wallet funding review | Implemented and live-verified for reads and quotes | `src/lib/funding-planner.ts`. DFlow quotes do not broadcast. Sample balances are labeled samples. |
| Purchase consent | Implemented for the verified total. Fixture-tested. | `createPurchaseIntent` and `assertPurchasePayable` in `src/lib/purchase-intent.ts`. Consent now requires the same product, variant id, currency, merchant reference, and exact reviewed amount. A connected wallet is not approval. |
| Payment authorization, capture, settlement | Not implemented for retail | `BridgeCardRail.preparePayment` in `src/lib/bridge-rail.ts` throws because financial execution is disabled. `assertPaymentCanStart` in `src/lib/card-rail.ts` refuses a rail that is not ready. |
| Merchant order | Not implemented | Retail `orderStatus` is fixed at `ORDER_NOT_CREATED` in `src/lib/shopping.ts`. |
| Refund and reconciliation | Partial. Local fixture only. | `src/lib/payment-ledger.ts` and `src/lib/payment-rehearsal.ts`. The rehearsal says `local_simulation` and uses an invented order reference. `noteUnresolvedAttempt` keeps a timeout pending and refuses a second start. A later capture or decline can still be recorded from evidence. |
| Card event bound to the approval | Fixture-tested preparation | `bindCardEventToApproval` in `src/lib/bridge-events.ts`. A Stripe issuing event cannot set an order. A missing or different amount is rejected. No live webhook was received. |

## Devnet merchant

| Step | Status | Evidence |
| --- | --- | --- |
| Owner-controlled product, payment, order, refund | Implemented and live-verified for one separate test product | Hosted worker `https://supertab-devnet-merchant.jamesbitarcade.workers.dev`. Order `e485b032-7abd-4a59-849c-f37775ec57c6` is refunded. Orders `ab0421c2-e708-40cd-b30c-a1e2a433b512` and `3518beef-1b53-4e5c-8682-0baca6b1c3fa` stayed paid. This did not buy a retail product. |
| Persistence | Implemented and checked after a worker redeploy | Durable Object ledger. Local `data/devnet-merchant.json` was not the host store. |

## Timestamp merchant

| Step | Status | Evidence |
| --- | --- | --- |
| Quote, approval terms, encrypted attempt, idempotency key | Implemented. Fixture-tested. Execution gate off. | `src/lib/digital-purchase.ts`, `src/lib/purchase-journal.ts`, `src/lib/purchase-workflow.ts`, `POST /api/digital-purchase/execute`. |
| Settlement and certificate | Not verified | `docs/PURCHASE_ROUTE.md` and `docs/PROJECT_STATE.md`. The retained payment was not replayed for this audit. A transaction signature is not an order. |

## Ranked by what blocks a completed retail purchase

1. No provider call can pay the selected retailer and return that retailer's order. Card issuance, even in sandbox, spends a card at checkout. It does not create the Shopify or eBay order. See `docs/PAYMENT_RAIL_DECISION.md`.
2. No current approvable Shopify total. The code accepts only `ready_for_complete`, reconciled USD, shipping, tax, no blocking message, and no provisional discount. The last live reads did not meet that bar.
3. Consent and funding exist only up to the verified total. There is no retail payment attempt to recover, so an unknown card outcome cannot yet be read back from a provider.

## What this pass changed

Consent rejects a different amount or variant. An unresolved ledger entry stays pending and cannot be started twice. A card event must match the approved amount and still leaves the order uncreated. No checkout was completed, no order was placed, and no payment was sent.
