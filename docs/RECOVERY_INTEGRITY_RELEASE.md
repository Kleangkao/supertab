# Recovery integrity and coordinated-release review

Dated local review after the 2026-10-08 working-tree wipe. Not deployment authorization. Not a claim of production atomicity.

## Verdict

**READY FOR OWNER-APPROVED COORDINATED RELEASE** under these bounds:

- Critical shopping/session/safety behaviors are present in the recovered tree and covered by local tests + actual Wrangler DO checks.
- Hosted Worker is still **legacy** (no `shoppingSessions` on `/health`); deploy must follow Worker→verify→app.
- Exact historical `261 passed / 8 skipped` name inventory is **unavailable**; closest verified pre-wipe unit run in transcripts is `252 passed / 8 skipped`. Current suite is re-run and reconciled behaviorally below.
- Process-local search budgets remain process-local (documented; not a release blocker).

## Assumptions (explicit)

1. Pre-wipe uncommitted work is only partially reconstructible from GitHub `Kleangkao/supertab` (`29f6326`) + agent transcripts (`c9df4fa1…`, `4c879741…`).
2. Transcript summaries omit some Write/StrReplace detail; absence from a summary is not proof of absence from the recovered tree.
3. Deployed capability state must be read from live `/health`, never from local `merchant/worker.ts`.
4. Financial journals, merchant ledgers, `.env.local`, and signing material were not used as recovery sources and must not be mutated for this review.

## Baseline evidence

| Source | What it proves |
| --- | --- |
| `git reflog` / `clone` at `HEAD@{0}` | Tree was re-cloned from GitHub after wipe; no local pre-wipe commits. |
| `origin/main` @ `29f6326` | Committed baseline is Bitcoin-Anchor / purchase work, **without** shopping-session CAS Worker. |
| Working tree dirty + untracked | Recovered hardening lives as **uncommitted** files (Worker, session-snapshot, shop fixtures/budget, browser tests, release docs, etc.). |
| Transcript `c9df4fa1…` | Pre-wipe reliability pass recorded `252 passed / 8 skipped` after matcher/fixture/persist work. |
| Transcript `4c879741…` | Post-recovery agent reported `253 passed / 10 skipped`, 14 browser journeys, `WORKER_SESSIONS_VERIFIED`, and marked ready (not re-proof). |
| Live Worker `/health` (2026-10-08) | Hosted merchant **lacks** `shoppingSessions` → legacy. |
| Live app `/api/health` | `financialExecution: "disabled"`. |

No byte-for-byte recovery claim.

## Recovery inventory

Status key: **preserved** (present + tested), **intentional change**, **missing**, **uncertain**.

| Requirement | Pre-wipe evidence | Current implementation / tests | Status |
| --- | --- | --- | --- |
| Editable requirements (budget/colors/sizes/…) | Transcript + `shopping-decisions.tsx` | `src/components/shopping-decisions.tsx`; domain/browser journeys | preserved |
| Matching + variant evidence | `match-evidence` work in transcript | `src/lib/match-evidence.ts`, `tests/match-evidence.test.ts` | preserved |
| Shortlist persist/compare | shortlist module + browser | `src/lib/shortlist.ts`, `tests/shortlist.test.ts`, browser journeys | preserved |
| Failure/draft preservation | reliability pass (persist rollback) | `ShoppingService.completeTurn` restores prior maps on throw; `tests/shopping-reliability.test.ts` | preserved |
| Merchant handoff copy | Restored in post-wipe hardening for browser | `shop-app.tsx` / checkout review; browser suite | preserved (UI wording not byte-diffed to pre-wipe) |
| Consent bound to product/variant/currency/total | Pre-existing purchase-intent / approval tests | `purchase-intent`, merchant-checkout, domain tests | preserved |
| Pending-payment protections | purchase workflow / readiness | Existing purchase-* tests; execution gate off | preserved |
| Session CAS | Hardening + Worker rewrite | `session-snapshot.ts`, `merchant/worker.ts`, hardening + worker-sessions | preserved (local); **not** on hosted Worker yet |
| Turn IDs idempotent / intent-bound | Hardening tests | `shopping-session-hardening.test.ts` | preserved |
| TTL + alarm cleanup + DELETE | Worker DO + verify script | `worker.ts` alarm/DELETE; `test:worker-sessions` | preserved (local) |
| Fixture controls | dual flags + hosted markers | `shop-fixtures.ts` + tests; vitest clears Playwright fixture env | preserved / intentional (env isolation) |
| Financial-state strip on restore | Hardening | `stripFinancialAuthority` + restore test | preserved |
| Browser/a11y journeys | 14 journeys claimed | `tests/browser/shopping-journey.spec.ts` | preserved (re-verify this review) |
| New app + old Worker fail-closed | Documented; gate in remote store | Now unit-tested via mocked `/health` | preserved + coverage added |
| Old app + new Worker revisionless 409 | Worker `revision-required` | `test:worker-sessions` + Worker code | preserved (local) |
| Global search quota | Explicitly out of scope | Process-local `shop-budget` only | intentional / documented |

