# SuperTab — submission text

Do not submit this form automatically. The authenticated CLOCK IN form was not opened, and this text has not been submitted. Rechecked on 11 October 2026: the live desk at https://solanamobile.radiant.nexus/ shows submissions close on 13 October 2026 at 6:59 AM GMT+7, and judging opens at 7:00 AM GMT+7 the same day. That matches the earlier Align `submissionCloseDate` `2026-10-12T23:59:00.000Z`. An official blog post still says 8 October 2026. Use the live desk calendar, then recheck the authenticated form before submitting.

## Brief description (under 500 characters)

SuperTab is AI shopping that uses Solana assets to complete purchases. The Android app searches real products, reviews funding from a Solana wallet, and keeps approval, payment, and order evidence as separate steps. Retail payment is blocked by provider access. A labeled simulation and a separate paid-and-refunded devnet test show the intended path without claiming a completed retail purchase.

## What are you building, and who is it for?

I'm building SuperTab for people who hold Solana and want to buy ordinary goods with what their wallet can cover. The full goal is search, compare, fund, approve exact terms, convert when needed, pay the merchant, and recover the order. The CLOCK IN build is an installed Android app that already does live shopping and funding review. Retail payment and merchant order creation stay blocked while card-rail and Shopify order access are missing. A labeled local rehearsal and a separate owner-controlled devnet payment/refund keep that destination visible without overstating it.

## Why did you decide to build this, and why build it now?

I wanted to make crypto useful beyond holding and trading. Someone can have money in a Solana wallet and still face several disconnected steps to buy something online. SuperTab keeps the whole purchase journey in one Android app, with honest labels for what is live, simulated, historical, or blocked. Solana Mobile's wallet adapter is how a Seeker can connect without a desktop browser extension.

## Technologies

Next.js, React, TypeScript, Tailwind CSS, Gemini, Shopify/eBay product sources, Solana RPC, USDC, DFlow quotes, and a signed Android WebView shell with Mobile Wallet Adapter. Hosted on Vercel and Cloudflare Workers. The APK loads the hosted site. It does not embed server secrets.

## Chains

Solana

## How does your product use these chains? (under 500 characters)

The app reads Solana balances and can quote a DFlow conversion into USDC without broadcasting. Purchase approval is bound to exact terms. Retail payment stays provider-blocked. A labeled simulation rehearses authorize/capture/order without funds. A separate owner-controlled devnet order was paid and refunded; it is not payment for the selected retailer.

## Category

AI Platforms / Agents

## Project website / Live product link

https://supertab-main.vercel.app

## GitHub repository

https://github.com/Kleangkao/supertab

The repository is already public. Production `main` is commit `f62491159cec2e17c25163a31fa57f8c22d02a49`. Do not change visibility.

## Repository context (under 500 characters)

The public repository contains the Next.js shopping app, the Android shell in `android/`, wallet and funding code, and the devnet merchant. Production is https://supertab-main.vercel.app at commit `f62491159cec2e17c25163a31fa57f8c22d02a49`. The signed APK is local and is not in Git. Retail checkout is quote-only. Secrets and the release keystore are not in Git.

## Access instructions

Install the local `submission/supertab-clockin.apk` on a Seeker or another Android device. The application id is `app.supertab.shop`, version 1.0.0. The app loads https://supertab-main.vercel.app/. Search for a black polo, refine the request, and open a result. The review shows a catalog planning price and says shipping, tax, and the final total are not confirmed. Connect wallet uses Mobile Wallet Adapter and does not send a payment. Public-address lookup is under Explore without connecting. Opening the product page or merchant cart does not pay. The devnet page can show historical refunded order `e485b032-7abd-4a59-849c-f37775ec57c6`. That order did not pay for the selected retailer. Do not start a new test checkout.

Build command, from `android/`, after loading the signing values from `%USERPROFILE%\.config\supertab\signing.properties`: `.\gradlew.bat assembleRelease`.

## Notes for judges (under 500 characters)

