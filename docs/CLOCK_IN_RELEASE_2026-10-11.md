# CLOCK IN release checklist — 11 October 2026

Asia/Bangkok. The authenticated form was not submitted. Financial execution stayed disabled. No message or transaction was signed.

## Release

| Item | Value |
| --- | --- |
| Client commit | `f62491159cec2e17c25163a31fa57f8c22d02a49` — Clear stale wallet funding when the Android shell returns. |
| Package commit | `cca2215` records this checklist and the corrected judge copy. It does not change the app. A later documentation commit may move the production tip; the client behavior stays the `f624911` build. |
| Files in that commit | `src/components/shop-app.tsx`, `tests/browser/shopping-journey.spec.ts` |
| Branch published | `main`, fast-forward from `41e7885` |
| GitHub production deployment | `6993146946`, created 15:42 Asia/Bangkok, environment Production |
| Public alias | https://supertab-main.vercel.app |
| Production client check | Alias JavaScript chunk `05r_lh7oio-le.js` contains the return note “Welcome back” |
| App health | Gemini, Shopify, and eBay configured; Solana available; DFlow `live_quote`; card rail `sandbox_blocked`; `financialExecution` disabled |
| Worker | https://supertab-devnet-merchant.jamesbitarcade.workers.dev unchanged. CAS, delete, alarm cleanup, and require-revision true. TTL 86,400,000 ms. Execution disabled |

Earlier the same day, before this deploy, Home and reopen kept balances and a Connected label. The hosted client was not consuming the shell resume event the Android app already sent.

## APK

| Item | Value |
| --- | --- |
| Judge file | `submission/supertab-clockin.apk` |
| SHA-256 | `0533ea859c8ff4fccde60e518bdce39b69858a6bab53b560f8517e8ec8d6a1c1` |
| Size | 23,371,280 bytes |
| Source of those bytes | `android/app/build/outputs/apk/release/app-release.apk` |
| Package | `app.supertab.shop`, versionName 1.0.0, versionCode 1, minSdk 28, targetSdk 37 |
| Signer SHA-256 | `0512b66bf8f8efc5119ce9c10191ed7a85317619986fbeda357c8cc39b42a439` |
| Installed copy | Pulled from the Seeker and matched this hash. No new native build. |
| Preserved previous submission file | `output/historical/supertab-clockin-C0FE8E1F.apk`, SHA-256 `c0fe8e1fece73cb650e1cdd65ffe7f86a220c883923f20dbb3507744a8f30456`, 23,290,208 bytes |
| Earlier installed hash | `72d7c78915c89668a2041e0412493a674d2b22086e04670e4cb5b4f395c6c1ca` is historical and is not the current file |

The APK and the demo video are local. They are not in Git.

## Demo

`videos/supertab-seeker-demo/supertab-seeker-demo-final-2026-10-11.mp4`

- Duration 121.5 seconds. Screen recording from the installed app, cut together without added voice.
- Provenance: device clips `supertab-seeker-demo-2026-10-11.mp4`, the first 38.5 seconds of `supertab-seeker-demo-2-2026-10-11.mp4`, `supertab-seeker-demo-3-2026-10-11.mp4`, and `supertab-seeker-return-2026-10-11.mp4`.
- Shows the retained shortlist, selected Interlocked polo, uncertain matches, stage badges, the public demo wallet shortfall (about 15.98 USDC still needed against a $16.99 planning amount), and the Fashion Nova product page.
- The public demo address is masked in the UI. It is not the owner’s wallet. The owner’s read-only review, 0 SOL and 0 USDC, was checked on the device before the return clear and is not the footage of the demo wallet.
- The merchant page showed a live price, including $15.00 with a promotion, which is different from the $16.99 planning amount. The app already says the final checkout total is unknown.
- A black split-screen moment was cut. The recording does not retype the search, does not show the labeled local rehearsal, and does not show a completed return gesture inside the merchant clip. Shopping context after the merchant visit was checked from the accessibility tree: Interlocked, Cairo, the shortlist, and no wallet selected.
- Pitch deck: `submission/pitch.html`. No pitch PDF is in the tree. The website pitch render is not a founder recording and is not the device demo.
- Judges cannot open the video until it is uploaded. No upload was made.

## Verification

### 1. Local — PASS for the released client

| Action | Expected | Observed | Result |
| --- | --- | --- | --- |
| Browser regressions for shell return, pending connection, and return during shopping | Balances clear, shopping stays, no wallet-control or devnet request while a connection is pending | 3 passed, then the full browser file 18 passed, before the release commit | PASS |
| Unit tests and typecheck | No new failure in the client | 266 passed, 10 skipped; typecheck passed, before the release commit | PASS |
| Lint of the two reviewed files | Clean | Passed. Full `npm run lint` still fails on untracked diagnostic scripts under `output/`; those scripts were not changed or committed | PASS for reviewed source |

