# SuperTab project state

## Bound unsigned conversion — October 6, 2026

The same unpaid attempt `st-anchor-4ca8ae1e05b0be1e1d49a62af5756020` is now `swap_prepared`. Wallet `JCVsKd4TMg1fvEs7rjf5YgLYbJfNC8Dwb4x1PchFkGM7`, recipient `DGxcPrAHL9YM3hW7iXuHFJmr87Zr6AMA4jCYHBpuvMgE`, sponsor `D6ZhtNQ5nT9ZnTHUbqXZsTx5MH2rPFiBBggX4hY1WePM`, and exactly 1.000000 USDC are unchanged. No swap or merchant transaction has been signed or submitted. The original reviewed terms remain in the journal.

The recorded review was input 8,535,674 lamports, minimum 1,019,894 USDC base units, slippage 50 bps, priority 750 lamports, and quoted cost 8,541,424 lamports. That quoted cost had been stored as the cap. The checked unsigned order was discarded, so preparation asked DFlow for a second synchronous order and required its minimum to be at least 1,019,894. The first live order after the fix had the same input, slippage 50, priority 311, and total cost 8,540,985 lamports, all inside that recorded quote. Its minimum was 1,019,379, which is 515 base units below the recorded minimum and still above the 1,000,000 USDC payment. That minimum was the field the old prepare rejected. The owner ceiling stays 8,585,479 lamports; the lower recorded quote does not replace it.

Preparation now retains the synchronous unsigned order on this attempt. A later prepare reuses it while the blockhash is valid. If that unsigned order expires, the same attempt can bind another synchronous order only when the wallet, recipient, sponsor, product, and 1 USDC amount are unchanged, slippage is not wider, the minimum still covers 1 USDC, and the total SOL cost stays at or below 8,585,479 lamports. Signed, submitted, and uncertain attempts are not refreshed. A changed sponsor, recipient, mint, or wallet is refused by name.

The live `POST /api/digital-purchase/execute` action `prepare_swap` reached `swap_prepared` with a usable unsigned transaction. The order currently bound is synchronous: input 8,535,674 lamports, minimum 1,018,920 USDC base units, slippage 50 bps, priority 400 lamports, total cost 8,541,074 lamports, and last valid block height 431,849,182. The wallet balance read was 57,052,346 lamports, which covers that cost plus the 0.01 SOL reserve. The blockhash lifetime is short, so the owner clicks **Prepare conversion signature** and then **Sign conversion** on the purpose line that appears. That signature is the SOL to USDC conversion only. It does not pay the merchant. The local gate is enabled for this attempt.

Fixture tests: 201 passed, 7 skipped. Typecheck, changed-file lint, and the production build passed. This is not a signature, not settlement, and not a certificate.

## Authorized preparation attempt — October 6, 2026

The owner authorized one 1 USDC Bitcoin Anchor purchase for the connected wallet, with the named sponsor and a maximum total SOL spend of 0.008585479 SOL, preserving 0.01 SOL. An unpaid review at 0.008541424 SOL was recorded as approved terms. The local execution gate was briefly enabled for unsigned preparation, which refused changed conversion terms. No transaction was signed or sent. The gate was disabled again. The section above is the later bound order for that same attempt.

## Fresh sponsor reviews and status reads — October 6, 2026

Browser recovery metadata also follows a successful server refresh of the unsigned preview, retaining the same attempt and idempotency key. A stale browser sponsor no longer produces a contradictory warning above a valid new review. Submitted or unresolved records, changed amounts or recipients, and records with settlement evidence remain preserved. The follow-up regression suite passed 196 tests with 7 skipped; typecheck and changed-file lint passed.

The merchant rotated its payment sponsor again. Fresh unpaid reviews now use the valid sponsor returned by the fixed merchant endpoint instead of comparing it with a historical global sponsor. The shopper must remain distinct from that sponsor. Recipient, mint, and exact 1 USDC remain pinned. Existing approved attempts still bind their original sponsor and reject a changed quote; signed or submitted attempts cannot be refreshed.

The progress status read now uses same-origin POST because browser GET requests normally omit the Origin required by the guard. This endpoint only reads the journal; the origin guard remains enforced.

A live unpaid quote passed review with no blockers and produced a private unsigned preview. The status endpoint reported execution gate off. No terms were approved and no signatures, swaps, merchant payments, or claims were requested. 195 tests passed, 7 skipped; changed-file lint, TypeScript, and production build passed. Actual mainnet execution remains unproven.

## Execution adapters — October 6, 2026

The Bitcoin Anchor path now has real DFlow and merchant adapters behind the default-off gate. `SUPERTAB_MAINNET_EXECUTION` is still unset. No swap, payment, signature, claim, or devnet order was sent.

