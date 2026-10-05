# SuperTab project state

## Spending review — October 5, 2026

This is a digital timestamping-service test for SCVD General Store’s “A Bitcoin Anchor,” quantity 1. It can later prove SOL to USDC, a merchant payment, and a certificate for one digest. It does not prove a physical purchase or shipping to Thailand. No swap, payment, signature, or order was made. Execution remains unavailable.

LIVE READ-ONLY. The official item page, fetched the same day, says the buyer submits a 64-character sha256 digest and may add an optional label. SuperTab uses the public preimage `SuperTab purchase probe 2026-10-05 bitcoin_anchor` and shows it before any approval. Only its digest is submitted. The store says it never sees the preimage. The purchase response can return the signed certificate while the OpenTimestamps proof is still pending; Bitcoin confirmation is a later upgrade. A certificate is submission evidence. A pending proof is not a completed anchor.

In the browser, after choosing the read-only demo wallet and **Refresh unpaid quote**, the review showed Solana mainnet, that wallet’s public address, 1.000000 USDC, mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`, recipient `DGxcPrAHL9YM3hW7iXuHFJmr87Zr6AMA4jCYHBpuvMgE`, and sponsor `Hc3sdEAsCGQcpgfivywog9uwtk8gUBUZgsxdME1EJy88`. The wallet still held 0.000004 USDC and 0.057052346 SOL, so conversion was required. The conversion input was 0.008570754 SOL, the minimum received was 1.019992 USDC, slippage stayed 50 bps, and the SOL cap was 0.008577266 SOL. That cap is below the previous comparison of 0.008585479 SOL. The earlier figure is not authorization. The 0.01 SOL reserve stays in the wallet. The 1 USDC total is what the conversion funds, not a second SOL spend. The merchant quote expired at 2026-10-05T15:09:09.445Z and the conversion quote expired 45 seconds after it was checked. Refreshing does not approve the purchase. The page had no sign, send, or pay control.

CORRELATION. The current listing says a certificate’s signed bytes include the item, the digest in `attests`, the USDC amount, the asset, the network, the payer, and the settlement transaction. A public sample verify, `cert_4dww28dx5j`, is a different item and does not prove this purchase. Verification reads `GET https://scvd.store/api/verify/{cert_id}` for a known id only.

RECOVERY, NOT EXECUTION-READY. The store documents an idempotency key and a same-payment retry, and `/api/claims` requires proof of the paying wallet. This build prepares a key but does not send it and does not retain a signed payment. If the purchase response is lost before a certificate id is kept, verify-by-id cannot find the order. No second swap or payment is allowed. The letter and refund endpoints were not called.

FIXTURES. `tests/digital-purchase.test.ts` covers a changed recipient, an expired quote, a wallet or network change, a SOL cap above the previous comparison, a certificate for the wrong item or digest or payer or amount, and a lost response. Those fixtures do not pay.

## Prepared digital purchase — October 5, 2026

This is a quote and an unsigned conversion check. No swap, payment, signature, or order was made.

LIVE READ-ONLY. In the browser at 2026-10-05T14:39:47.246Z, **Request fresh quote** called SuperTab and showed an unpaid merchant total of 1.000000 USDC, expiring 2026-10-05T14:44:47.246Z. The Solana option was mainnet USDC `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`, recipient `DGxcPrAHL9YM3hW7iXuHFJmr87Zr6AMA4jCYHBpuvMgE`, with the network fee assigned to the quoted sponsor. The panel showed 0.000004 USDC and 0.057052346 SOL, a conversion input of 0.008579726 SOL, a minimum of 1.019995 USDC at 50 bps, and a proposed SOL cap of 0.008585479 SOL. It did not show the wallet address, and the page had no sign, send, or pay button. An earlier service read at 14:35:53Z had the same 1.000000 USDC price and a SOL cap of 0.008587738; that check passed on the unsigned conversion and was not signed. One sizing request before that returned HTTP 400 route-not-found. A later route refusal stays on the quote screen.

