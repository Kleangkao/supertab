# Shopping hardening release

Local preparation for coordinating the Next.js app and Cloudflare Worker. Do not treat this file as authorization to deploy.

## Release verdict (local review)

See [RECOVERY_INTEGRITY_RELEASE.md](./RECOVERY_INTEGRITY_RELEASE.md) for the dated recovery inventory, test reconciliation, and verification evidence. This file keeps the concrete deploy/rollback contract.

**Assumption until owner re-checks `/health`:** the hosted Worker at `https://supertab-devnet-merchant.jamesbitarcade.workers.dev` is still the **legacy** contract (no `shoppingSessions` object). Read-only inspection on 2026-10-08 returned:

```json
{"ok":true,"network":"solana:devnet","persistence":"durable-object","financialExecution":"disabled"}
```

That is not the new Worker. Do not infer production CAS from local Wrangler checks.

## What changed

- Hosted shopping snapshots carry `revision`, `updatedAtMs`, `lastAcceptedTurnId`, and `lastAcceptedTurnText`.
- The Worker refuses stale PUTs when `x-supertab-revision` does not match (409).
- The Worker refuses updates that omit `x-supertab-revision` when a row already exists (409). Creates still use revision `0`.
- Snapshots older than 24 hours are removed on read, on write conflict checks, and by Durable Object alarms without a later shopper read.
- Missing retention metadata is treated as epoch `0` and expires.
- Restored sessions keep product context only. Balances, quotes, proofs, consent, approvals, and unsigned-transaction readiness are cleared.
- Fixture products require both `SUPERTAB_SHOP_FIXTURES=1` and `SUPERTAB_ALLOW_SHOP_FIXTURES=1`, and refuse hosted markers (`VERCEL`, `CF_PAGES`, `NETLIFY`, `RENDER`, `RAILWAY_ENVIRONMENT`, and related). `NODE_ENV` alone is not the boundary. Clients cannot enable fixtures.
- `POST /api/shop` and `DELETE /api/shop` require same-origin. Catalog searches are rate-limited per process-local client key. Optional `turnId` retries are idempotent only when the message text still matches.
- `DELETE /api/shop?sessionId=` clears one shopping session. It does not touch financial journals or merchant ledgers.
- `/health` on the Worker advertises `shoppingSessions.cas`, `delete`, `ttlMs`, `alarmCleanup`, and `requireRevisionOnUpdate`.
- The app remote session store refuses Workers that do not advertise CAS + require-revision, so a new app does not silently last-write-wins against an old Worker.

## Compatibility matrix

| App | Worker | Result |
| --- | --- | --- |
| New | New | Atomic revision checks, alarm TTL cleanup, DELETE, capability gate pass. |
| New | Old (current hosted) | App health/capability gate fails closed for remote shopping persistence (`SessionStorageError` / 503). Memory-only local shopping may still work. Prefer temporary safe failure over silent LWW. |
| Old | New | Old app PUTs without revision headers fail with 409 on updates. Users must refresh/redeploy the matching app. Creates with revision `0` still work if the old app sends that header; otherwise updates fail safely. |
| Old | Old | Previous last-write-wins behavior. Do not roll forward only one side. |

Automated coverage: `tests/shopping-session-hardening.test.ts` (“app/Worker compatibility gates”) mocks legacy vs compatible `/health`. Actual local DO behavior: `npm run test:worker-sessions`.

## Worker-first transition (expected interruption)

Safe deploy order remains **Worker first**, then app. During the gap:

| Who | What they see |
| --- | --- |
| Shoppers on the **old** public app against the **new** Worker | Search/refine that needs an update PUT without `x-supertab-revision` gets **409**. Draft text in the browser may still be visible; remote snapshot is not silently overwritten. Refresh alone does **not** fix an old app build — the new app must be deployed. |
| Shoppers after **new** app is live against **new** Worker | Normal CAS path. Concurrent tabs can still get 409; UI should ask to refresh. |
| New app against **old** Worker (wrong order) | Remote persistence **503**; fail closed. Do not weaken revision enforcement to paper over this. |

