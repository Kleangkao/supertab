# Payment rail decision — October 8, 2026

Checked against Bridge’s public docs on this date. No account was created. No sandbox or production request was sent. Production `api.bridge.xyz` stays refused in `src/lib/bridge-rail.ts`.

## Decision

Bridge plus Stripe Issuing can issue a stablecoin-backed card and let that card be used like a normal card. It cannot, by itself, place a Shopify or eBay order or return that merchant’s order id. SuperTab does not have the sandbox access this path requires. No sandbox vertical slice was implemented. A fixture that returns a successful merchant payment would be a false success.

## What the provider supports

| Piece | What Bridge documents | What it is not |
| --- | --- | --- |
| Card issuance | Bridge customer KYC, then Stripe Issuing card creation. Sandbox uses Solana Devnet for a noncustodial wallet, or a simulated Bridge wallet. | A merchant order. |
| Spending | The card is used in a normal e-commerce checkout. Authorization pulls wallet funds just in time. | An API that pays an arbitrary catalog item and creates that store’s order. |
| Authorization and capture | Stripe `issuing_authorization.*` and `issuing_transaction.created`. Capture can exceed the original authorization. | Proof the retailer accepted an order. |
| Refund | An authorization update or a refund transaction returns funds onchain. It can be batched. | The retailer’s refund record. |
| Reconciliation | Read card transactions from the Bridge card API, or receive Stripe issuing webhooks. Bridge `POST` calls use an `Idempotency-Key` for 24 hours. | A Shopify order id or an eBay order id. |
| Webhooks | Card events come from Stripe. Bridge webhooks cover customer and KYC. Generic sandbox does not fire payment webhooks. Card sandbox testing is a separate Stripe sandbox flow. | A signature on a SuperTab order. |

Sources, fetched October 8, 2026:

- https://apidocs.bridge.xyz/get-started/guides/cards/spend.md
- https://apidocs.bridge.xyz/platform/cards/overview/webhooks.md
- https://apidocs.bridge.xyz/platform/cards/sandbox/sandbox.md
- https://apidocs.bridge.xyz/get-started/introduction/quick-start/setting-up-sandbox.md
- https://apidocs.bridge.xyz/api-reference/introduction/idempotence.md
- https://apidocs.bridge.xyz/api-reference/cards/retrieve-card-transactions.md

## Account and access blockers

All of these are missing:

1. A Bridge developer account. Sandbox keys require contacting support@bridge.xyz. Only a dashboard admin can create a key. The earlier dashboard sign-in did not return a key. `BRIDGE_API_KEY` is unset, so `bridgeAccess` stays `sandbox_blocked`.
2. A Stripe Sandbox account with the Bridge Cards Stripe app installed, then `POST /v0/cards/enable` on `api.sandbox.bridge.xyz`.
3. A customer who receives the `cards` endorsement. Sandbox KYC can be simulated only after the key exists. That still does not pay a retailer.
4. A card account funded on Solana Devnet or a Bridge sandbox wallet. Issuing the card is not the retail purchase.
5. A merchant checkout that is `ready_for_complete` for the selected variant, quantity, USD total, shipping, and tax. The card would then be entered at that merchant by a person. SuperTab must not store the PAN or CVV.

## Smallest next step

After the owner has a Bridge sandbox key and a connected Stripe sandbox, the first real call is read-only: authenticate to `https://api.sandbox.bridge.xyz` and read the card-program or customer state. Do not provision a card, simulate an authorization, or enter card details until that read succeeds and the owner asks for the next step.

Until then, the local contract is:

- `preparePayment` stays disabled.
- `bindCardEventToApproval` accepts only an issuing event whose amount matches the approved total, and it leaves the order uncreated.
- `noteUnresolvedAttempt` records a timeout as pending. It does not mark success or decline, and it refuses another start.

## Distinctions

- Card issuance creates a card account. It does not buy the selected product.
- Merchant checkout is Shopify `create_checkout` or `get_checkout`. `complete_checkout` would place an order and is not called.
- Payment processing is the card network authorization and capture. Bridge documents that as Stripe issuing events plus an onchain pull.
- Order creation is the retailer’s own order. None of the Bridge card responses above supply it.
