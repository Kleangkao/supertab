# SuperTab project state

Updated October 4, 2026.

## Fixed product goal

Help a shopper buy a normal online product using supported assets from their Solana wallet.

A completed purchase connects a selected product, a verified complete payable total, explicit buyer approval, a wallet-funded payment, and a merchant-confirmed order.

USDC is the first supported asset. SOL conversion comes after a purchase route works. One failed provider request does not prove that every route is impossible.

## Current milestone

Milestone 1 is complete. The owner-controlled devnet merchant demonstrated payment, order confirmation, failure recovery, and refund. Failure recovery and the late-payment rules were exercised with fixtures. The payment, order, and refund were also exercised once on devnet.

This milestone does not prove that an existing retailer accepts Solana, and it does not prove a real purchase. Milestone 2 still needs a participating merchant.

Acceptance for the local half:

- The merchant owns checkout, validation, and the order.
- SuperTab requests the checkout and reads the order.
- The checkout binds the test product, quantity 1, the full price, Circle's devnet USDC mint, the recipient, a unique reference, and an expiry.
- Wrong amount, mint, recipient, and reference do not create an order.
- One payment cannot fulfill two orders.
- A repeated confirmation returns the same order.
- A valid payment whose order write fails can be recovered.
- A matching payment during the 24-hour late window is marked late.
- A later payment is stored and does not create an order.
- A refund is marked only after the return transfer matches.

## Completed evidence

LOCAL. `npx vitest run tests/devnet-merchant.test.ts` passed 7 tests. The test product is `devnet-test-marker`: item 500000, shipping 200000, tax 300000, total 1000000 minor units. The mint in that test is Circle's published Solana devnet USDC mint. The chain responses are fixtures, not broadcast transactions.

LOCAL. `tests/devnet-broadcast.test.ts` covers the unbroadcast runner. A `jsonParsed` transfer verifies only after `uiTokenAmount` is copied onto the balance. A payer with no SOL, and a payer with SOL but no USDC, never reach `send`. A mocked funded chain creates the missing merchant token account, confirms one order, and refunds it. Associated-token addresses for the payer and merchant wallets match `@solana/web3.js` 1.99 `findProgramAddressSync`. That package is not a dependency.

DEVNET. `getAccountInfo` for `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` on `https://api.devnet.solana.com` returned owner `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`, space 82, and decimals 6. Source for the address: https://developers.circle.com/stablecoins/usdc-contract-addresses.

DEVNET. The generated payer held 5 SOL and 20 Circle devnet USDC. One run created the merchant token account, paid the posted 1.000000 USDC, and refunded that exact amount.

- Token account: `2oFqoLXKfSmbxHEhizpp7TVTC8GeYfZEBX3ag47UczyfX7xYjyVcB23keAqgjXKb3L26tWxm9bPgFGydEsfKCBP7`, slot 507317703.
- Payment: `3kQNnZbAXi4CTuXkatAQoRG3ayp6mVjgpwRViAMEKTXDoabra5YnFyT7Wpbc3GCbxnktggiyT8MWY4N6htZivrM9`, slot 507317970. Payer balance 20000000 to 19000000. Merchant balance 0 to 1000000. Mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, decimals 6. Memo `d12a29a5-1e41-4f03-a88e-98aeba76c7bf`.
- The merchant validated that transfer and created order `6359fb8a-17c0-4243-813b-6c92ed9df309`.
- Refund: `62Nwju2eZ8kRThBK7qJtq2ZfzKjpko9aonyUVQ9gFkJtioeXH7mG2jyij58b6Gpj4zbjv2LmARXk3JSMAXy52EuC`, slot 507317976. Merchant balance 1000000 to 0. Payer balance 19000000 to 20000000. The memo is the order id. The order was marked refunded only after that return matched.

At slot 507318056 the payer again held 20000000 USDC and the merchant token account held 0. This is the owner-controlled devnet merchant. It is not an order from another retailer.

