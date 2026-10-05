# SuperTab

Prototype. A shopper can review one recorded Solana Spaces quote and, separately, a completed owner-controlled devnet purchase and refund. The devnet payment did not buy the shirt, and no real-retailer purchase has been completed.

From this directory, start the local merchant with `npm run merchant`, then `npm run dev`, and open http://localhost:3000. The no-payment demo is in [docs/DEMO.md](docs/DEMO.md). Current evidence is in [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md).

SuperTab is AI shopping powered by Solana assets. A shopper describes a product. SuperTab searches real merchants, compares the offers it actually received, and works out whether USDC already in the shopper's Solana wallet covers the known price. If it does not, DFlow can quote a conversion from a supported Solana asset into USDC. A replaceable card rail is meant to pay an ordinary merchant later. That rail is not connected, and this build does not move funds.

## What works now

- Shopping requests and follow-ups, with hard constraints kept in application code.
- Shopify Global Catalog search, which does not need an API secret.
- eBay Browse search, after `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` are set.
- A read-only Solana address lookup, plus a clearly labeled sample-asset preview.
- Wallet Standard discovery handles wallets that register after the page loads, deduplicates extensions and lets the shopper choose between multiple wallets. An empty connection response cannot reuse an old account.
- A funding plan that uses integer token math.
- A live DFlow quote from the dev API, without a signature or a broadcast.
- Real unsigned transaction preparation for a public wallet, with structural format checks. The preparation response supplies the displayed quote; no transaction payload or key is sent to the browser.
- Quote expiry countdown, refresh without losing the selected product, and browser refresh recovery while the server session remains available.
- A purchase review that keeps payment and merchant order separate.
- Authenticated Shopify checkout pricing for explicitly configured merchant origins. A buyer-entered destination can be sent with `create_checkout`. A reconciled total that includes shipping and tax becomes a merchant-calculated funding amount and can still change. Only a current `ready_for_complete` response, with no blocking message and no provisional discount, can be approved. Evidence expires after at most five minutes. SuperTab never calls `complete_checkout`.
- An honest "provider not connected" card rail.
- A local payment rehearsal for the selected product with explicit approval, authorization, decline, capture, independent simulated order evidence, and refund. It uses the listed item amount plus clearly invented $5 shipping and $3 tax fixtures, makes no provider calls, and never uses wallet funds.

Catalog and listing prices are not merchant checkout totals. Shipping and tax stay unknown unless a provider returns them.

The purchase review links to the provider's merchant cart or product page when an HTTPS link is available. Opening that page does not approve a purchase or import a verified final total. See [checkout access research](docs/CHECKOUT_RESEARCH.md) for authenticated Shopify and restricted eBay checkout requirements.

## What is not executable

SuperTab will not sign production transactions, broadcast transactions, execute swaps, issue cards, or pay merchants. Connected wallets that support `solana:signMessage` can explicitly sign a wallet-control message. This is independent of purchase and swap consent. Existing approval endpoints record intent only.

Wallet control uses a server-generated challenge bound to the app origin, session, current review, address and random nonce. The shopper reads the exact message before requesting the signature. The server verifies Ed25519, consumes the challenge on any verification attempt, and discards the signature. Challenges and proofs expire after five minutes; a review refresh or wallet change clears them. Tests use generated ephemeral keys to verify real signatures and rejection paths. On October 3, 2026 an Edge extension signed the control message and the server verify request returned HTTP 200. That proof expired after five minutes, was not stored, and does not establish transaction-signing readiness.

After wallet control is verified, **Test wallet transaction signing · Devnet** offers an optional sign-only check for accounts that advertise legacy devnet support. The server prepares a single memo using a fresh blockhash from the fixed public devnet RPC. The user reviews the memo and explicitly requests `solana:signTransaction` with chain `solana:devnet`. Both browser and server reject changed transaction bytes; the server verifies the signature, consumes the check and discards the signed payload. Checks expire after 60 seconds or a changed review. Nothing is broadcast, no fee is incurred by SuperTab, and purchase/funding/payment states remain separate. This diagnostic proves neither DFlow conversion nor USDC readiness. A live fee-query test proves the message format is accepted by devnet; an actual extension signature is still unproven here.

Purchase approval additionally requires a verified final merchant checkout total. A catalog or listing planning amount is rejected with HTTP 403 rather than recorded as an approved purchase. Payment readiness requires final-total knowledge, current approval, real on-chain USDC coverage and a ready rail; a live conversion quote or sample balance cannot substitute for funds already available.

## Presenter flow

1. Ask “Find me a black polo under $50.”
2. Follow up with “Navy is fine too.” The product, budget, and both colors remain visible.
3. Select a real product and choose **Use real demo wallet — Read-only**. This explicit convenience uses the session demo address `JCVsKd4TMg1fvEs7rjf5YgLYbJfNC8Dwb4x1PchFkGM7`; it is never selected automatically or used as a universal wallet.
4. Review the planning amount, actual USDC, funding gap, and live DFlow quote. A fundable real-wallet plan prepares an unsigned transaction and reaches `AWAITING_SWAP_APPROVAL`. No approval is recorded automatically.
5. If the countdown expires, choose **Refresh funding quote**. Product and wallet context stay in place.
6. Point out the future CardRail and the explicit payment/order statuses. Bridge sandbox access is blocked, no card exists, and merchant order creation is not implemented.
7. Optionally use **Try the payment journey** to rehearse the selected product's lifecycle locally. Its simulated amount includes invented shipping and tax, not merchant-verified fees. Approve that simulated amount, authorize, then capture. The order remains uncreated until you add the simulated receipt. A refund preserves the recorded order history. This is local simulation, not Bridge sandbox verification; resetting, refreshing or changing product terms clears it.