SWAP. `prepare_swap` asks DFlow for a synchronous order (`allowAsyncExec=false`). A read-only order on October 6 for 0.001 SOL returned `executionMode: sync`. An async response is refused before signing and is not replaced with another route. Sync orders are submitted with `sendTransaction` and count only after `confirmed` or `finalized` with no chain error, then a USDC balance read. A lost response or “already processed” reconciles that signature. It does not build another swap. If USDC is still short, the attempt stays funded in the wallet and does not start merchant payment.

APPROVAL. A refreshed sponsor or conversion quote does not replace terms that are already approved. The quote refresh also stops once an attempt has left review. Replay of a lost merchant response resubmits the stored authorization and idempotency key only while the outcome is still unknown and no settlement is stored. A known settlement is read again instead of replayed.

MERCHANT. Payment is a v2 `PAYMENT-SIGNATURE` retry of `GET /api/buy/bitcoin_anchor` with the stored `Idempotency-Key`. The shopper signature is slot 1 and the sponsor slot stays empty. SuperTab does not broadcast that transaction. The authorization is encrypted before the request. A rejection stays on the original attempt. Settlement is read from the chain: source, mint, 1 USDC, and recipient. Certificate checks use ed25519 over `signed_payload` and the keys at `https://scvd.store/.well-known/scvd-signing-key`. `existence.status` `pending` stays timestamp-proof pending. `bounded` with a Bitcoin block is the only anchored state.

GATE. Every swap broadcast, merchant submission, and original-payment replay checks the server gate at its own boundary. A client `execute` or `approved` flag does not open it. The browser shows separate prepare, sign, and submit actions. They stay disabled while the gate is off, and page load does not request a signature.

FIXTURES. `tests/purchase-execution.test.ts` drives the adapter functions with injected transports. Gate off makes zero send or payment calls. One approved attempt produces one original swap submission and one merchant submission. Pending Bitcoin proof is not labeled complete.

NOT PROVEN. No live signature, swap, payment, or certificate for this purchase. Sponsor acceptance of the zero-priority preview is still the merchant’s decision at submission time. A read-only 402 on October 6 still asks for 1.000000 mainnet USDC to `DGxcPrAHL9YM3hW7iXuHFJmr87Zr6AMA4jCYHBpuvMgE`. The Solana sponsor is now `BFK9TLC3edb13K6v4YyH3DwPb5DSUpkWvb7XnqCL9b4F`. The October 5 sponsor is not in that accept. A later spending review has to name this product, quantity 1, exactly 1.000000 USDC, the connected wallet, this sponsor, and the fresh SOL cap then on screen.

## Purchase workflow — October 6, 2026

This is still SCVD General Store’s “A Bitcoin Anchor,” quantity 1, at exactly 1.000000 mainnet USDC. It is a digital timestamp-service test. It is not a physical purchase and it does not prove shipping to Thailand. No mainnet swap, payment, signature, claim, letter, or refund was sent. The existing devnet orders were not changed.

ORCHESTRATION. One workflow keeps review, approved terms, swap prepared, swap signed, swap submitted or uncertain, swap confirmed, funding rechecked, payment prepared, payment signed, merchant submission or uncertain, certificate verified, timestamp proof pending, and Bitcoin anchor verified as different states. A submitted or uncertain attempt cannot be replaced by a new purchase. Approval is the exact wallet, network, product, digest, amount, recipient, sponsor, conversion input, minimum output, slippage, fees, and SOL cap. The SOL cap is the conversion input plus its network fees. The 0.01 SOL reserve stays outside it. The 1 USDC total is not added again as SOL. A client `approved` flag or `walletSource` string is not spending authority. Quote expiry and a signed transaction’s blockhash expiry stop the current step. A signed transaction is not rewritten. If USDC already covers 1 USDC, conversion is skipped. After a confirmed conversion, a short balance keeps the USDC and does not start the merchant payment.

PAYMENT AND RECEIPT. The sponsored preview keeps the shopper in signature slot 1 and the sponsor in slot 0. Slot 0 must stay empty until the sponsor signs. The signed message must match the retained unsigned message. Merchant submission requires the original authorization to be stored first, and expired authorization is not replayed. SuperTab does not broadcast a sponsored payment itself. Certificate checks are ed25519 over the exact UTF-8 `signed_payload`, and the public key must be one published at `https://scvd.store/.well-known/scvd-signing-key`. Matching JSON fields without that signature is not acceptance. On-chain settlement has to match the wallet, amount, mint, and recipient. A valid certificate with a pending Bitcoin proof stays pending.

