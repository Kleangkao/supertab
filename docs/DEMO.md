# SuperTab demo

## Prototype script — no new payment

This build is a prototype. The devnet payment did not buy the tee, and no real-retailer purchase has been completed.

From `supertab-main`:

```bash
npm run merchant
npm run dev
```

Open http://localhost:3000.

1. Under **Timestamp service — quote only**, choose **Use read-only demo wallet**. This is SCVD’s digital timestamp service, “A Bitcoin Anchor,” quantity 1. It is not a shipped product. The panel should say this address is read-only exploration and cannot produce an approval package. Read **Purchase progress**. The execution gate is off. Prepare, sign, submit, reconcile, and replay stay disabled. The progress text names the conversion signature and the merchant-payment signature separately. Neither is requested. Recording terms appears only on a connected quote and does not sign or send. Read **Wallet claim, not requested**. The claim button stays disabled. That claim would be `signMessage` on a store challenge, not a transaction, and this demo does not request the challenge. Do not connect a wallet unless you are ready to dismiss the control-message prompt; do not sign it. The October 5 unpaid quote has expired. Do not refresh it just to repeat the same numbers, and do not pay. Do not refund the existing devnet orders.
2. Read **Real product — quote only**. It is Solana Spaces, Just Build It Tee, Medium, quantity 1, checked October 5, 2026, for an authorized Thailand destination. The recorded breakdown is item $35.00, GlobalPost Economy shipping $20.53, displayed tax $0.00, merchant total $55.53, and a visible USDC option of $55.53. Estimated delivery was October 19. Duties and network fees are unverified. There is no payment action.
3. If you want a current merchant total, use **Open Solana Spaces for a fresh quote**. That leaves SuperTab. Do not pay.
4. Choose **View verified test order**. SuperTab reads order `e485b032-7abd-4a59-849c-f37775ec57c6` from the local merchant. Say the status the merchant returns. Do not describe the page as creating that order.
5. Optional: open **Devnet test purchase** at http://localhost:3000/devnet and use the same view action. Leave the two earlier paid orders as they are. Do not start a checkout.
6. Under **Asset conversion — quote only**, read the devnet finding: DFlow has no route from wrapped SOL into Circle devnet USDC. Do not treat that card as a swap.
7. For a mainnet quote, leave the address empty or enter a public Solana address. Choose SOL and `0.01`, then **Request quote**. Read the input mint, mainnet USDC mint, estimated output, minimum received, slippage, provider fee, and network-fee note. The quote expires 45 seconds after it arrives. The recorded $55.53 comparison is the October 5 Solana Spaces evidence, not a payable total. There is no sign or send control. A checked transaction was not broadcast.

The devnet USDC amount is the test price. Devnet SOL is only the network fee. Devnet checkout does not use the conversion quote.

## Proposed stable demo flow (prototype-journey)

Final demo recording stays paused until the owner freezes this flow. Use hosted `d42c4f9` (or later) after an authorized main push — not the older `aead101` production tip.

1. Open shopping. Describe a product; refine once. Say listings are real provider results, not a payable merchant total.
2. Shortlist and compare. Name shortlist cards as dated browser snapshots.
3. Select one offer. Open funding review. Label sample balances as simulated; treat a live quote as a current read, not a completed conversion. Do not sign or send.
4. Open the **Purchase journey** map. Keep the goal: AI shopping that uses Solana assets to complete purchases. Read the nearby limit: retail payment and merchant order completion are unavailable. Badges are capability/read status, not finished stages.
5. Open **Try the payment journey**. Announce local simulation. Point out invented $5 shipping / $3 tax. Approve, optionally leave a lost-response pending, then resolve with late fixture evidence or authorize and capture. Live statuses stay not executed / not created.
6. Open a merchant handoff link. Say product page vs cart permalink vs unknown destination. A cart link may add an item; it does not pay or place an order.
7. Stop. Do not request signatures, swaps, retail payment, or refunds.

### Demo-flow stability checklist

- [ ] Journey map and claims match the deployed commit
- [ ] Sample balances labeled simulated; quotes not described as completed conversions
- [ ] Rehearsal stays `local_simulation` and cannot change live authority
- [ ] Browser shopping → shortlist → compare → funding → journey → rehearsal → handoff verified on that build
- [ ] Android/WebView loads the intended hosted URL; back/merchant return checked
- [ ] No unresolved critical usability or safety issues
- [ ] Provider blockers listed once; frozen external work not pursued mid-demo
- [ ] Source commit, Vercel deployment id, and APK version/hash recorded
- [ ] Owner agrees the flow is frozen before any final recording

