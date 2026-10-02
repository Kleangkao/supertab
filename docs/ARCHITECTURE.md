# Architecture

SuperTab is one Next.js application. The browser talks to route handlers. Those handlers call provider code on the server. Secrets stay in environment variables.

## Shopping

`ShoppingService` keeps a short-lived session: conversation, constraints, offers, the selected product, and the funding quote.

`resolveConstraints` merges a shopper message into the current constraints. Gemini, when `GEMINI_API_KEY` is set, may propose a patch through the Interactions API. The model id comes from `GEMINI_MODEL` and defaults to `gemini-3.5-flash-lite`. The raw reply is read from the `steps` timeline. The application still applies the shopper's explicit budget, color, size, and product words. Gemini is not allowed to invent prices or listings. The request sets `store` to false. One short retry covers HTTP 429 when `Retry-After` is absent or at most 1.5 seconds. A longer rate limit returns a busy reply and keeps the constraints already taken from the shopper's words. One session does not send two Gemini calls at the same time.

`searchShopify` and `searchEbay` implement the same search result shape. Shopify calls the public Global Catalog MCP endpoint `https://catalog.shopify.com/api/ucp/mcp`. eBay calls the Browse API with an application token and stays disabled until both client credentials exist. A timeout or outage on one provider does not stop the other.

`classifyOffers` drops anything that misses a hard constraint and keeps the reason. Unknown shipping, tax, and checkout stay unknown.

## Money, wallet, and funding

Amounts are bigint minor units. USDC is recognized only by mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`.

`createReadOnlyWallet` reads SOL and SPL balances through JSON-RPC. It refuses to prepare a signature. The sample preview is labeled and is not chain data.

The optional `/api/wallet/devnet` diagnostic requires current wallet-control proof and terms ID. It prepares only a one-signer legacy memo from a fixed Devnet RPC, with a 60-second application deadline. `devnet-memo.ts` constructs and checks that narrow wire format in both browser and server; it cannot construct transfers. Wallet Standard is called with `solana:devnet`, after confirming the account, chain, feature and legacy format capability. Signature verification compares every message byte to the prepared memo and verifies Ed25519. The check is consumed on every confirmation attempt and only a timestamp/chain/not-broadcast receipt is retained. A changed review invalidates pending preparation; no RPC send or wallet sign-and-send method exists on this path. This receipt is independent of production DFlow, funds readiness, purchase consent, CardRail and merchant order.

`/api/wallet/control` permits same-origin POSTs to request and verify a nonfinancial message challenge for the connected session address. `wallet-proof.ts` binds that challenge to the current terms ID, app origin, session, nonce and five-minute deadline. The server verifies the exact UTF-8 message with Ed25519 using the address-derived public key, consumes every verification attempt and stores only proof timestamps. It never stores signatures or grants execution permissions. Client Wallet Standard signing rejects modified messages, wrong signature formats and stale selected accounts. A review or account change invalidates the challenge/proof. A browser extension is still needed to prove the real user ceremony.

`planFunding` spends existing USDC first, leaves 0.01 SOL untouched, and does not liquidate other tokens unless the shopper selects one. SOL is the only suggested funding asset. A DFlow quote is attached only when it matches the planning amount and the funding mint and is younger than 45 seconds. DFlow's quote-only response does not include an expiry, so that window is SuperTab's.

`fetchDflowOrder` calls `GET /order` on `DFLOW_QUOTE_BASE_URL`. Production is `https://quote-api.dflow.net` and sends `x-api-key`. The dev host works without a key. The request does not pass a wallet, so DFlow does not return a transaction. `executeSwap`, `executeCardPayment`, and `broadcastTransaction` always throw.

## Purchase and card rail

Purchase states move through checkout, funding, and an optional quote. If USDC already covers the known amount, the state becomes `PAYMENT_RAIL_UNAVAILABLE`. A live quote can reach `SWAP_QUOTE_READY` and then `AWAITING_SWAP_APPROVAL`. Approval does not enter `SWAP_PENDING`.

`BridgeCardRail` implements the provider-neutral rail interface and currently reports unavailable sandbox access. Its payment preparation throws while execution is disabled. Purchase intents obtain the provider ID from the selected adapter. `PAYMENT_CONFIRMED` cannot become `ORDER_CONFIRMED`. An order requires separate merchant-order evidence.

The known price used for planning is a catalog or listing price until an authenticated merchant checkout supplies a verified total.

`merchant-checkout.ts` implements a read-only Shopify Checkout MCP boundary. The server derives the merchant origin from the selected offer, requires an explicit origin allowlist, refuses redirects, authenticates with a configured token or existing Catalog client credentials, and invokes only `get_checkout`. It accepts one exact variant and quantity in a USD `ready_for_complete` checkout with unexpired evidence and a reconciled integer amount breakdown. Missing or escalated checkout state cannot supply a verified payable total. Raw buyer, payment and capability data are discarded.

Final-total evidence is bound to the selected product/quantity and retained for at most five minutes. Every new wallet/funding review obtains a new terms ID and clears purchase approval; changing product or quantity discards checkout evidence too. Approval must submit the currently displayed terms ID and expires no later than checkout evidence. A failed checkout refresh removes old final-total evidence and approval before the provider call. Session reads expire evidence and revert to catalog planning rather than leaving stale final amounts usable. Verification failures return the sanitized current session so the browser clears obsolete approval.

Wallet reviews and conversation turns use separate working records. Once a later review replaces the session record, an older balance/quote request cannot publish its results into it. The regression reproduces an old RPC balance read completing after a clear-wallet action.

Purchase approval requires a known final merchant total, independently of conversion quote review. Payment readiness requires current approval, that final total, real chain USDC coverage and a ready rail. Sample balances and a conversion quote cannot satisfy funds readiness.

## Payment evidence and local rehearsal

`payment-ledger.ts` is a pure reducer for full-amount USD payment evidence. It binds every event to a purchase, currency, amount and evidence mode. Identical event IDs are idempotent; reusing an ID for different evidence is rejected. Capture can arrive before authorization without being downgraded when authorization arrives later. Refund requires capture evidence and leaves an early refund available for retry; delayed earlier events cannot undo a recorded refund. Partial authorizations, captures and refunds are not supported and are rejected by amount matching.

The ledger does not authenticate providers, submit payments, confirm merchant orders or persist state across server restarts. A future provider boundary must authenticate events, resolve provider references to the correct purchase, persist the ledger atomically, and reconcile rejected/out-of-order events. The current application uses it in `payment-rehearsal.ts` with local fixtures only. Browser controls can replay capture and delayed authorization to demonstrate non-regression. Those events never modify the real shopping session or rail status.