GATE AND STORAGE. `SUPERTAB_MAINNET_EXECUTION` defaults to off. `POST /api/digital-purchase/execute` returns HTTP 403 even if the body asks to execute, and it does not call the network. The adapters exist and run only when that server gate is on and the stored approval matches. Attempts are encrypted with AES-256-GCM. The key file is `merchant/secrets/purchase-recovery.key` and the ciphertext is under `data/purchase-recovery/`. Both are gitignored. This is local desktop custody. An ephemeral host that loses the disk loses the attempt and must not invent a new payment. Payment authorization is not returned to the browser or written in Git.

FIXTURES, NOT A LIVE PURCHASE. `tests/purchase-workflow.test.ts` covers changed approval terms, the shopper signature slot, mutated and invalid signatures, expiry, insufficient funds, a lost or failed swap, restart, duplicate submission, an unrelated certificate, pending Bitcoin proof, and USDC left in the wallet. Those fixtures do not spend. The browser shows the progress list and disabled sign and send controls.

The send and merchant adapters now exist and stay refused while the gate is off. A later spending review has to name this product, 1.000000 USDC, the connected wallet, and the fresh SOL cap on screen. Setting the gate is not that approval.

## Recovery record — October 5, 2026

This is still the digital timestamping-service test for SCVD General Store’s “A Bitcoin Anchor,” quantity 1. It is not a physical purchase and it does not prove shipping to Thailand. No swap, payment, signature, claim, letter, or refund was sent. Execution remains unavailable.

DOCUMENTED RECOVERY. On October 5, `https://scvd.store/agents.md` said a caller-supplied `Idempotency-Key` of 16–128 characters, or the MCP field `_meta['x402/idempotency-key']`, returns the original result for the same key, item, and payer within 24 hours and is documented as no second charge. The buy flow on that page says to sign one accept and retry with the payment. The same page says the 402 `idempotency.suggested_key` is not a secret: it is derived from the item, the current minute, and a short digest of the body, lasts about 60 seconds, and the previous minute is also checked. It selects a cache slot keyed by the verified paying wallet. It does not open one. Sending no key is documented as a normal charge. A key by itself is not documented as a free certificate lookup. That was not tested with a payment. Quote expiry is separate. The guide does not say an expired payment quote can be paid with the old signature.

`GET https://scvd.store/api/claims` returned the claim contract without a signature. A shopper posts `{ address }` to `/api/claims/challenge`, signs that exact UTF-8 challenge with `signMessage` (not a transaction), then posts `{ address, signature }` within 300 seconds. A valid signature lists open orders, instant-item certificates, and watches without a certificate id. The challenge is single-use. Orders carry a payer only since 2026-07-31. The claims page does not name a later expiry for the stored purchase itself. Recovering one original good is a later post of `{ address, signature, cert_id }` and was not called. The current item page says `purchase_recovery_pending` means read `recovery.status_url` with the bearer `status_token` and send no new payment; `settlement_unknown` and `invalid_settlement_receipt` say to keep the original payment and key, including a status read after expiry; `delivery_failed` says not to buy again. Those URLs exist only in a retained error response. A fully lost response does not yield them. A known certificate stays readable at `GET https://scvd.store/api/verify/{cert_id}`, which the item page calls free forever.

IMPLEMENTATION EVIDENCE, NOT A LIVE PURCHASE. SuperTab keeps one idempotency key per connected wallet and digest in browser storage, with the attempt id, amount, recipient, sponsor, and state. It does not store payment authorization. States cover prepared, submitted with an unknown outcome, payment confirmed without a certificate, certificate verified, timestamp proof pending, Bitcoin anchoring verified, and recovery unavailable. A lost response, a duplicate event, an expired quote, a changed payload, or a mismatched certificate leaves swap and payment retries false. A read-only or omitted wallet source cannot be an approval package. The claim panel states its purpose and that the challenge was not requested. Its button stays disabled. Fixtures in `tests/purchase-recovery.test.ts` are not a completed recovery.

BLOCKER. The documented idempotent retry needs the original payment, which this build does not create or retain. The documented lookup without a certificate id needs a wallet message signature, which is not authorized. Execution stays disabled. A later mainnet payment still needs a separate approval naming this product, 1.000000 USDC, and a fresh total SOL cap.

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

1. Under **Timestamp service — quote only**, choose **Use read-only demo wallet**. Confirm the panel calls that address read-only exploration and says it cannot produce an approval package. Confirm **Wallet claim, not requested** and that **Claim signature unavailable** stays disabled. Do not sign a control message or a claim. A connected Solana mainnet wallet is the spending-review identity; this step does not connect one. The earlier unpaid quote has expired. Do not refresh it only to repeat those numbers. Execution stays unavailable because a 24-hour idempotency retry still needs the original payment, and a certificate-less claim needs a wallet message.
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


## Recovery preparation — October 6, 2026

