# SuperTab project state

Updated October 5, 2026.

## Fixed product goal

Help a shopper buy a normal online product using supported assets from their Solana wallet.

A completed purchase connects a selected product, a verified complete payable total, explicit buyer approval, a wallet-funded payment, and a merchant-confirmed order. That has not happened with an unrelated retailer.

## Completed evidence

LOCAL FIXTURES. On October 5, 2026, `npx vitest run` passed 127 tests and skipped 5. Three test files were skipped. `tests/devnet-merchant.test.ts` restarts a JSON store, returns the same order id and refund status, rejects reuse of that payment on another checkout, and creates one order when recovery runs after a failed order write. It also accepts one buyer-signed versioned refund, co-signs the devnet merchant once, and does not broadcast a changed refund. `tests/devnet-payment.test.ts` blocks a wallet signature until the connected devnet account approves that exact checkout. `tests/payment-message.test.ts` and `tests/wallet-standard.test.ts` accept an equivalent legacy or version-0 payment with reordered accounts and reject a changed amount, privilege, payer, blockhash, trailing bytes, or an added instruction. These are fixtures, not broadcast transactions.

DEVNET READS, OCTOBER 5. One `getGenesisHash` to the public devnet endpoint returned HTTP 429, "Connection rate limits exceeded." No further public calls were made. `SOLANA_RPC_URL` is empty and is not used for this checkout. `SOLANA_DEVNET_RPC_URL` in gitignored `.env.local` points at an existing Alchemy devnet host. One genesis read returned HTTP 200 and the devnet genesis hash `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`. The merchant logged that host, not the credential, and `GET /product` returned 200. A checkout for 1000000 minor units returned a 384-byte unsigned transaction. It was not signed or broadcast. Public address `JCVsKd4TMg1fvEs7rjf5YgLYbJfNC8Dwb4x1PchFkGM7` had 7229087720 lamports and 23000000 minor units of mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. No private key was read.

PHANTOM SHAPE, NOT A SIGNATURE. Brave's installed Phantom 26.31.0 exposes `solana:signTransaction` with `supportedTransactionVersions: ["legacy", 0]`. Its account advertises `solana:devnet` and `solana:signTransaction`. The method deserializes one input transaction and returns `{ signedTransaction: Uint8Array }` from `VersionedTransaction.serialize()`. No signature from that wallet has been submitted.

DEVNET, OCTOBER 4, NOT IMPORTED. One generated-payer payment and matching refund were broadcast: payment `3kQNnZbAXi4CTuXkatAQoRG3ayp6mVjgpwRViAMEKTXDoabra5YnFyT7Wpbc3GCbxnktggiyT8MWY4N6htZivrM9` at slot 507317970, and refund `62Nwju2eZ8kRThBK7qJtq2ZfzKjpko9aonyUVQ9gFkJtioeXH7mG2jyij58b6Gpj4zbjv2LmARXk3JSMAXy52EuC` at slot 507317976. The amount was 1000000 minor units of Circle devnet USDC, mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. Order ids `6359fb8a-17c0-4243-813b-6c92ed9df309` and `d0f4cec6-8265-4058-bc86-23f4b2f1dfeb` were that same transfer recorded twice in memory. They were not copied into the durable store, and the old checkout was not reconstructed.

LOCAL PROCESS. From `supertab-main`, `npm run merchant` loads `.env.local` and listens on `127.0.0.1:8787`. `npm run dev` serves `http://localhost:3000/devnet`. The page is labeled DEVNET and owner-controlled. On October 5 it showed quantity 1, item 0.500000, shipping 0.200000, tax 0.300000, and total 1.000000 Circle devnet USDC. The durable store had unpaid checkouts and no orders. `POST /orders/missing-order/refund-transaction` returned 400, "Only a paid order can be refunded."

BROWSER, NO FUNDS MOVED. At `http://localhost:3000/devnet` the embedded browser has no Phantom extension, so it cannot sign. Review stays disabled until a wallet connects. An earlier browser session could review and approve the 1.000000 USDC total with a mainnet-only fixture, and Sign stayed disabled. A devnet fixture that rejected signing showed `User rejected the request.` A locally signed fixture was submitted to the merchant without broadcast. The merchant said it had not seen the signature and created no order.

CHECKS. `npx vitest run` passed 127 tests and skipped 5. `npx tsc --noEmit` succeeded. ESLint on the devnet checkout files reported no errors after the unused-variable warning was removed. `npm run build` has not been rerun since these checkout changes.

## Current limitations

- No shopper wallet has signed or broadcast a new payment from `/devnet`. The generated payer key was not used as a stand-in.
- The October 4 payment was not replayed into the new store.
- Fixture tests prove that a paid order and its refund status survive a restart. The live store has no paid order. A restart of that paid order, a replay rejection, and a confirmed refund are still unverified.
- SuperTab reads orders from the separate merchant. It does not write them, and the catalog shop does not treat this devnet order as a retailer purchase.
- Nothing here shows that an unrelated retailer accepts Solana.

## Exact blockers

A purchase from an unrelated retailer still needs a merchant the owner can authorize. Earlier checks are preserved in `docs/CLOSED_ROUTES.md`. Do not repeat those calls without new evidence.

The devnet page can broadcast only after the owner connects Phantom on devnet, approves the displayed total, signs, and then chooses Send. Silence is not approval.

## Next useful action

With `npm run merchant` and `npm run dev` already running, open `http://localhost:3000/devnet` in the browser where Phantom 26.31.0 is installed. Set Phantom to Devnet and connect `JCVsKd4TMg1fvEs7rjf5YgLYbJfNC8Dwb4x1PchFkGM7`. Review the 1.000000 Circle devnet USDC total, approve that checkout, sign, and send. Do not use the generated payer key, mainnet funds, or a retailer checkout.
