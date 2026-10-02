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

`planFunding` spends existing USDC first, leaves 0.01 SOL untouched, and does not liquidate other tokens unless the shopper selects one. SOL is the only suggested funding asset. A DFlow quote is attached only when it matches the planning amount and the funding mint and is younger than 45 seconds. DFlow's quote-only response does not include an expiry, so that window is SuperTab's.

`fetchDflowOrder` calls `GET /order` on `DFLOW_QUOTE_BASE_URL`. Production is `https://quote-api.dflow.net` and sends `x-api-key`. The dev host works without a key. The request does not pass a wallet, so DFlow does not return a transaction. `executeSwap`, `executeCardPayment`, and `broadcastTransaction` always throw.

## Purchase and card rail

Purchase states move through checkout, funding, and an optional quote. If USDC already covers the known amount, the state becomes `PAYMENT_RAIL_UNAVAILABLE`. A live quote can reach `SWAP_QUOTE_READY` and then `AWAITING_SWAP_APPROVAL`. Approval does not enter `SWAP_PENDING`.

`UnavailablePaymentRail` is the only rail. `PAYMENT_CONFIRMED` cannot become `ORDER_CONFIRMED`. An order requires separate merchant-order evidence.

The known price used for planning is a catalog or listing price unless a future checkout integration supplies a merchant total.