On 11 October 2026 a physical Seeker used the installed production app. A retained black-polo search kept its shortlist and selected polo. A public read-only demo wallet showed a real USDC shortfall and a live DFlow quote. Leaving the app cleared that funding review and kept the shopping context. The merchant product page opened and did not pay. Retail payment stays provider-blocked. An earlier devnet order was paid and refunded; it did not pay for this shirt.

## Team / contact

Telegram: @James_StarAtlas

X: https://x.com/noisesang

Country: choose your actual country of residence (Thailand if that is correct).

Meaningful work by people not listed: confirm before completing this field; do not assume “none.” AI development tools were used to build the app.

## Media fields

Demo video: recorded on 11 October 2026 from the installed app on a physical Seeker. Local file `videos/supertab-seeker-demo/supertab-seeker-demo-final-2026-10-11.mp4`, duration 2 minutes 1 second. It is not a public judge link until it is uploaded. The website renders `videos/supertab-showcase/` and `videos/supertab-pitch/` are not this device demo. Do not submit a cloned-voice pitch as the founder.

Pitch deck: open `submission/pitch.html` in a browser. The spoken script is `submission/PITCH_SCRIPT.md`. No `submission/pitch.pdf` is in the tree. Upload the deck before submission. The public desk asks for a pitch deck or a brief presentation.

Project logo: the app icon is the SuperTab tab mark in `android/app/src/main/res/`.

## APK

- File: `submission/supertab-clockin.apk`
- SHA-256: `0533ea859c8ff4fccde60e518bdce39b69858a6bab53b560f8517e8ec8d6a1c1`
- Size: 23,371,280 bytes
- Installed on the physical Seeker and pulled back with the same hash. Hosted-only production commit `f62491159cec2e17c25163a31fa57f8c22d02a49` did not require a new APK.
- Build: existing `.\gradlew.bat assembleRelease` from `android/`, with `JAVA_HOME` on JDK 17 and the existing signing properties loaded. No replacement key was generated.
- Historical hashes, not this file: `72d7c78915c89668a2041e0412493a674d2b22086e04670e4cb5b4f395c6c1ca` was an earlier installed APK. `c0fe8e1fece73cb650e1cdd65ffe7f86a220c883923f20dbb3507744a8f30456` (23,290,208 bytes) was the previous local submission copy and is preserved outside the judge filename. Same signer certificate.
- Package: `app.supertab.shop`, versionName 1.0.0, versionCode 1
- minSdk 28, targetSdk 37, compileSdk 37
- Permission requested by the app: `android.permission.INTERNET`
- Signer certificate SHA-256: `0512b66bf8f8efc5119ce9c10191ed7a85317619986fbeda357c8cc39b42a439`
- Keystore: outside Git, at `%USERPROFILE%\.config\supertab\`
- The APK file is local. It is not in the GitHub repository.

## Requirement checklist — 11 October 2026

| Requirement | Artifact | Judge can open it now |
| --- | --- | --- |
| Functional Android APK | Local `submission/supertab-clockin.apk`, SHA-256 `0533ea859c8ff4fccde60e518bdce39b69858a6bab53b560f8517e8ec8d6a1c1`. Same file is installed on the physical Seeker. | No. The APK is local and is not in Git. |
| Source repository | https://github.com/Kleangkao/supertab at `f62491159cec2e17c25163a31fa57f8c22d02a49` | Yes. The repository is public. |
| Live product | https://supertab-main.vercel.app at that commit. GitHub production deployment `6993146946`. | Yes. |
| Demo video | Local `videos/supertab-seeker-demo/supertab-seeker-demo-final-2026-10-11.mp4`, 2 minutes 1 second, recorded from the installed app. | No, until the owner uploads it. |
| Pitch | `submission/pitch.html`. No PDF is in the tree. | No, until uploaded. |
| Metadata and install notes | This file | No, until pasted into the form. |
| Deadline | Live desk calendar: 13 October 2026, 06:59 Asia/Bangkok. Judging opens 07:00 the same day. | The authenticated form was not opened. This package has not been submitted. |

The APK loads the production alias. Financial execution stays disabled.
