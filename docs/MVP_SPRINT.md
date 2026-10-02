# MVP sprint — started October 2, 2026

The existing app stays in place. Financial execution remains disabled under AGENTS.md. Signing, broadcasts, card issuance and merchant payments are outside this implementation. Secrets remain in .env.local.

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

1. Merchant checkout evidence: investigate legitimate provider access, attach an amount to the selected merchant/product/variant/quantity and freshness, and invalidate approval when terms change. Catalog data or a manually entered amount must never claim a verified final total.
2. Wallet connection reliability: exercise Wallet Standard discovery, account changes, disconnection and refresh. Keep signing disabled and account permissions distinct from purchase approval.
3. Payment lifecycle integration: provider-neutral event handling, duplicate/out-of-order protection, independent order evidence, then real sandbox evidence if access becomes available. Avoid prolonged onboarding attempts.
4. Funding robustness: verify fresh prepared minimum output, network reserve, multiple token accounts and balance refresh against focused regression tests.
5. Submission: honest capability matrix, reliable presenter flow, responsive browser verification and screenshots after core gaps are addressed.

The largest remaining product gap is a verified final merchant checkout amount. The local rehearsal proves application lifecycle rules only; it does not close that gap or prove spending readiness.
