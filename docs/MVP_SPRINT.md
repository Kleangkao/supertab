# MVP sprint — started October 2, 2026

The existing app stays in place. Financial execution remains disabled. The owner's sprint prompt permits wallet signing UX and sandbox/devnet work; explicit nonfinancial message signing is now implemented. Production transactions, broadcasts, card issuance and merchant payments remain disabled. Secrets remain in .env.local. Earlier cycles below describe their state at the time; the latest verified cycle is authoritative.

## First verified cycle

- Fixed approval requesting a fresh DFlow preparation after review. Approval now records the displayed quote without replacing its terms. Refresh continues to invalidate approval.
- Added an isolated local payment rehearsal. A fixed $40 item plus $5 shipping and $3 tax produces a simulated $48 checkout. Explicit approval precedes authorization; authorization precedes capture; capture does not create an order. Simulated receipt evidence and refund are separate actions.
- Verified 38 deterministic tests, typecheck, lint and production build. Three opt-in live tests were skipped.
- Browser verification searched real Shopify products, selected a $27 Black Torrey Polo, and exercised simulated approval, authorization, capture, independent order evidence and refund. Real checkout total stayed unknown.
- GitHub repository lookup and git ls-remote both returned Repository not found. Push is blocked by repository access; do not change the destination or publish elsewhere.

## Wallet funding correction

A second red/green regression reproduces two canonical USDC accounts ($5 and $7) incorrectly funding a $10 planning amount from the first account only. The wallet reader now aggregates all accounts by mint before planning, quoting or display; conflicting decimals fail the balance read instead of combining incompatible units. The suite now has 40 deterministic passing tests (three opt-in live checks remain skipped).

## Capability boundaries

After the deterministic checks, all three opt-in live checks passed using local environment configuration and the explicit public demo address: Solana SOL/token balance reads, a real DFlow SOL → USDC quote without a transaction, and structurally valid unsigned preparation without exposing its payload. No signature, broadcast or payment occurred.

Real discovery and provider-backed wallet/quote reads remain available in the implementation. This cycle verified real Shopify discovery in the browser, not wallet signing, live payment or a merchant order. Local rehearsal never changes the shopping session's approval, funding, payment or order status and never calls Bridge or Stripe. It is not provider sandbox proof.

## Next priorities and verifiable outcomes

### Wallet discovery and merchant review cycle

Fixed the Wallet Standard late-registration callback shape, one registry per browser window, duplicate registration and unregister handling. Connection no longer falls back to an old account when the wallet returns no authorized accounts. Three focused regressions failed before these fixes and pass afterward. Multiple extensions now produce a wallet picker instead of silently selecting the first.

Added an HTTPS merchant-review link to the selected product's cart or product page, with explicit copy that it neither approves nor verifies the total. Official checkout access research is in CHECKOUT_RESEARCH.md. Shopify requires authenticated or signed checkout requests; eBay checkout has additional access approval requirements. Neither catalog search nor a cart estimate has been promoted to final checkout evidence.

44 deterministic tests, typecheck, lint and build pass. Browser verification uses a restarted local server because a previously retained global shopping-service instance did not pick up the new serialized field during hot reload. Real extension signing remains unverified and disabled.

The real merchant link reached True Classic checkout for the exact selected size/quantity. Read-only WebMCP returned an incomplete checkout with matching item amount but missing contact/delivery details and fulfillment groups. This is stronger evidence of the remaining total gap and reveals a browser-backed read path distinct from server API authentication. The browser without a wallet extension correctly showed the read-only fallback, without pretending to connect.

### Final-total approval and payment readiness cycle

A fresh-session regression proved that approvePurchase previously marked a catalog planning amount approved while finalTotal was unknown. Approval now rejects that case with PurchaseApprovalError (HTTP 403). Payment readiness additionally checks final-total knowledge and real chain USDC coverage; quoted conversion output and sample funds do not count as funds ready. Purchase intents accept the selected adapter's provider ID instead of hard-coding Bridge. The local simulation remains independent and continues to exercise approval and lifecycle states.

46 deterministic tests, typecheck, lint and production build pass. A real HTTP search/review returned finalTotal unknown, purchaseApproval required and PAYMENT_NOT_READY; posting the intent endpoint returned HTTP 403 with the final-total explanation. This closes an invariant violation, not the checkout integration gap. Financial execution is still disabled.

1. Merchant checkout evidence: investigate legitimate provider access, attach an amount to the selected merchant/product/variant/quantity and freshness, and invalidate approval when terms change. Catalog data or a manually entered amount must never claim a verified final total.
2. Wallet connection reliability: exercise Wallet Standard discovery, account changes, disconnection and refresh. Keep signing disabled and account permissions distinct from purchase approval.
3. Payment lifecycle integration: provider-neutral event handling, duplicate/out-of-order protection, independent order evidence, then real sandbox evidence if access becomes available. Avoid prolonged onboarding attempts.
4. Funding robustness: verify fresh prepared minimum output, network reserve, multiple token accounts and balance refresh against focused regression tests.
5. Submission: honest capability matrix, reliable presenter flow, responsive browser verification and screenshots after core gaps are addressed.

The largest remaining product gap is a verified final merchant checkout amount. The local rehearsal proves application lifecycle rules only; it does not close that gap or prove spending readiness.

## Payment-event reliability cycle

