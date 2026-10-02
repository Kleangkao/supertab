# SuperTab

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
- An honest "provider not connected" card rail.
- A separate local payment rehearsal with explicit approval, authorization, decline, capture, independent simulated order evidence, and refund. It makes no provider calls and uses a fixed $48 fixture rather than the selected product or wallet.

Catalog and listing prices are not merchant checkout totals. Shipping and tax stay unknown unless a provider returns them.

The purchase review links to the provider's merchant cart or product page when an HTTPS link is available. Opening that page does not approve a purchase or import a verified final total. See [checkout access research](docs/CHECKOUT_RESEARCH.md) for authenticated Shopify and restricted eBay checkout requirements.

## What is not executable

SuperTab will not swap, sign, broadcast, issue a card, or pay a merchant. The interface stops at awaiting user approval and exposes no execution button. Existing approval endpoints record intent only.

## Presenter flow

1. Ask “Find me a black polo under $50.”
2. Follow up with “Navy is fine too.” The product, budget, and both colors remain visible.
3. Select a real product and choose **Use real demo wallet — Read-only**. This explicit convenience uses the session demo address `JCVsKd4TMg1fvEs7rjf5YgLYbJfNC8Dwb4x1PchFkGM7`; it is never selected automatically or used as a universal wallet.
4. Review the planning amount, actual USDC, funding gap, and live DFlow quote. A fundable real-wallet plan prepares an unsigned transaction and reaches `AWAITING_SWAP_APPROVAL`. No approval is recorded automatically.
5. If the countdown expires, choose **Refresh funding quote**. Product and wallet context stay in place.
6. Point out the future CardRail and the explicit payment/order statuses. Bridge sandbox access is blocked, no card exists, and merchant order creation is not implemented.
7. Optionally use **Try the payment journey** to rehearse the lifecycle locally. Approve the simulated $48 purchase, authorize, then capture. The order remains uncreated until you add the simulated receipt. A refund preserves the recorded order history. This is local simulation, not Bridge sandbox verification; resetting or refreshing clears it.

Balances and prices change. During the October 2, 2026 verification, the demo wallet held about 0.057 SOL and 0.000004 USDC. After reserving 0.01 SOL, DFlow quoted about 5.73 USDC of funding capacity. The $27 polo was correctly insufficient; following up with “Under $5 please.” found a real $4 Shopify polo that reached unsigned preparation. Do not imply a more expensive item is fundable or top up this wallet as part of automated demo work.

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
| `SOLANA_RPC_URL` | Optional. Blank uses public mainnet. |
| `DFLOW_QUOTE_BASE_URL` | Defaults to the DFlow dev quote API, which does not need a key. |
| `DFLOW_API_KEY` | Only if you point quotes at a key-gated DFlow host. |
| `SHOPIFY_CATALOG_ENABLED` | Shopify discovery is on by default and needs no secret. |

`GET /api/health` reports configured, not configured, available, unavailable, or not connected. It never returns secret values.

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
