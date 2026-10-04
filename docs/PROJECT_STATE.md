# SuperTab project state

Updated October 4, 2026.

## Fixed product goal

Help a shopper buy a normal online product using supported assets from their Solana wallet.

A completed purchase connects a selected product, a verified complete payable total, explicit buyer approval, a wallet-funded payment, and a merchant-confirmed order.

USDC is the first supported asset. SOL conversion comes after a purchase route works. One failed provider request does not prove that every route is impossible.

## Current milestone

Engineering proof: an owner-controlled devnet merchant demonstrates payment, order confirmation, failure recovery, and refund.

This milestone does not prove that an existing retailer accepts Solana, and it does not prove a real purchase.

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

DEVNET. At slot 507286765 the payer still had 0 lamports and no USDC token account. The live runner returned `blocked` before `sendTransaction`. No devnet payment, order, or refund exists.

## Failed hypotheses

Reconsider only with new evidence. Do not repeat the same calls.

| Hypothesis | Result | Reconsider when |
| --- | --- | --- |
| Crossmint can create a Shopify order with this staging key | HTTP 500, Shopify unavailable. Docs no longer list that locator. | Crossmint documents `shopify:` again or answers the unsent support note. |
| Crossmint can quote the documented Amazon ASIN with Solana USDC | HTTP 500 wrapping Amazon Business `getProductsByAsins` 403. No order id. | The same staging project can read that ASIN, and a real US shipping address is available. |
| Helio can show a Solana Pay order for True Classic | No plugin on that checkout. Paylink read returned 401. | A participating merchant grants a Helio credential that can read `ShopifyPaymentGid`. |
| Catalog client credentials own True Classic or can install an app | They are checkout-read credentials, not store admin. | The owner controls the store or the merchant installs the app. |
| Bitrefill buys the selected product | It sells a gift card or top-up and needs an account key. | The owner accepts that substitution and supplies a key. |
| Coinbase Business Checkouts spend shopper Solana USDC | The documented checkout network is Base. | Coinbase documents Solana for that checkout and a third-party order. |
| Public devnet airdrop and Circle's faucet can fund a transfer from this session | Airdrop returned JSON-RPC 429. The faucet returned `RECAPTCHA_ERROR`. | The payer address below holds devnet SOL and Circle devnet USDC. |

## Remaining blocker

The on-chain half of milestone 1 needs devnet SOL and Circle devnet USDC. Generated keys are in gitignored `merchant/secrets/devnet-keys.json`.

- Payer: `3cZQhK76SC4ve12WjNcugVi7z1SgQgxY4dpbNtsoon6M`
- Merchant wallet: `8rXZ9KFzc3NCMMvNdyfJ5irvHnTWYYGLqPJY5WuMuwmZ`

The runner is `executeDevnetPurchase`. It reads the payer balance and both token accounts, and it returns before `sendTransaction` when SOL or Circle devnet USDC is missing.

Owner action: fund the payer from https://faucet.solana.com and https://faucet.circle.com with Solana devnet SOL and Solana devnet USDC. Do not send mainnet assets. That unlocks the same runner: create the missing token account, broadcast the reviewed 1 USDC payment, read the merchant order from the confirmed transaction, and broadcast the matching refund.

## Next useful action

When those balances exist, run the funded devnet purchase once. Until then, do not start another provider survey.