## Two-minute presenter flow

Historical shopping and simulated-card rehearsal below. Prefer **Proposed stable demo flow** above for the current presentation. The matrix below predates the verified Phantom devnet purchase/refund and must not be used as the current capability summary. CardRail remains unconnected and is not required by the current prototype.

1. Ask for a black polo under $50. Explain that these are real provider listings, with actual merchant names and prices. Follow up with a preference to show conversation constraints persist.
2. Select a product. Show its variant and merchant-review link. Say: "This is the listed amount. Final shipping and tax still need the merchant's checkout; SuperTab will not call this a verified payable total."
3. Choose the explicit real demo wallet in read-only mode, or enter an authorized public Solana address. Show USDC already present, the funding gap, the selected funding asset and the SOL reserve.
4. If a DFlow quote arrives, explain minimum received, expiry and whether it covers the gap. If funds are insufficient, show that result and choose a cheaper product. Do not claim a swap is complete when an unsigned transaction is merely prepared.
5. In the purchase review, read the **Purchase journey** map. Name which stages are live, implemented, simulated, or provider-blocked. Keep the original goal explicit.
6. Open **Try the payment journey**. The selected product's listed amount is reused, but $5 shipping and $3 tax are invented local fixtures. Explicitly announce the switch to simulation. Approve the displayed simulated total, optionally show a lost response as pending, then authorize and capture.
7. Point out that simulated capture leaves the merchant order uncreated, while live statuses stay not executed / not created. Add the simulated receipt separately. Optionally show refund and delayed/duplicate event replay. No card, payment or order has been created externally.
8. End with the bridge: "The product is AI shopping that uses Solana assets to complete purchases. Live shopping and funding exist today. Card-rail sandbox access and Shopify order-complete permission are the resume conditions for live payment and order evidence."

## Capability matrix

| Stage | Current evidence | Boundary |
| --- | --- | --- |
| Product discovery | Real Shopify catalog; configured eBay Browse | Listed amount is not a final checkout total |
| Merchant review | Provider-returned HTTPS cart/product link; actual True Classic checkout inspected | Checkout was incomplete without delivery/contact details |
| Wallet balance | Real Solana RPC reads, aggregated token accounts | Address reads do not prove wallet ownership or purchase consent |
| Wallet connection | Wallet Standard discovery/connect and explicit message-control checks; real Ed25519 verification in deterministic tests | Extension signing remains unproven in the in-app browser. Message proof is not transaction or purchase approval |
| Devnet transaction signing | Optional exact-memo sign-only path with signature verification; live devnet blockhash/fee-format checks pass | Real extension ceremony unproven; no broadcast, conversion or USDC readiness implied |
| Funding | Integer amounts, existing canonical USDC, reserved SOL, selected asset | Current amount is a planning amount; sample assets are labeled |
| DFlow | Live mainnet quotes; unsigned transactions checked for payer, mints, amounts, destination, and disclosed fee | No signing, broadcast, simulation, or executed swap. No devnet USDC route |
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


## October 6 connection and recovery update

Connect wallet now requests only wallet connection. The optional control-message review is a separate button; do not click its signature action during a quote-only demonstration. A browser without the shopper extension cannot prove actual connected-wallet behavior. Read-only demo wallets remain exploration only.

Connected quote requests retain their original merchant request and review privately on the local server. Swap submission and merchant `PAYMENT-SIGNATURE` submission are implemented and fixture-tested. Both check the server execution gate and stay refused while that gate is off. Claim signing remains disabled. Do not describe this as a completed mainnet purchase or live recovery test.


## Connection-only Phantom check

Open http://localhost:3000 in the browser with Phantom installed. Click Connect wallet and approve sharing the public address. Do not select the optional control-message signature. Confirm the Timestamp service panel shows the intended connected wallet and mainnet, then click Refresh unpaid quote. The merchant preview is unsigned, stored privately, and has no execution control. Read-only demo exploration does not build a merchant payment preview. Sponsor acceptance remains unverified.