The product is SCVD General Store’s “A Bitcoin Anchor,” quantity 1, sold by Record Creative Co. LLC. It is a one-time digital OpenTimestamps submission. Delivery is a signed certificate and a proof URL in the purchase response. Thailand is not named as a restriction, and the listing has no shipping, account, or subscription. A failed instant delivery is a defect reported with `POST https://scvd.store/api/letter`; the keeper refunds by hand. That is not escrow and was not tested with a payment.

The 14:35:53Z service read found the shopper’s mainnet USDC account and the merchant USDC account already present. USDC did not cover 1 USDC, so conversion is required. That read checked an unsigned transaction for 0.008581722 SOL, minimum received 1.019996 USDC, estimated output 1.025121 USDC, slippage 50 bps, and a 1016 lamport prioritization fee. The bytes were not kept or sent. The browser quote above is the later payable figure, and it has the same 1 USDC price.

PREPARED, NOT EXECUTED. The proposed maximum from the browser read is the exact 1.000000 USDC merchant total plus 0.008585479 SOL. The 0.01 SOL reserve is not part of the cap. USDC above the 1 USDC payment stays in the wallet. The merchant-payment network fee is charged to the quoted sponsor, not the shopper, only while the fee payer stays a different account. The page can request a fresh quote. It has no sign or send control. A fresh quote replaces these amounts; approval has to name this product and the cap then on screen. A merchant total above 2 USDC is rejected. This quote expires at 14:44:47Z and is evidence, not spending approval.

ORDER PROOF, NOT YET AVAILABLE. After a future authorized payment, the merchant response carries `cert_id`. SuperTab would read `GET https://scvd.store/api/verify/{cert_id}`. This product does not use a human order id. No checkout session was created. Paying only on the merchant website would not exercise this SuperTab path.

OTHER CANDIDATES, NOT SELECTED. Utilia’s fee URL failed TLS with `SEC_E_UNTRUSTED_ROOT`, so its mint, network, and order read were not verified. Bitrefill’s published Thailand eSIM starts near $2.89, above the 2 USDC product budget, and the product page returned a Cloudflare interstitial rather than a checkout. No invoice was created.

FIXTURES. `tests/digital-purchase.test.ts` rejects a non-integer amount, the wrong USDC mint, a price above 2 USDC, and a quote with no Solana option. It sizes a conversion from minimum received and refuses an input equal to the whole wallet. A covered balance skips conversion. A refused DFlow route leaves the merchant total visible and the purchase not ready. Those fixtures are not the live 402.

The Solana Spaces tee quote below stays recorded evidence. The devnet payment, refund, and two paid orders were not changed. Executed conversion remains unproven.

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

1. Under **Timestamp service — quote only**, choose **Use read-only demo wallet**, then **Refresh unpaid quote**. Read the public address, Solana mainnet, the payload and digest, the 1 USDC total, the conversion minimum, and the SOL cap. The 15:04Z browser read has expired. Refreshing does not approve a purchase. Execution stays unavailable because a lost response cannot be recovered without the original payment or a wallet signature. Confirm there is no sign, send, or pay control.
2. Under **Real product — quote only**, read the Just Build It Tee evidence: date, destination scope, item, shipping, tax, merchant total, visible USDC option, and unverified duties and network fees. Confirm there is no approve, sign, or pay action. The merchant link only opens Solana Spaces for a fresh quote.
3. Under **Devnet test purchase**, choose **View verified test order**, or open `http://localhost:3000/devnet` and use the same action. The status comes back from the merchant. For `e485b032-7abd-4a59-849c-f37775ec57c6`, expect `refunded` and both signatures above, while the merchant still has that record.
4. A new checkout is a separate payment. Do not start one to repeat this evidence. The devnet marker is not the tee.

The USDC total on the devnet page is the test merchant’s price. Devnet SOL pays the network base fee. Phantom may add a priority fee up to 0.0001 devnet SOL. That fee does not change the USDC amount.

## Real-merchant quote, October 5, 2026

This is not a purchase. No signature was requested and Complete Purchase stayed disabled.