Practical notes:

- Requests do **not** automatically retry through a 409/503 into an unsafe write.
- Shortlist is browser `localStorage` and survives app refresh; it is not a Worker shopping-session body.
- Merchant ledgers / financial journals are untouched by shopping-session CAS.
- No broad maintenance mode is required if the Worker→app gap is short. If the gap must stay open, treat hosted shopping persistence as degraded (409 for stale clients) rather than disabling revision checks.

## Rollback sequence (safe)

Do **not** assume “roll back app first” restores full service without checking Worker capabilities.

1. **If the new app is already live and the Worker is broken:** redeploy the previous app **first**. Hosted shopping persistence then depends on which Worker is live:
   - Previous app + **new** Worker → updates without revision stay **409** (safe, not LWW). Service is intentionally limited until a matching pair is restored.
   - Previous app + **previous** Worker → prior LWW returns. Only choose this when accepting that risk.
2. **If only the new Worker is live (old app still public):** redeploy previous Worker only if you accept returning to LWW for the still-public old app. Prefer completing the new app deploy instead.
3. **Never** redeploy an old Worker under a **new** app and expect writes to succeed: the new app fails closed (503) until `/health` advertises CAS + `requireRevisionOnUpdate`.
4. Snapshots written with revision/TTL fields remain data; an old Worker may ignore those fields and will not enforce CAS. Do not claim rollback restores atomicity.
5. Resume normal writes only when app and Worker versions match per the matrix above.

Prefer a **compatible pair** (both new, or both old with accepted LWW) over mixed versions. Prefer **controlled write failure** (409/503) over silent last-write-wins.

Safe forward order:

1. Deploy the Worker that advertises `shoppingSessions.requireRevisionOnUpdate: true`.
2. Confirm `/health` on the Worker shows `cas` and `requireRevisionOnUpdate`.
3. Deploy the Next.js app.
4. Run deployed smoke checks before calling production atomicity verified.

## Configuration names (never put secret values here)

Required for hosted shopping snapshots:

- `DEVNET_MERCHANT_URL`
- `SUPERTAB_CONTROL_TOKEN`

Local Playwright only (production-built local Next server):

- `SUPERTAB_SHOP_FIXTURES=1`
- `SUPERTAB_ALLOW_SHOP_FIXTURES=1`

Do not set either fixture variable on Vercel or other hosted markers. Financial execution must remain unset/disabled (`SUPERTAB_MAINNET_EXECUTION` unset).

## Snapshot migration and retention

- Version stays `1`. Additive fields: `revision`, `updatedAtMs`, `lastAcceptedTurnId`, `lastAcceptedTurnText`.
- Missing `updatedAtMs` is treated as `0` and expires on the next retention check.
- Retention is 24 hours for shopping sessions only.
- Worker SQL keeps nullable `updated_at_ms` beside the session body and schedules a Durable Object alarm on each accepted PUT.
- Ledger tables are untouched.

## Local actual-Worker verification

```bash
npm run test:worker-sessions
```

This starts Wrangler `unstable_dev` against `merchant/worker.ts` with isolated local DO SQLite storage and a dummy control token. It exercises create/load/CAS/conflict/auth/delete/TTL/abandoned cleanup/restart. It does **not** prove deployed production atomicity.

## How to verify after Worker deploy

1. `GET https://<worker>/health` shows `shoppingSessions.cas` and `requireRevisionOnUpdate`.
2. Create a shopping session on the deployed app.
3. From two scripted clients with the control token, PUT the same session id with the same `x-supertab-revision`.
4. Expect one `200` and one `409`.
5. Confirm GET returns only the winning body and that balances/quotes are absent from the stored shopping snapshot.
6. Confirm DELETE then GET → 404.
7. Confirm a PUT without `x-supertab-revision` against an existing row → 409.

## Read-only deployed smoke checks

