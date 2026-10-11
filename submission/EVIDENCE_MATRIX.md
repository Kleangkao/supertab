# Evidence matrix

The 8 October 2026 table below is the record from that day. It is not the current release. On 11 October 2026 the installed repaired APK and production commit `f62491159cec2e17c25163a31fa57f8c22d02a49` were retested on the same physical Seeker class (Android 16). The current checklist is `docs/CLOCK_IN_RELEASE_2026-10-11.md`.

Current corrections:

- The submission APK is SHA-256 `0533ea859c8ff4fccde60e518bdce39b69858a6bab53b560f8517e8ec8d6a1c1`, and that hash matches the installed app.
- The GitHub repository is public.
- A connected read-only balance was later verified: 0 SOL and 0 USDC, plus another token with no invented valuation. The 8 October “wallet could not load” row stays historical.
- Returning from Home clears that funding review and keeps the shopping context.
- A Seeker demo file now exists locally. It is not a public link.
- Retail payment and merchant order completion remain provider-blocked.

## 8 October 2026 record

Checked on 8 October 2026. The Seeker was a physical device running Android 16. No payment was approved.

| Capability | Status | Evidence |
| --- | --- | --- |
| Signed APK identity `app.supertab.shop` 1.0.0 | Working | `apksigner` and `aapt dump badging` on `submission/supertab-clockin.apk` |
| Install and launch on a Seeker | Working | `adb install` Success. `am start` resumed `app.supertab.shop/.MainActivity` |
| Hosted shopping UI inside the APK | Working | `submission/supertab-seeker-launch.png` |
| Search real Shopify listings | Working | Six listings for a black polo under $50. `submission/supertab-seeker-results.png` |
| Refine the request | Working | Follow-up “Navy is fine too.” kept polo, black or navy, and the $50 cap. `submission/supertab-seeker-refined.png` |
| Listing price with unknown shipping and tax | Working | Black Classic Polo, catalog $39.99, shipping and tax not confirmed. `submission/supertab-seeker-review.png` |
| Funding gap without a connected wallet | Working | Review showed 0 USDC in wallet and 39.99 USDC still needed, with no wallet selected |
| Mobile Wallet Adapter discovery | Working | Picker said Mobile Wallet Adapter, Detected. `submission/supertab-seeker-wallet.png` |
| Seeker wallet handoff | Working, then blocked | Foreground activity became `com.solanamobile.wallet/.MWABottomSheetActivity`. The wallet then said it could not load and suggested a restart. `submission/supertab-seeker-mwa.png` |
| Connected balance read | Unverified | The wallet app did not present an account |
| Return to the shopping review | Working | After the wallet closed, the $39.99 review was still on screen |
| Android back from the devnet page | Working | Back returned to the same purchase review |
| Public-address fallback | Working in the UI, not completed on device | “Explore without connecting” is on the review. A lookup was not submitted on the Seeker |
| Existing devnet payment and refund | Recorded | Devnet page read order `e485b032-7abd-4a59-849c-f37775ec57c6`, status refunded. `submission/supertab-seeker-order.png` |
| New retail or devnet payment | Not done | Retail checkout stays quote-only. The new-checkout button was not used |
| Hosted backend health | Working | `GET https://supertab-main.vercel.app/api/health` returned HTTP 200. Financial execution is disabled |
| Wallet and session unit tests | Working | `tests/android-shell.test.ts` and `android` `ShellNavigationTest` |
| Seeker demo video for judges | Missing | Screenshots exist. No shareable video of this install |
| Pitch for judges | Local only | `submission/pitch.html` and `submission/PITCH_SCRIPT.md` |
| Public GitHub access | Blocked | https://github.com/Kleangkao/supertab is private |
| dApp Store listing | Planned | Not required to enter. Not submitted |
| Card payments and mainnet retail settlement | Planned | Not connected |