Added a provider-neutral, side-effect-free payment evidence ledger and integrated it into the existing local rehearsal. It binds purchase, amount, currency and live/sandbox/local mode, deduplicates event IDs and rejects conflicting duplicate evidence. Capture and refund do not regress when authorization or capture arrive late; early refunds can be retried after capture. The ledger has no merchant-order field, so payment events cannot manufacture order confirmation. Full-amount USD only; partial financial lifecycle accounting remains unsupported.

50 deterministic tests, typecheck, lint and production build pass. Browser verification exercised approval, authorization, capture, duplicate capture and delayed authorization, then refund followed by both replays. Capture and refund stayed recorded and merchant order stayed uncreated. No provider event ingestion endpoint or financial execution was enabled. Authentication and durable atomic storage remain required before provider integration.

## Selected-product demo cycle

The payment rehearsal now uses the selected product's listed price and quantity, with explicitly invented $5 shipping and $3 tax. Its simulated total binds approval and ledger evidence, while real checkout/funding state remains untouched. Changing product, price or quantity resets rehearsal approval. Positive USD products only; unsupported or absent prices do not launch this fixture.

52 deterministic tests, typecheck, lint and production build pass. Browser verification selected a $39.99 polo, showed $47.99 simulated total and recorded simulated approval; selecting a $42 shirt reset approval and showed $50.00 simulated total. Real final checkout remained unknown. Added DEMO.md with a presenter script, evidence/capability matrix and preparation checklist. A merchant-approved test delivery destination was requested to continue real checkout-total verification; no buyer address or contact details have been invented or submitted.

### Wallet review invalidation

- Wallet Standard account, chain and capability change events now clear the old wallet review, approvals and unsigned transaction immediately. Responses started before that change cannot restore the obsolete review; a queued server reset preserves the selected product.
- Optional wallet event subscriptions clean up once and ignore late callbacks. Wallets without this feature still have the manual Clear wallet review control.
- Verification: 54 deterministic tests passed (3 live tests skipped), typecheck/lint/build passed. Browser sample wallet → Clear wallet review removed balances/funding and retained the Black Classic Polo selection. Actual extension event delivery remains unverified without an installed wallet.

## PC restoration, merchant-total read and wallet-control cycle — October 3, 2026

The downloaded archive is now a runnable checkout tracking the owner's existing private Kleangkao/supertab repository. Relevant existing credentials were restored to the ignored local environment file without printing values. All three opt-in live tests passed on this PC: RPC balances, production DFlow quote and real unsigned preparation. No financial action occurred.

Merchant-total reading uses authenticated Shopify get_checkout at an explicitly allowed merchant origin. A ready, matching USD checkout with current expiry and reconciled totals can establish final-total evidence. The server checks product/variant/quantity, clears old approval before refresh, rejects stale terms and drops buyer/payment/capability data from session output. Browser verification reached the real selected True Classic checkout; the read endpoint returned HTTP 422. No live final total was accepted. The incomplete merchant checkout and access failure remain unresolved; deterministic merchant fixtures prove application rules only.

Added explicit Wallet Standard message signing with server-side Ed25519 verification. Users review the challenge before signing. App origin, session, address, review ID, nonce and expiry bind the proof; every verification attempt consumes the challenge. Review or wallet changes reset it. Proof does not authorize a swap, payment or order. Tests use real ephemeral keys and cover wrong keys/messages, expiry, replay, replaced challenges and refresh. Browser verification found no wallet extension and correctly showed the read-only fallback, so the actual extension ceremony remains unproven. The same-origin HTTP guard rejected a cross-origin request with 403.

Verification: 73 deterministic tests pass; lint, typecheck and production build pass. The prior three live provider tests remain applicable; no provider path was changed in this message-signing cycle. CardRail lifecycle and independent order evidence remain local simulation, not Bridge/Stripe sandbox evidence. Biggest gaps: live merchant final-total access and actual extension transaction signing, followed by legitimate provider sandbox access. Next: validate the user-controlled transaction-signing path in an isolated devnet flow without claiming conversion or spending readiness.

## Devnet transaction-signing cycle — October 3, 2026

Added an optional sign-only legacy Devnet memo check after wallet-control proof. It uses the fixed public Devnet RPC, checks the account's declared chain/feature/format support, displays the exact memo, and invokes only Wallet Standard signTransaction on solana:devnet after explicit user action. Browser and server reject modified transaction bytes. The server verifies Ed25519 and consumes each confirmation attempt; signed payloads are discarded. Review changes, lost wallet proof, stale nonces and the 60-second deadline fail closed. A pending preparation cannot publish into a later cleared wallet review.

No sendTransaction, signAndSendTransaction, airdrop, asset conversion or provider payment is called. The independent receipt says Devnet signature verified and broadcast false; it does not change purchase approval, USDC coverage, CardRail or merchant order state. Message signing and transaction signing remain distinct capabilities.

Verification: 80 deterministic tests passed; lint/typecheck/build passed. All four opt-in live checks passed, including Devnet getLatestBlockhash and getFeeForMessage acceptance of the exact memo format. This is format evidence, not execution simulation or an actual browser-extension signing demonstration. The same-origin Devnet route rejected an unrelated origin with HTTP 403. Production financial execution remains disabled. Existing real checkout access and Bridge sandbox gaps persist; local payment lifecycle remains simulation.

Next: obtain real extension ceremony evidence when an authorized wallet browser is available, investigate the specific merchant checkout 422 without exposing capability references, and continue independent order/payment evidence integration where legitimate sandbox access allows it.