1. Search without connecting a wallet.
2. Refine a requirement; confirm the draft survives a failed network attempt.
3. Save two shortlist items; open a second tab and confirm the shortlist syncs.
4. Open funding review with the public demo address only if desired; do not sign.
5. Confirm merchant handoff copy still says no payment or order is placed.
6. Confirm app and Worker health still report financial execution disabled.

## Prove fixtures are disabled in production

1. Confirm hosted env has neither fixture flag.
2. Search for a product fixture mode would invent (for example “Black Torrey Polo”). Production must not return that fixture merchant.
3. If someone sets `SUPERTAB_SHOP_FIXTURES=1` on a hosted marker without the allow flag, fixtures remain off and misconfiguration is detectable in tests.

## Resource-limit scope

| Control | Scope | Notes |
| --- | --- | --- |
| Shop search body ≤8KB / message ≤500 / history 12 | Request | Enforced in `/api/shop`. |
| Shop search budget 40 / 10 minutes | Process-local per client key | Not a global Durable Object quota. Shared NAT users may share a key. |
| Gemini budget | Process-local + optional Worker daily counter | Worker counter is durable; per-client map is not. |
| Snapshot ≤180KB | App + Worker | Oversized PUTs rejected. |
| Merchant POST rate | Durable Object | Separate from shopping search. |

## Session capability / privacy model

- Session ids are unguessable UUIDs used as read/write capabilities. Same-origin is required for mutating shop routes; it is **not** proof of ownership beyond browser origin isolation.
- GET session responses use `Cache-Control: no-store`.
- Cross-origin POST/DELETE are rejected.
- Storage outages return 503; expiry returns 410; missing sessions return 404.
- Residual risk: anyone who obtains a session id can read that shopping context until expiry/delete.

## Local recovery note (2026-10-08)

The working tree was emptied during this hardening pass and restored from
`Kleangkao/supertab` plus transcript replay of in-flight shopping-hardening edits.
Treat uncommitted local history carefully: re-diff against `origin` before deploy
and do not assume every pre-wipe local-only file returned unchanged.
Byte-for-byte recovery is **not** claimed. Details: [RECOVERY_INTEGRITY_RELEASE.md](./RECOVERY_INTEGRITY_RELEASE.md).

## Owner actions required later

Do not run the deploy commands from this review. They are the approval checklist.

Financial execution stays fail-closed when `SUPERTAB_MAINNET_EXECUTION` is unset. `POST /api/digital-purchase/execute` then returns 403 and does not open a purchase journal or a payment transport. Worker `/health` reports `financialExecution: "disabled"` as a fixed value. Do not set `SUPERTAB_MAINNET_EXECUTION` on Vercel. The existing devnet merchant routes stay behind the control token and the devnet RPC check; this release does not turn those into a mainnet path.

1. Review `git show` for this commit and `git diff origin/main`. Confirm no `.env.local`, keystore, merchant seed, or control token is in the commit.
2. Deploy the Worker first, from the repository root:

```bash
npx wrangler deploy --config merchant/wrangler.jsonc
```

`merchant/wrangler.jsonc` in commit `224737026af70d90771b4f8b885c06dee4e8d9ec` is already the migration to deploy. The hosted Worker has applied tag `v1` since 2026-10-06, and that tag already created `DevnetMerchantObject`, `ShoppingSessionObject`, and `GeminiBudgetObject`. Wrangler sends no new migration when the remote tag is already the last local tag. Do not add `v2`. Do not delete, rename, or recreate those classes. Their namespace ids stayed the same from Worker version 1 through the deployed version `653de8e6-3fdd-45ac-bbba-631e23ac38c7`.

Do not rotate secrets. The Worker already has `SUPERTAB_CONTROL_TOKEN`, `MERCHANT_KEY_JSON`, and `SOLANA_DEVNET_RPC_URL`. `GEMINI_DAILY_LIMIT` is already the plain value `120`. `MERCHANT_SNAPSHOT` is not set.

