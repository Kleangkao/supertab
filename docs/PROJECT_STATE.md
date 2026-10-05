# SuperTab project state

## Latest quote evidence — October 5, 2026

With owner-authorized delivery information (not stored in this document), Solana Spaces returned Thailand shipping rates for one Just Build It Tee, Medium: item $35.00 + GlobalPost Economy $20.53 + displayed tax $0.00 = merchant total $55.53; estimated arrival October 19. Its payment section visibly offered USDC and Solana wallets. Duties and network fees remain unverified. No wallet connection, signing, payment, or order placement occurred. This supersedes the earlier street-address blocker. Preserve the separation between this live quote and the completed controlled devnet order. Do not spend mainnet funds.

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

From `supertab-main`, in two terminals:

1. `npm run merchant` loads `.env.local` and listens on `http://127.0.0.1:8787`.
2. `npm run dev` serves `http://localhost:3000`.

Open `http://localhost:3000`. No new payment is required.

1. Under **Real product — quote only**, read the Just Build It Tee evidence: date, destination scope, item, shipping, tax, merchant total, visible USDC option, and unverified duties and network fees. Confirm there is no approve, sign, or pay action. The merchant link only opens Solana Spaces for a fresh quote.
2. Under **Devnet test purchase**, choose **View verified test order**, or open `http://localhost:3000/devnet` and use the same action. The status comes back from the merchant. For `e485b032-7abd-4a59-849c-f37775ec57c6`, expect `refunded` and both signatures above, while the merchant still has that record.
3. A new checkout is a separate payment. Do not start one to repeat this evidence. The devnet marker is not the tee.

The USDC total on the devnet page is the test merchant’s price. Devnet SOL pays the network base fee. Phantom may add a priority fee up to 0.0001 devnet SOL. That fee does not change the USDC amount.

## Real-merchant quote, October 5, 2026

This is not a purchase. No signature was requested and Complete Purchase stayed disabled.

The recorded quote is the one in the shopping page under **Real product — quote only**: Just Build It Tee, Medium, quantity 1, checked October 5, 2026, for an authorized Thailand destination. Item $35.00, GlobalPost Economy $20.53, displayed tax $0.00, merchant total $55.53, visible USDC option $55.53, estimated delivery October 19. Duties and network fees were not verified. An earlier checkout screen showed only the $35.00 shirt price before a complete destination. That screen is not the recorded quote.

SuperTab does not refresh this quote. Solana Spaces is not on the Shopify checkout allowlist, and this build does not call a store API or scrape checkout. The page links to `https://solanaspaces.com/checkout` so a person can request a fresh quote on the merchant site. That link does not submit an address or a payment. The recorded amounts cannot approve, fund, sign, or pay.

The verified devnet order `e485b032-7abd-4a59-849c-f37775ec57c6` remains a separate owner-controlled refund. It does not pay for this shirt.

## Checks

On October 5, 2026, `npx vitest run` passed 138 tests and skipped 5. ESLint reported no errors on the prototype files. `npx tsc --noEmit` succeeded. `npm run build` succeeded. Browser checks read the merchant’s refunded order and a missing order; they did not create a transaction.

## Next action

Use the prototype on the shopping page. The Solana Spaces quote stays quote-only. The devnet order is read from the merchant and is not a shirt purchase. Duties and network fees on the retail quote remain unverified. Do not sign or place a Solana Spaces order. No mainnet purchase is authorized.