Wallet connection no longer requests a control challenge. It sets the connected account for quote review only; an optional control-message review and signature are separate explicit actions. The home screen now renders the wallet picker before a shopping session exists. Connection does not establish cryptographic control proof or spending approval.

The quote route journals the original merchant resource, idempotency key, wallet, and reviewed terms for connected-source reviews. Local server custody uses AES-256-GCM in ignored `data/purchase-recovery/`, with a separate random key in ignored `merchant/secrets/purchase-recovery.key`. The browser still stores only non-authorization attempt metadata. Never copy the key or journal into Git. Windows users must keep the workspace private; POSIX file modes do not establish Windows ACL protection. This local filesystem design is not suitable for an ephemeral deployment.

The server journal can retain an original payment authorization and mark an attempt outcome unknown before a future submission. These methods are fixture-tested only and have no HTTP execution endpoint or sender. They are not called by the quote UI. No payment authorization was created or stored in this work. Existing attempts cannot be replaced, corrupt/wrong-key storage fails closed, and restart preserves the encrypted original. An interrupted write can leave a lock requiring deliberate recovery; it never silently opens a second attempt.

Verified: 167 tests passed, 7 skipped; changed-file lint, TypeScript, and production build passed. Browser inspection confirmed connection wording and disabled claim/payment controls. This browser has no installed shopper wallet, so actual extension connection remains unverified. No claim, swap, payment, or new devnet checkout was requested.

Remaining work before mainnet execution: bind the future validated payment builder and explicit approval to the journal; retain its exact authorization before submission; implement only the documented same-payment recovery or explicit wallet-message claim. Refreshing a quote is not authorization. Original merchant request custody now exists, but neither live recovery nor executed conversion is proven. The product/USDC amount and fresh SOL cap still require owner approval.


## Unsigned sponsored-payment preview — October 6, 2026

The connected-source timestamp quote route now builds a version-0, no-lookup-table USDC payment preview and retains it in the encrypted journal. Its two signatures remain zero: sponsor slot 0, shopper slot 1. It contains bounded compute-budget instructions, one exact 1 USDC TransferChecked to the merchant ATA, and a merchant-supplied memo or an attempt-specific uniqueness memo. The sponsor is never an instruction account. Source and destination ATAs are derived from mainnet USDC.

A fresh quote can update unsigned review/transaction data only while the journal remains prepared and has no payment authorization. It cannot overwrite an authorized or submitted attempt. Transaction bytes are not returned to the browser, and no signing, payment submission, or recovery-replay endpoint was added. Zero requested priority price and 20,000 compute units are a preview policy, not proof that the sponsor accepts this transaction. Read-only exploration does not build or persist this payment preview.

Reference: https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_svm.md (read October 6). The specification separates valid payment outcomes from sponsor acceptance. The preview is not simulated, sponsor-approved, signed, sent, or funded by an executed conversion. Actual USDC balances must be rechecked after any future approved conversion.

Verification: 169 tests passed, 7 skipped; TypeScript and production build passed. Builder fixtures inspect wire-format signer slots, exact transfer, ATA derivation, sponsor isolation, memo, and rejection of stale/altered terms. Browser inspection confirmed quote-only controls and disabled claim signing. The real Phantom connection and connected-source live preview have not yet been exercised. No funds moved.

Next human check: in Edge with Phantom installed, open http://localhost:3000 (not /devnet), connect the intended wallet, confirm its public address in Timestamp service — quote only, and select Refresh unpaid quote. Approve connection only, not a message or transaction. The page should show the unsigned preview or a specific quote error; report which. Sign conversion, sign merchant payment, and send stay unavailable while the execution gate is off. A payment still requires a later approval naming this product, 1.000000 USDC, that wallet, and the fresh SOL cap then on screen.


## Blocked quote regression fixed — October 6, 2026

The owner connected Phantom and shared a screenshot showing wallet control verified, followed by a generic quote error. A read-only reproduction separated the service quote, journal, blockhash, and preview steps. The preview failed because that quote's sponsor differed from the previously reviewed sponsor. Price, mint, recipient, network, and resource matched. The route incorrectly attempted a preview despite the service's explicit blocker.

The quote route and browser now prepare/persist a new payment review only when readyForApproval is true. A blocked quote remains visible with its specific reasons, without preparing a payment or replacing recovery custody. An actual-route regression failed with HTTP 502 before the fix and passed afterward. A subsequent unpaid live request returned readyForApproval true, no blockers, an unsigned preview, and execution disabled. This does not prove sponsorship or execution; earlier reads did show a changed sponsor, so fresh terms remain necessary.

170 tests passed, 7 skipped; changed-file lint, TypeScript, and production build passed. No signature, swap, payment, or claim was requested. Refresh unpaid quote in the owner's connected browser to see either the unsigned preview or the specific blocker.
