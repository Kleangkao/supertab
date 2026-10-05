# SuperTab project state

Updated October 5, 2026.

## Fixed product goal

Help a shopper buy a normal online product using supported assets from their Solana wallet.

A completed purchase connects a selected product, a verified complete payable total, explicit buyer approval, a wallet-funded payment, and a merchant-confirmed order. That has not happened with an unrelated retailer.

## What is proven

FIXTURES. `tests/devnet-merchant.test.ts` restarts a JSON store, returns the same order and refund, rejects payment reuse, and recovers one order after a failed write. `tests/devnet-payment.test.ts` blocks signing until the connected devnet account approves that checkout. `tests/payment-message.test.ts` and `tests/wallet-standard.test.ts` accept equivalent legacy or version-0 serialization and reject changed terms or an extra instruction. `tests/devnet-rpc.test.ts` refuses an expired blockhash before broadcast and accepts an already-processed signature only after confirmed or finalized status. These are not broadcast transactions.

PHANTOM DEVNET FLOW. Buyer `JCVsKd4TMg1fvEs7rjf5YgLYbJfNC8Dwb4x1PchFkGM7` paid and refunded order `e485b032-7abd-4a59-849c-f37775ec57c6` for checkout `2ca9e370-e896-46ef-ab3f-8d88c71194fc`. The product is the local devnet test marker: item 0.500000, shipping 0.200000, tax 0.300000, total 1.000000 Circle devnet USDC, mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. Payment `5AJyuMPZAMt2MxQUhFjG67NhSdkGJTgZZKzxVBT37BBtrJF8YHpU6N4ocmmbPKCF1RsLia88JnSYGwV6xQg2bcAB` at slot 507680455 moved 1000000 minor units from that buyer to merchant `8rXZ9KFzc3NCMMvNdyfJ5irvHnTWYYGLqPJY5WuMuwmZ`. The network fee was 80000 lamports. Refund `2HzsTS3LUESsmDiBaAjptqykiPi5cbeVLMQVqa9qs3FT1cXfuFPN31QkPCxbhUGTTGe8jHUCBtgRaWRZdeY9r1Kj` at slot 507680500 returned the same 1000000 minor units. Its network fee was 85000 lamports. Both transactions have no chain error. Payment reference `C1KuAycPkZq56DyHAVJ3AEC8EsAbKWmaBEWzMM9wix48`. Refund reference `HuiPjGDBcGLTiKUXswp389NW6pJ4E47EqXjVmMETwB2G`.

PERSISTENCE. After the merchant process was restarted on October 5, SuperTab `GET /api/devnet-merchant/order?id=e485b032-7abd-4a59-849c-f37775ec57c6` returned that same order, both signatures, and status `refunded`. SuperTab does not write the order.

LEFT PAID ON PURPOSE. Orders `ab0421c2-e708-40cd-b30c-a1e2a433b512` and `3518beef-1b53-4e5c-8682-0baca6b1c3fa` each remain paid for 1.000000 devnet USDC. They were not refunded, deleted, or marked refunded. They do not block the completed flow.

OCTOBER 4, NOT THIS MILESTONE. Generated-payer payment `3kQNnZbAXi4CTuXkatAQoRG3ayp6mVjgpwRViAMEKTXDoabra5YnFyT7Wpbc3GCbxnktggiyT8MWY4N6htZivrM9` and refund `62Nwju2eZ8kRThBK7qJtq2ZfzKjpko9aonyUVQ9gFkJtioeXH7mG2jyij58b6Gpj4zbjv2LmARXk3JSMAXy52EuC` were the same in-memory transfer recorded as two order ids. They were not imported.

## Demo

From `supertab-main`:

1. `npm run merchant` loads `.env.local` and listens on `http://127.0.0.1:8787`.
2. `npm run dev` serves `http://localhost:3000/devnet`.
3. The page is labeled DEVNET and owner-controlled.
4. Read order `e485b032-7abd-4a59-849c-f37775ec57c6`. Expect status refunded and both signatures above.
5. A new checkout is a separate payment. Do not start one to repeat this evidence.

The USDC total is the merchant price. Devnet SOL pays the network base fee. Phantom may add a priority fee up to 0.0001 devnet SOL. That fee does not change the USDC amount.

## Real-product dependency

Solana Spaces is the strongest evidenced route for an existing shipped product. `solanaspaces.com` lists the Just Build It Tee, its checkout names Phantom and Solflare with mainnet USDC, and `createOrderWithPayment` runs after `signTransaction` and returns the store's `orderId` and `paymentSignature`. Shipping and tax are calculated at checkout once a full address is present. That mechanism is supported. Executing it is not authorized: it spends mainnet USDC, and no street address has been supplied. Do not treat a missing shipping price on the product page as a rejection.

No integration code should be added until the owner authorizes that mainnet payment and supplies the address. Proposed outreach is unnecessary because the public checkout already accepts the wallet. Do not contact the store. Earlier closed checks stay in `docs/CLOSED_ROUTES.md`.

## Checks

On October 5, 2026, `npx vitest run` passed 130 tests and skipped 5. ESLint reported no errors on the changed devnet files. `npx tsc --noEmit` succeeded. `npm run build` succeeded.

## Next action

Authorize one mainnet USDC purchase of the Solana Spaces Just Build It Tee, and provide the street address its checkout requires. Until then, do not spend mainnet funds or start another devnet payment.