3. Confirm the hosted health contract before deploying the app:

```bash
curl -sS https://supertab-devnet-merchant.jamesbitarcade.workers.dev/health
```

Require `"financialExecution":"disabled"` and `shoppingSessions.cas` plus `shoppingSessions.requireRevisionOnUpdate` both true.

4. Deploy the Next.js app only after that health check. Do not set fixture flags or `SUPERTAB_MAINNET_EXECUTION`.

```bash
npx vercel deploy --prod
```

5. Run the smoke checks above on the public host.
6. Only then treat atomic production writes as verified.
7. Do not set `SUPERTAB_SHOP_FIXTURES` / `SUPERTAB_ALLOW_SHOP_FIXTURES` on hosted markers.

## Rollback commands

Do not roll back until you know which half is live.

- New app already live, Worker broken: roll the app back first, then decide whether the Worker stays.

```bash
npx vercel ls
npx vercel rollback <previous-deployment-url>
```

A previous app against the new Worker gets 409 on shopping-session updates that omit `x-supertab-revision`. That is the safe mixed state. Redeploying the previous Worker as well restores last-write-wins. Do that only if you accept that risk.

- New Worker live, old app still public: prefer deploying the new app. Roll the Worker back only to accept last-write-wins:

```bash
npx wrangler deployments list --config merchant/wrangler.jsonc
npx wrangler rollback <previous-deployment-id> --config merchant/wrangler.jsonc
```

- New app against an old Worker fails closed with 503 for remote shopping snapshots. Fix it by finishing the new Worker deploy, not by removing the revision check.

Snapshots already stored with revision fields stay on disk. An older Worker does not enforce compare-and-swap on them. Local Wrangler checks do not prove hosted atomicity.

## Hosted result — 2026-10-08

These commands were run for commit `224737026af70d90771b4f8b885c06dee4e8d9ec`. Do not repeat them unless rolling forward again.

- Worker version: `653de8e6-3fdd-45ac-bbba-631e23ac38c7`. Tag `v1`. No new migration. Namespace ids unchanged: `MERCHANT` `c68fb2bb29ea4a56b3624f107e14a768`, `SESSIONS` `276bc81f9bee4d4ea26c9a8106470c72`, `GEMINI_BUDGET` `159604bd95754a30af7182afebd3a659`.
- Worker secret names still present: `SUPERTAB_CONTROL_TOKEN`, `MERCHANT_KEY_JSON`, `SOLANA_DEVNET_RPC_URL`. None were rotated. `GEMINI_DAILY_LIMIT` remains `120`.
- App deployment: `dpl_4r9KEEKV1dPDwHeHig4QW9DEZu3u` at https://supertab-main.vercel.app. Previous production deployment, for rollback: `dpl_G4LmqhwqQa6GAtMUKqBtJpdNRunr`. Worker code rollback target: `302b2f9d-6a3c-45a2-8a8f-9a99a48acc2a`.
- Production env names do not include `SUPERTAB_MAINNET_EXECUTION`, `SUPERTAB_SHOP_FIXTURES`, or `SUPERTAB_ALLOW_SHOP_FIXTURES`. The health field `financialExecution: "disabled"` is still a fixed label and is not the gate.
- Disposable session `b287de81-8f34-4d6c-9103-18cee101e502`: create 200, competing updates 200 and 409, restore 200 with the winning requirements and no balances, quote, approval, or unsigned transaction, delete 200, then 404. A headerless Worker PUT was not run because the production control token cannot be read back.
- Public browser: live Shopify and eBay search, budget edit to $40, shortlist, lowest-item comparison, and reload restore. No fixture merchant. No signature, swap, payment, or purchase execute call.
- Shopify catalog links labeled “Open merchant page” were cart permalinks (`/cart/<variant>:<quantity>`). That wording is fixed after this hosted deploy and is not in `dpl_4r9KEEKV1dPDwHeHig4QW9DEZu3u`. Do not deploy the wording fix without a separate authorization.