The recorded quote is the one in the shopping page under **Real product — quote only**: Just Build It Tee, Medium, quantity 1, checked October 5, 2026, for an authorized Thailand destination. Item $35.00, GlobalPost Economy $20.53, displayed tax $0.00, merchant total $55.53, visible USDC option $55.53, estimated delivery October 19. Duties and network fees were not verified. An earlier checkout screen showed only the $35.00 shirt price before a complete destination. That screen is not the recorded quote.

SuperTab does not refresh this quote. Solana Spaces is not on the Shopify checkout allowlist, and this build does not call a store API or scrape checkout. The page links to `https://solanaspaces.com/checkout` so a person can request a fresh quote on the merchant site. That link does not submit an address or a payment. The recorded amounts cannot approve, fund, sign, or pay.

The verified devnet order `e485b032-7abd-4a59-849c-f37775ec57c6` remains a separate owner-controlled refund. It does not pay for this shirt.

## Asset conversion — October 5, 2026

A shopper can review a DFlow quote from a mainnet asset into mainnet USDC. The quote shows the network, both mints, the exact input, the estimated output, the minimum received, slippage, the disclosed provider fee, the prioritization fee when DFlow returns one, the quote time, and SuperTab’s 45-second expiration. Nothing is signed or sent. The estimated output is not added to a USDC balance and is not subtracted from a funding gap. A comparison with the recorded $55.53 Solana Spaces total is labeled as recorded evidence, not a current payable total.

LIVE. On October 5, 2026, `https://dev-quote-api.dflow.net` returned a mainnet quote for 10000000 base units of wrapped SOL (`So11111111111111111111111111111111111111112`) into mainnet USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`). A second request for public key `vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg` returned an unsigned transaction. SuperTab checked the fee payer, the input and output mints, the embedded input and expected output, the payer’s mainnet USDC account, the disclosed lookup tables, and the prioritization fee. The check passed. The transaction was not simulated, signed, or broadcast. Output amounts move with the market, so the page shows the current quote rather than a stored price.

NO DEVNET ROUTE. The same host, asked to convert that wrapped-SOL amount into Circle devnet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`), returned HTTP 400 `route_not_found`. Sending `cluster=devnet` did not change the result. DFlow’s dev host is an unauthenticated mainnet API tier, not Solana devnet. The panel records this finding and does not ask again. Executed conversion remains unproven. No devnet swap was prepared for signature.

FIXTURES. `tests/conversion-review.test.ts` uses labeled fixtures, not live swaps. It rejects a symbol used as a mint, mainnet USDC as the input, Circle devnet USDC on a mainnet quote, and extra decimal places. It expires a quote at 45 seconds. It separates insufficient input from insufficient SOL for fees. It rejects a provider HTTP 500, an altered output amount, a different fee payer, a token Approve, and an undisclosed lookup table. A passing fixture is not a live conversion.

Devnet checkout funding is unchanged and still uses confirmed devnet balances only. Orders `ab0421c2-e708-40cd-b30c-a1e2a433b512` and `3518beef-1b53-4e5c-8682-0baca6b1c3fa` were not touched.

## Checks

On October 5, 2026, `npx vitest run` passed 152 tests and skipped 7. With `SUPERTAB_LIVE=1`, the unpaid digital-purchase read passed, and nothing was signed or sent. ESLint reported no errors on the digital-purchase files. `npx tsc --noEmit` succeeded. `npm run build` succeeded. In the browser, the read-only wallet review showed the payload, 1.000000 USDC, a SOL cap of 0.008577266, and execution unavailable. The two paid devnet orders were not opened.

## Next action

Refresh the Bitcoin Anchor quote and do not sign it. Spending approval has to name this digital timestamp service, quantity 1, the 1.000000 USDC total, and the SOL cap then on screen. The 15:04Z browser cap was 0.008577266 SOL, below the earlier 0.008585479 SOL comparison, and that quote has expired. Execution is not ready: a lost purchase response cannot be recovered from an unknown certificate id. A general instruction to continue is not approval. Do not start another devnet payment.