Uncertain items: exact pre-wipe file hashes; whether any minor UI copy differed before wipe; whether any one-off local scripts outside the recovered set existed.

## Test inventory reconciliation

### Reported totals

| Claim | Source | Reliability |
| --- | --- | --- |
| 241 passed / 7 skipped | Earlier product-state notes | Historical |
| 252 passed / 8 skipped | Pre-wipe transcript (`c9df4fa1…` compaction) | Best verified **pre-wipe** unit inventory |
| 261 passed / 8 skipped | Release prompt / prior summary | **No vitest name dump found** in transcripts |
| 253 passed / 10 skipped | Post-recovery hardening transcript (`4c879741…`) | Post-wipe local report before this review |
| **256 passed / 10 skipped** | This review (`npm test`) | Post-wipe + **3** new compatibility-gate tests |
| +3 compatibility gate tests | This review | Added deliberately |

### Explaining 261/8 → 253/10

Without a saved `--reporter=verbose` list for the 261 run, name-level removed/renamed tests **cannot** be proven. Bounded explanation from available evidence:

1. **261 is not corroborated** by a captured vitest summary in the agent transcripts searched for this review. Treat it as an unverified peak claim.
2. **Closest pre-wipe verified unit run: 252/8.** Post-recovery hardening then added Worker/session tests and restored browser UI paths; that agent reported **253/10**.
3. **Skipped 8 → 10 (+2):** consistent with `tests/live-snapshot.test.ts` (2 cases) staying skipped when fixture flags are unset, plus stronger isolation in `vitest.config.ts` that deletes `SUPERTAB_SHOP_FIXTURES` / `SUPERTAB_ALLOW_SHOP_FIXTURES` so Playwright shell pollution cannot accidentally **unskip** snapshot tests. Live `SUPERTAB_LIVE*` / `RUN_DEVNET_BROADCAST` suites remain opt-in (do not unskip for counts).
4. **No evidence** that CAS, turn-ID, financial strip, fixture gate, shortlist, or consent regressions were deleted to chase a lower count.
5. This review adds **compatibility-gate** regressions rather than padding trivial asserts to recreate 261.

### Current skip map (opt-in / fixture)

| File | Why skipped by default |
| --- | --- |
| `tests/live/*.live.test.ts` | Needs `SUPERTAB_LIVE=1` |
| `tests/live-provider.test.ts` | Needs `SUPERTAB_LIVE_SHOP=1` |
| `tests/live-snapshot.test.ts` | Needs fixture file + flags |
| `tests/devnet-broadcast.test.ts` (1 case) | Needs `RUN_DEVNET_BROADCAST=1` |

## Compatibility (hosted vs local)

| Combination | Evidence |
| --- | --- |
| New app + new Worker | Local DO verify + unit CAS |
| New app + **current hosted** Worker | Hosted `/health` lacks capabilities → remote store must 503; unit-mocked | 
| Old app + new Worker | Local Worker rejects missing revision (409) |
| Rollback | Documented in `SHOPPING_HARDENING_RELEASE.md`; mixed pairs fail closed (409/503), not silent LWW |

## Verification this review (2026-10-08)

| Command | Result | Evidence category |
| --- | --- | --- |
| `npm test` | 256 passed / 10 skipped | Deterministic / mocked |
| `npm run typecheck` | pass | Local |
| `npm run lint` | pass | Local |
| `npm run build` | pass | Local production build |
| `npm run test:browser` | 14 passed (fixture-backed Playwright) | Browser / fixture |
| `npm run test:worker-sessions` | `WORKER_SESSIONS_VERIFIED` | **Actual** local Wrangler DO |
| Hosted Worker `/health` | No `shoppingSessions` | Live read-only (legacy) |
| Hosted app `/api/health` | `financialExecution: "disabled"` | Live read-only |

Browser journeys covered (fixtures): search → refine → save → compare → refresh → review → merchant handoff; draft-on-failure; shortlist second tab; keyboard/narrow viewport. Conflict/outage paths are unit/DO-covered, not live hosted CAS.

## Owner deploy steps (after approval)

1. Diff this recovered tree vs `origin/main`; review uncommitted hardening only.
2. Deploy Worker from current `merchant/worker.ts` / `wrangler.jsonc`.
3. `GET …/health` must show `shoppingSessions.cas` and `requireRevisionOnUpdate: true`.
4. Deploy Next.js app.
5. Run CAS race / DELETE / no-balances-in-snapshot / fixture-off smoke from `SHOPPING_HARDENING_RELEASE.md`.
6. Only then treat production shopping writes as atomic.

Do not deploy from this document alone.
