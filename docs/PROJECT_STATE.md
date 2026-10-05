# SuperTab project state

Updated October 5, 2026.

## Fixed product goal

Help a shopper buy a normal online product using supported assets from their Solana wallet.

A completed purchase connects a selected product, a verified complete payable total, explicit buyer approval, a wallet-funded payment, and a merchant-confirmed order. That has not happened with an unrelated retailer.

## Completed evidence

LOCAL FIXTURES. On October 5, 2026, `npx vitest run` passed 116 tests and skipped 5. Three test files were skipped. `tests/devnet-merchant.test.ts` restarts a JSON store, returns the same order id and refund status, rejects reuse of that payment on another checkout, and creates one order when recovery runs after a failed order write. `tests/devnet-payment.test.ts` blocks a wallet signature until the connected devnet account approves that exact checkout. These are fixtures, not broadcast transactions.

DEVNET, OCTOBER 4, NOT IMPORTED. One generated-payer payment and matching refund were broadcast: payment `3kQNnZbAXi4CTuXkatAQoRG3ayp6mVjgpwRViAMEKTXDoabra5YnFyT7Wpbc3GCbxnktggiyT8MWY4N6htZivrM9` at slot 507317970, and refund `62Nwju2eZ8kRThBK7qJtq2ZfzKjpko9aonyUVQ9gFkJtioeXH7mG2jyij58b6Gpj4zbjv2LmARXk3JSMAXy52EuC` at slot 507317976. The amount was 1000000 minor units of Circle devnet USDC, mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. Order ids `6359fb8a-17c0-4243-813b-6c92ed9df309` and `d0f4cec6-8265-4058-bc86-23f4b2f1dfeb` were that same transfer recorded twice in memory. They were not copied into the durable store, and the old checkout was not reconstructed.

LOCAL PROCESS. `npm run merchant` listens on `127.0.0.1:8787` and writes gitignored `data/devnet-merchant.json`. `GET /product` returned the labeled test marker: quantity 1, item 0.500000, shipping 0.200000, tax 0.300000, total 1.000000 Circle devnet USDC, network `solana:devnet`. After the browser session the file held 3 checkouts, 0 payments, and 0 orders. Restarting the process left those counts unchanged, and `POST /recover` returned no orders.

BROWSER, NO FUNDS MOVED. At `http://localhost:3000/devnet` the page loaded that product from the merchant. A mainnet-only fixture could review and approve the 1.000000 USDC total, and Sign stayed disabled. Cancel review removed the checkout. A devnet fixture that rejected signing showed `User rejected the request.` A locally signed fixture was submitted to the merchant without broadcast. The merchant said it had not seen the signature and created no order. Recover created no order. Reading order id `missing-order` showed the merchant's missing-order error and did not show a confirmed order. The page did not call `/api/devnet-merchant/broadcast`.

CHECKS. `npm run typecheck` and `npm run build` succeeded. The build includes `/devnet` and the devnet-merchant proxy routes. ESLint was run on the changed files and then on the project.

## Current limitations

- No shopper wallet has signed or broadcast a new payment from `/devnet`. The Send button was not used, and the generated payer key was not used as a stand-in.
- The October 4 payment was not replayed into the new store.
- Fixture tests prove that a paid order and its refund status survive a restart. The live store restarted with the 3 unpaid checkouts above. It had no paid order to display.
- SuperTab reads orders from the separate merchant. It does not write them, and the catalog shop does not treat this devnet order as a retailer purchase.
- Nothing here shows that an unrelated retailer accepts Solana.

## Exact blockers

A purchase from an unrelated retailer still needs a merchant the owner can authorize. Earlier checks are preserved in `docs/CLOSED_ROUTES.md`. Do not repeat those calls without new evidence.

The devnet page can broadcast only after the owner connects a devnet wallet, approves the displayed total, signs, and then chooses Send. Silence is not approval.

## Next useful action

Run `npm run merchant`, open `/devnet`, and connect the devnet wallet that should pay. Approve the displayed 1.000000 Circle devnet USDC total before signing. Leave Send unclicked unless that exact payment is intended. Do not use the generated payer key, mainnet funds, or a retailer checkout for this step.