Uncertainty: the worker session suite was not rerun. Worker source did not change.

### 2. Hosted production — PASS

| Action | Expected | Observed | Result |
| --- | --- | --- | --- |
| Latest Production deployment | SHA `f624911` on the public alias | Deployment `6993146946` is the newest Production deployment and serves that SHA. The alias script contains “Welcome back” | PASS |
| Health | Execution disabled, quote path available | App and worker health matched the table above | PASS |

Uncertainty: the deployment hostname redirects to Vercel SSO. The public alias and the GitHub deployment record are the checks that were used.

### 3. Physical Seeker — PASS for the stale-return fix, with blocked subcases

Installed hash `0533ea…`. Production alias. No signature control was used.

| Action | Expected | Observed | Result |
| --- | --- | --- | --- |
| Cold open of the retained $40 search | Shortlist and selected Interlocked polo remain | Cairo and Interlocked remained. Good finds showed 6 matches | PASS |
| Read-only refresh of the owner account, then Home and reopen | Balances and the connected/read-only label clear. Shopping stays. The return note appears | 0 SOL and 0 USDC were visible before the return. After reopen the note “Welcome back…” appeared once, wallet amounts were gone, and Interlocked, Cairo, and $40 remained | PASS |
| Cached Connect, then a later Home and reopen | Connection completes without a signature. A later return clears it | The app stayed in `app.supertab.shop`, showed Connected wallet, and showed no approval dialog. The following Home/reopen cleared it and kept the shopping context | PASS |
| Force-stop and relaunch | Shopping context remains. Stale funding does not come back from memory | New process. No wallet selected. Interlocked, Cairo, shortlist, and $40 remained. The in-memory welcome note did not persist | PASS |
| Open the merchant product page and come back | Product page opens. No payment. Shopping context remains | Fashion Nova Interlocked polo opened in Chrome. One Back press left Chrome for the launcher. Relaunching SuperTab showed the shortlist and no wallet selected | PASS for the handoff and the surviving context. The single Back press is not an in-app return |
| Explicit rejection, and a wallet that is unavailable | The review survives and no signature is created | Not run. The wallet was not removed or cleared | BLOCKED |

Uncertainty: an active approval dialog was not interrupted, because cached consent did not show one. The browser test covers pending-connection survival. Intermittent Mobile Wallet Adapter startup remains unexplained: an earlier attempt refused the local connection, and a later attempt reached HTTP 101. Cleartext policy denial was already ruled out. No native policy change was made.

### 4. Submission package — prepared, not submitted

| Action | Expected | Observed | Result |
| --- | --- | --- | --- |
| Replace the stale APK after preserving it | Judge filename matches the installed release | Hashes above | PASS |
| Public source | Judges can open the repository | https://github.com/Kleangkao/supertab is public at `f624911` | PASS |
| Demo and pitch links a judge can open | Public video and uploaded deck | Video and deck are local only | BLOCKED on owner upload |
| Authenticated form | Submitted only with owner action | Form was not opened | NOT SUBMITTED |

## Official requirements

Live desk https://solanamobile.com/hackathon redirects to https://solanamobile.radiant.nexus/. On 11 October 2026 the public calendar said submissions close 13 October 2026 at 6:59 AM GMT+7 and judging opens at 7:00 AM GMT+7. Results are announced 10 November. Winners must publish to the Solana dApp Store within 30 days. Required items: a functional Android APK, GitHub source, a demo of the product running on a device, and a pitch deck or brief presentation. The public brief describes a three-minute demo. No separate two-minute spoken-pitch limit was verified on that desk. A blog post still says 8 October 2026; the live calendar is the operational deadline used here.

## Still blocked outside the code

Shopify `ready_for_complete`, the Bridge/Stripe card rail, merchant order completion and readback, and the SCVD sponsor certificate stay frozen. See `docs/BLOCKER_REGISTER.md`. No retail purchase or order success is claimed.

## Owner decisions still open

- Country of residence. The draft says Thailand only if that is the actual country.
- Whether anyone not listed did meaningful work. AI tools were used. Do not answer “none” without checking.
- Upload the local demo and `submission/pitch.html`, or name the destination. No new public host was created.
- Submit the authenticated form. This package does not do that.
- Telegram `@James_StarAtlas` and X `https://x.com/noisesang` are already in the draft and were not newly invented here.
