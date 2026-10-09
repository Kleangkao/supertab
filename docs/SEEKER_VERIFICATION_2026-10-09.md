# Physical Seeker verification — 9 October 2026

Status: IN PROGRESS. Final demo recording and demo freeze remain paused.

## Environment and artifact integrity

- Physical Seeker attached through adb; Android 16 / API 36.
- Existing installed SuperTab launched successfully; no wallet approval performed.
- Installed APK SHA-256: `72D7C78915C89668A2041E0412493A674D2B22086E04670E4CB5B4F395C6C1CA`.
- Local submission APK SHA-256: `C0FE8E1FECE73CB650E1CDD65FFE7F86A220C883923F20DBB3507744A8F30456`.
- The physical APK is the pre-loss build, not the recovered submission artifact.
- The installed APK contains a real 375,726-byte MWA bundle. Recovered source and submission APK contain a 133-byte placeholder instead. Thus prior physical wallet-launch evidence cannot establish wallet readiness of the recovered submission artifact.
- Android resolves `solana-wallet:` to `com.solanamobile.wallet.MWABottomSheetActivity`; Chrome is available for merchant handoff. Discovery is not connection evidence.

## Reproduced defect and repair

Impact: HIGH. The recovered APK cannot register MWA, although it builds and launches.

Restored readable `mwa-bootstrap.ts` from the actual installed bundle's registration behavior, checked against the existing Soldoku implementation. Added the build-only MWA dependency and an esbuild command, regenerated the bundled asset, and added a regression that executes the actual packaged JavaScript and confirms a connection-capable wallet is registered exactly once. Desktop and insecure contexts do not register.

Android preBuild now rejects the known placeholder rather than packaging it silently. The asset remains trusted-origin injected; registration never requests connection, a signature, or execution automatically.

Repair APK: `android/app/build/outputs/apk/release/app-release.apk`.

- SHA-256: `0533EA859C8FF4FCCDE60E518BDCE39B69858A6BAB53B560F8517E8EC8D6A1C1`.
- Identity: `app.supertab.shop`, version 1.0.0 / code 1.
- Signer SHA-256: `0512b66bf8f8efc5119ce9c10191ed7a85317619986fbeda357c8cc39b42a439`; matches installed original. Existing signing configuration used, no replacement key.
- Native Kotlin behavior unchanged. This repair requires an updated APK, not hosted deployment.
- Original submission artifact retained for evidence; do not present it as repaired.

## Four physical verification groups

| Group | Actions / expected behavior | Observed | Status |
| --- | --- | --- | --- |
| Shopping journey | Launch installed shell; then search/refine/save/compare/review/refresh | Launch observed. Full interactive journey pending coordinated device control | BLOCKED / incomplete |
| Back/resume/lifecycle | Background/reopen/recreate; preserve shopping and invalidate authority | Source inspected; physical scenarios not yet exercised | BLOCKED / incomplete |
| Wallet/account/balances | Discover wallet, owner approves ordinary connection, read balances | Wallet intent handler exists; recovered APK registration defect repaired locally. No actual account/balances verified | BLOCKED / incomplete |
| Cancellation/handoff | Cancel connection and open merchant product/cart, return with context | External browser available; actual interactions pending | BLOCKED / incomplete |

Owner checkpoint: provide uninterrupted device-testing availability. When ordinary wallet authorization appears, owner must approve on the physical device. No agent approval, message signing, or transaction signing is permitted. Any restart also requires coordination.

## Local verification

- Vitest: 266 passed / 10 skipped.
- Typecheck: passed.
- ESLint: passed after diagnostic extracted bundle was stored as text (a first run linted that generated diagnostic JS; no app lint defect).
- Production web build: passed.
- Deterministic Playwright: 15 passed. These are browser fixtures, not Seeker evidence.
- Android release assemble: passed with existing signing key.
- Android unit tests freshly rerun with `--rerun-tasks`: 5 passed.
- Gradle wallet-bundle guard: valid bundle accepted; known placeholder rejected in a controlled negative check, then original asset bytes restored.
- Production dependency audit: zero advisories; build-only MWA dependency brings React Native tooling transitive advisories (17 high in full audit). No `npm audit fix --force` or broad dependency replacement performed.

## Evidence and safety

Diagnostic artifacts reside locally under ignored `output/`: installed APK extraction and bootstrap text, initial launch screenshot. These are diagnostic captures, not final demo footage. No seeds, secrets, signatures, payments, swaps, refunds, or purchase execution were accessed/requested. No push, deployment, secret change, or provider onboarding performed.

## Remaining release/demo uncertainty

NOT READY to freeze the physical demo flow. Repair APK has not yet been installed/tested on the Seeker; actual account connection and the four full device groups remain unverified. Preserve the original goal (Solana assets buying normal products) with honest live/simulated/historical/blocked stages; external payment-provider blockers remain frozen.
