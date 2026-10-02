# SuperTab

SuperTab is AI shopping powered by Solana assets. A shopper describes a product. SuperTab searches real merchants, compares the offers it actually received, and works out whether USDC already in the shopper's Solana wallet covers the known price. If it does not, DFlow can quote a conversion from a supported Solana asset into USDC. A replaceable card rail is meant to pay an ordinary merchant later. That rail is not connected, and this build does not move funds.

## What works now

- Shopping requests and follow-ups, with hard constraints kept in application code.
- Shopify Global Catalog search, which does not need an API secret.
- eBay Browse search, after `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` are set.
- A read-only Solana address lookup, plus a clearly labeled sample-asset preview.
- A funding plan that uses integer token math.
- A live DFlow quote from the dev API, without a signature or a broadcast.
- A purchase review that keeps payment and merchant order separate.
- An honest "provider not connected" card rail.

Catalog and listing prices are not merchant checkout totals. Shipping and tax stay unknown unless a provider returns them.

## What is not executable

SuperTab will not swap, sign, broadcast, issue a card, or pay a merchant. Approving a conversion only records intent.

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

`SUPERTAB_LIVE=1 npm test` also requests one real DFlow quote.

## Safety

Do not put private keys, seed phrases, or card numbers in `.env.local` or the repository. Wallet reads use a public address only.