DEVNET. SuperTab then read that same payment through the merchant. No new transaction was sent. The merchant restored the checkout from reference `rEfeqQyovPmPeCR8ByUHkmaxDajMFXps4FtBF8e52XT` and refund reference `E8Ry1AdVcxfLgMFw3obnkxhtsutHLSZP9GXLK8xrVxME`. A read before validation returned no order. SuperTab submitted the existing payment signature, and the merchant returned order `d0f4cec6-8265-4058-bc86-23f4b2f1dfeb`: total 1000000, Circle devnet USDC, settlement late, and the same payment signature. Submitting that signature again returned the same order. After the merchant checked the existing refund signature, SuperTab's read returned status refunded with refund signature `62Nwju2eZ8kRThBK7qJtq2ZfzKjpko9aonyUVQ9gFkJtioeXH7mG2jyij58b6Gpj4zbjv2LmARXk3JSMAXy52EuC`. This order id differs from `6359fb8a-17c0-4243-813b-6c92ed9df309` because the first record stayed in memory. Both records are the same transfer.

## Failed hypotheses

Reconsider only with new evidence. Do not repeat the same calls.

| Hypothesis | Result | Reconsider when |
| --- | --- | --- |
| Crossmint can create a Shopify order with this staging key | HTTP 500, Shopify unavailable. Docs no longer list that locator. | Crossmint documents `shopify:` again or answers the unsent support note. |
| Crossmint can quote the documented Amazon ASIN with Solana USDC | HTTP 500 wrapping Amazon Business `getProductsByAsins` 403. No order id. | The same staging project can read that ASIN, and a real US shipping address is available. |
| Helio can show a Solana Pay order for True Classic | No plugin on that checkout. Paylink read returned 401. | A participating merchant grants a Helio credential that can read `ShopifyPaymentGid`. |
| Catalog client credentials own True Classic or can install an app | They are checkout-read credentials, not store admin. | The owner controls the store or the merchant installs the app. |
| The live True Classic checkout credential can read an order or pay with Solana | `tools/list` includes `get_order` and `complete_checkout`. `get_order` for `gid://shopify/Order/0` returned `orders_not_allowed`: missing `read_global_api_orders`. The `complete_checkout` schema does not mention Solana. Its instrument funding sources are debit, credit, prepaid, and store, and the named handler is Apple Pay with type `card`. | The store's checkout schema gains a Solana handler, and a credential with `read_global_api_orders` can read an order this agent actually placed. |
| Bitrefill buys the selected product | It sells a gift card or top-up and needs an account key. | The owner accepts that substitution and supplies a key. |
| Coinbase Business Checkouts spend shopper Solana USDC | The documented checkout network is Base. | Coinbase documents Solana for that checkout and a third-party order. |
| Public devnet airdrop and Circle's faucet can fund a transfer from this session | Airdrop returned JSON-RPC 429. The faucet returned `RECAPTCHA_ERROR`. The owner later funded the payer outside this session. | Do not repeat those calls. The funded purchase has already run. |

## Remaining blocker

Milestone 1 is complete for the owner-controlled devnet merchant. Milestones 2 and 3 are not. A real purchase still needs a participating merchant or a legitimate intermediary. Catalog credentials, a wallet signature, and this devnet order do not supply that access.

- Payer: `3cZQhK76SC4ve12WjNcugVi7z1SgQgxY4dpbNtsoon6M`
- Merchant wallet: `8rXZ9KFzc3NCMMvNdyfJ5irvHnTWYYGLqPJY5WuMuwmZ`

## Next useful action

Choose a merchant whose checkout accepts the shopper's Solana USDC and whose order read is available to SuperTab. Adding `read_global_api_orders` to the current True Classic credential does not add a Solana payment handler. Do not call `complete_checkout`, start another provider survey, or broadcast another devnet payment.