See [the demo script and capability matrix](docs/DEMO.md) for a concise presentation with honest boundaries.

Balances and prices change. During the October 2, 2026 verification, the demo wallet held about 0.057 SOL and 0.000004 USDC. After reserving 0.01 SOL, DFlow quoted about 5.73 USDC of funding capacity. The $27 polo was correctly insufficient; following up with “Under $5 please.” found a real $4 Shopify polo that reached unsigned preparation. Do not imply a more expensive item is fundable or top up this wallet as part of automated demo work.

Real wallet balance reads expire after one minute. The browser immediately hides expired balances and funding evidence; server reads and approval requests invalidate stale funding, approvals and signing diagnostics. **Refresh wallet balances** reads the address again and requires a new review. A still-current merchant checkout total is preserved. Even a fresh balance read is a snapshot, not a reservation of funds.

Sample preview uses illustrative balances and never prepares a transaction. Wallet connection requires a supported browser extension; a restored connected session is displayed as read-only until reconnected. Sessions are held in server memory: a page refresh recovers them, while a server restart requires a new search. Structural transaction validation is not execution simulation or verification of every program’s semantics.

## Requirements

- Node.js 20.19 or newer. This project was built with Node.js 24.16.
- npm 11.

## Setup

```bash
git clone <your-private-supertab-repo>
cd supertab
npm ci
cp .env.example .env.local
npm test
npm run dev
```

On Windows PowerShell, copy the environment file with `Copy-Item .env.example .env.local`.

Open http://localhost:3000.

## Configuration

| Variable | Required for |
| --- | --- |
| `GEMINI_API_KEY` | Gemini shopping understanding. Without it, SuperTab uses a deterministic parser. |
| `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` | eBay listing search. |
| `SOLANA_RPC_URL` | Optional. Blank uses public mainnet. Devnet checkout does not read this variable. |
| `SOLANA_CLUSTER` | Shopping funding uses mainnet. The RPC genesis hash must match mainnet even if configuration labels it otherwise. |
| `SOLANA_DEVNET_RPC_URL` | Optional HTTPS devnet endpoint for the owner-controlled checkout. Blank uses public devnet. The merchant verifies the genesis hash and refuses mainnet or testnet. |
| `DFLOW_QUOTE_BASE_URL` | Defaults to the DFlow dev quote API, which does not need a key. |
| `DFLOW_API_KEY` | Only if you point quotes at a key-gated DFlow host. |
| `SHOPIFY_CATALOG_ENABLED` | Shopify discovery is on by default and needs no secret. |
| `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` | Optional Catalog credentials for authenticated merchant checkout reads. A token is obtained server-side at request time. |
| `SHOPIFY_CHECKOUT_ACCESS_TOKEN` | Optional existing token instead of client credentials. Never exposed to the browser. |
| `SHOPIFY_CHECKOUT_ALLOWED_ORIGINS` | Comma-separated HTTPS merchant origins approved to receive the checkout token, without paths. Empty disables checkout reads. |
| `SHOPIFY_LOCAL_BUYER_IP` | Actual public buyer IP for this single-user PC. Used only for same-origin localhost checkout reads; refresh it if your network address changes. |
| `SHOPIFY_TRUSTED_BUYER_IP_HEADER` | Hosted deployments only: one supported IP header overwritten by a trusted proxy. Forwarded address lists are rejected. |

`GET /api/health` reports configured, not configured, available, unavailable, or not connected. It never returns secret values.

On this PC, the repository is in `F:\James\codex project file\SuperTab\supertab-main`. Run commands from that directory. Existing Shopify and eBay credentials were restored from the local agenttab configuration; DFlow and Solana RPC configuration came from Artportal. Gemini and Bridge credentials were not found in the supplied project folders. `.env.local` remains ignored by Git. Shopify bearer-token checkout reads also require the buyer IP header; this is private server request context, not a session or model field. Configured credentials alone do not prove that a merchant checkout is ready or that payment access is available.

For a merchant-calculated total, select the exact product and quantity and submit the real delivery destination in the purchase review. SuperTab calls `create_checkout` and does not complete it. Shipping and tax are accepted only when the merchant returns those components. An existing checkout reference can still be read with `get_checkout`. A cart reference, subtotal-only checkout, extra items, mismatched variant/quantity, inconsistent money, or an expired checkout cannot supply a payable amount. Purchase approval remains limited to a ready final total.

Once a final total is verified, **Approve purchase terms** records consent for the displayed product and amount. It does not sign a swap, pay a merchant or create an order. A wallet refresh resets approval; product or quantity changes also discard checkout evidence. Buyer contact details and payment instruments returned by the merchant are discarded, and checkout capability references are not included in session responses.

## Scripts

```bash
npm test
npm run typecheck
npm run build
npm run dev
```

`SUPERTAB_LIVE=1 npm test -- --testTimeout=30000` also requests a real DFlow quote, prepares an unsigned transaction, and reads a public Solana address. Set `SUPERTAB_PUBLIC_ADDRESS` to override the public test address. Neither call signs or broadcasts. Load local environment configuration before running these checks (for example, Node’s `--env-file=.env.local`); never print credential values.

## Safety

Do not put private keys, seed phrases, or card numbers in `.env.local` or the repository. Wallet reads use a public address only.
