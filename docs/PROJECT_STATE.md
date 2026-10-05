# SuperTab project state

Updated October 5, 2026.

## Fixed product goal

Help a shopper buy a normal online product using supported assets from their Solana wallet.

A completed purchase connects a selected product, a verified complete payable total, explicit buyer approval, a wallet-funded payment, and a merchant-confirmed order. That has not happened with an unrelated retailer.

## Completed evidence

LOCAL FIXTURES. On October 5, 2026, `npx vitest run` passed 129 tests and skipped 5. Three test files were skipped. `tests/devnet-merchant.test.ts` restarts a JSON store, returns the same order id and refund status, rejects reuse of that payment on another checkout, and creates one order when recovery runs after a failed order write. It also accepts one buyer-signed versioned refund, co-signs the devnet merchant once, and does not broadcast a changed refund. `tests/devnet-payment.test.ts` blocks a wallet signature until the connected devnet account approves that exact checkout. `tests/payment-message.test.ts` and `tests/wallet-standard.test.ts` accept an equivalent legacy or version-0 payment with reordered accounts and reject a changed amount, privilege, payer, blockhash, trailing bytes, or an added instruction. These are fixtures, not broadcast transactions.

DEVNET READS, OCTOBER 5. One `getGenesisHash` to the public devnet endpoint returned HTTP 429, "Connection rate limits exceeded." No further public calls were made. `SOLANA_RPC_URL` is empty and is not used for this checkout. `SOLANA_DEVNET_RPC_URL` in gitignored `.env.local` points at an existing Alchemy devnet host. One genesis read returned HTTP 200 and the devnet genesis hash `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`. The merchant logged that host, not the credential, and `GET /product` returned 200. A checkout for 1000000 minor units returned a 384-byte unsigned transaction. It was not signed or broadcast. Public address `JCVsKd4TMg1fvEs7rjf5YgLYbJfNC8Dwb4x1PchFkGM7` had 7228922720 lamports and 21000000 minor units of mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` on a later read the same day. No private key was read.

SHOPPER DEVNET PAYMENT, OCTOBER 5. Order `ab0421c2-e708-40cd-b30c-a1e2a433b512` is paid and on time for checkout `bce4b6b2-5edb-4c16-aace-baaa09d7eabb`. The only signer is `JCVsKd4TMg1fvEs7rjf5YgLYbJfNC8Dwb4x1PchFkGM7`. Signature `zEZtNjR1hDgCnqPDNoTmKHu9xrK2igdyF6WkkXVNRPnrJj1w4tCz8xQWjUFEYMQGsPP8iTNDmGopC9XaMvefqLR` at slot 507677917 has no chain error. It is a legacy transaction with two ComputeBudget instructions and one `transferChecked` of 1000000 minor units of mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` from that buyer to merchant recipient `8rXZ9KFzc3NCMMvNdyfJ5irvHnTWYYGLqPJY5WuMuwmZ`. The memo is the checkout id and the payment reference is `7wAggtKMZb7kgrXsM7So7vwD9vcEryWAKhgVBtDrzKJ8`. The network fee was 80000 lamports. SuperTab read the same order through `GET /api/devnet-merchant/order`. After the merchant process was restarted, that order id was still paid. Submitting the same signature again returned the same order. Submitting it for checkout `b3066a50-5214-4971-a541-291ba03004be` returned HTTP 400, "This signature already belongs to another checkout." No second order was created. The refund has not been sent.

DEVNET, OCTOBER 4, NOT IMPORTED. One generated-payer payment and matching refund were broadcast: payment `3kQNnZbAXi4CTuXkatAQoRG3ayp6mVjgpwRViAMEKTXDoabra5YnFyT7Wpbc3GCbxnktggiyT8MWY4N6htZivrM9` at slot 507317970, and refund `62Nwju2eZ8kRThBK7qJtq2ZfzKjpko9aonyUVQ9gFkJtioeXH7mG2jyij58b6Gpj4zbjv2LmARXk3JSMAXy52EuC` at slot 507317976. The amount was 1000000 minor units of Circle devnet USDC, mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. Order ids `6359fb8a-17c0-4243-813b-6c92ed9df309` and `d0f4cec6-8265-4058-bc86-23f4b2f1dfeb` were that same transfer recorded twice in memory. They were not copied into the durable store, and the old checkout was not reconstructed.

LOCAL PROCESS. From `supertab-main`, `npm run merchant` loads `.env.local` and listens on `127.0.0.1:8787`. `npm run dev` serves `http://localhost:3000/devnet`. The page is labeled DEVNET and owner-controlled. On October 5 it showed quantity 1, item 0.500000, shipping 0.200000, tax 0.300000, and total 1.000000 Circle devnet USDC. The durable store now has one paid shopper order, `ab0421c2-e708-40cd-b30c-a1e2a433b512`. `POST /orders/missing-order/refund-transaction` returned 400, "Only a paid order can be refunded."

BROWSER, NO FUNDS MOVED. At `http://localhost:3000/devnet` the embedded browser has no Phantom extension, so it cannot sign. Review stays disabled until a wallet connects. An earlier browser session could review and approve the 1.000000 USDC total with a mainnet-only fixture, and Sign stayed disabled. A devnet fixture that rejected signing showed `User rejected the request.` A locally signed fixture was submitted to the merchant without broadcast. The merchant said it had not seen the signature and created no order.

CHECKS. `npx vitest run` passed 129 tests and skipped 5. ESLint reported no errors on the merchant service, shopper page, and merchant test. `npx tsc --noEmit` succeeded. `npm run build` has not been rerun since the refund priority-fee change, so the running dev server stays available for the refund.

## Current limitations

- The shopper address signed and broadcast the October 5 payment. The generated payer key was not used as a stand-in. The Phantom approval dialog itself was not observed from this session.
- The October 4 payment was not replayed into the new store.
- The live paid order survived one merchant restart, and replaying its signature did not create a second order. A confirmed refund of that order, and a second restart that still shows refunded, are still unverified.
- SuperTab reads orders from the separate merchant. It does not write them, and the catalog shop does not treat this devnet order as a retailer purchase.
- Nothing here shows that an unrelated retailer accepts Solana.

## Exact blockers

A purchase from an unrelated retailer still needs a merchant the owner can authorize. Earlier checks are preserved in `docs/CLOSED_ROUTES.md`. Do not repeat those calls without new evidence.

The October 5 payment is confirmed. The refund still needs the same Phantom account to sign. Silence is not approval.

## Next useful action

With `npm run merchant` and `npm run dev` already running, open `http://localhost:3000/devnet` in the browser where Phantom is installed. Connect `JCVsKd4TMg1fvEs7rjf5YgLYbJfNC8Dwb4x1PchFkGM7` on Devnet. Read merchant order `ab0421c2-e708-40cd-b30c-a1e2a433b512`. Click Prepare refund, then Sign and send refund, and approve it in Phantom within 60 seconds. The return is 1.000000 Circle devnet USDC. The wallet pays the devnet network fee, with a priority fee capped at 0.0001 devnet SOL. Do not use the generated payer key or mainnet funds.
