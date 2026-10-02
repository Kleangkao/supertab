# SuperTab demo

## Two-minute presenter flow

1. Ask for a black polo under $50. Explain that these are real provider listings, with actual merchant names and prices. Follow up with a preference to show conversation constraints persist.
2. Select a product. Show its variant and merchant-review link. Say: "This is the listed amount. Final shipping and tax still need the merchant's checkout; SuperTab will not call this a verified payable total."
3. Choose the explicit real demo wallet in read-only mode, or enter an authorized public Solana address. Show USDC already present, the funding gap, the selected funding asset and the SOL reserve.
4. If a DFlow quote arrives, explain minimum received, expiry and whether it covers the gap. If funds are insufficient, show that result and choose a cheaper product. Do not claim a swap is complete when an unsigned transaction is merely prepared.
5. Open **Try the payment journey**. The selected product's listed amount is reused, but $5 shipping and $3 tax are invented local fixtures. Explicitly announce the switch to simulation. Approve the displayed simulated total, authorize, then capture.
6. Point out that simulated capture leaves the merchant order uncreated. Add the simulated receipt separately. Optionally show refund and delayed/duplicate event replay. No card, payment or order has been created externally.
7. End with the bridge: "Solana supplies the assets, DFlow supplies conversion quotes, and a provider-neutral CardRail is designed to connect purchasing power to normal merchants. Verified checkout totals and actual sandbox CardRail access are the next integration milestones."

## Capability matrix

| Stage | Current evidence | Boundary |
| --- | --- | --- |
| Product discovery | Real Shopify catalog; configured eBay Browse | Listed amount is not a final checkout total |
| Merchant review | Provider-returned HTTPS cart/product link; actual True Classic checkout inspected | Checkout was incomplete without delivery/contact details |
| Wallet balance | Real Solana RPC reads, aggregated token accounts | Address reads do not prove wallet ownership or purchase consent |
| Wallet connection | Wallet Standard discovery/connect and explicit message-control checks; real Ed25519 verification in deterministic tests | Extension signing remains unproven in the in-app browser. Message proof is not transaction or purchase approval |
| Devnet transaction signing | Optional exact-memo sign-only path with signature verification; live devnet blockhash/fee-format checks pass | Real extension ceremony unproven; no broadcast, conversion or USDC readiness implied |
| Funding | Integer amounts, existing canonical USDC, reserved SOL, selected asset | Current amount is a planning amount; sample assets are labeled |
| DFlow | Live quotes and structurally valid unsigned preparation verified | No signing, broadcast, executed swap or execution simulation |
| Final-total integration | Authenticated Shopify `get_checkout`, exact variant/quantity binding, integer breakdown checks and five-minute freshness; deterministic adapter/service tests | Existing checkout reference and explicitly configured merchant origin required; live final-total acceptance remains unproven |
| Purchase approval | Final-total gate returns HTTP 403 when total is unknown; verified totals support consent bound to current terms | Catalog planning cannot become approved merchant payment; approval does not submit payment |
| CardRail | Provider-neutral interface and Bridge sandbox adapter | Access blocked; no issued card or provider payment readiness proof |
| Payment lifecycle | Local selected-product fixture, explicit consent, authorization/capture/refund ledger | Not Bridge/Stripe sandbox execution; no network payment calls |
| Merchant order | Independent simulated receipt fixture | No real merchant order created or verified |

## Before presenting

- Run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` before starting a fresh server. An existing development shopping-service instance can retain older module references after edits; restart before a presentation and create a new search.
- Load local configuration without printing secrets. Optionally run the opt-in read-only live tests as documented in README. Quotes and balances fluctuate; never promise a particular item is fundable before reading current data.
- Keep financial execution disabled. Do not top up the demo wallet, enter card data, submit merchant checkout or claim provider sandbox access.
- A page refresh can restore the server's temporary shopping session. A server restart loses it; the local rehearsal always resets on refresh. Explain any provider outage and preserve the selected item where possible.

## Remaining submission work

Capture final mobile/desktop screenshots and a video after the integrated checkout milestone is resolved. Deployment requires an approved destination. The existing private GitHub repository is accessible on this PC. Do not publish this app or its environment configuration to a replacement public destination.
