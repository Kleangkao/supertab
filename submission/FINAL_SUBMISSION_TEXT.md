# SuperTab — submission text

Do not submit this form automatically. The authenticated CLOCK IN form was not opened, so extra fields are unverified. On 9 October 2026 the public desk HTML still does not print a deadline. The live Align schedule returns submissionCloseDate 2026-10-12T23:59:00.000Z, which is 13 October 2026 at 06:59 Asia/Bangkok. An announcement still says submissions close on 8 October 2026. Use the Align timestamp, then recheck the authenticated form before submitting.

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

The repository is private. Judges cannot open it until access is granted or it is made public after a secret review. Do not change visibility automatically.

## Repository context (under 500 characters)

The repository contains the Next.js shopping app, the Android shell in `android/`, wallet and funding code, and the devnet merchant. The signed APK is `submission/supertab-clockin.apk`. Retail checkout is quote-only. Secrets and the release keystore are not in Git.

## Access instructions

Install `submission/supertab-clockin.apk` on a Seeker or another Android device. The application id is `app.supertab.shop`, version 1.0.0. Search for a black polo under $50, refine the request, and open a result. The review shows the catalog price and that shipping and tax are not confirmed. Connect wallet uses Mobile Wallet Adapter and does not send a payment. Public-address lookup is under Explore without connecting. Devnet checkout opens the existing refunded test order. Do not start a new test checkout.

Build command, from `android/`, after loading the signing values from `%USERPROFILE%\.config\supertab\signing.properties`: `.\gradlew.bat assembleRelease`.

## Notes for judges (under 500 characters)

On 8 October 2026 a physical Seeker searched, refined, and reviewed a real $39.99 polo. The Solana Mobile wallet opened and then could not load, so a connected balance is unverified. On 9 October an emulator installed this APK and ran a live polo search. Product-page and merchant-cart labels were separate. No wallet was connected and no funds were sent.

## Team / contact

Telegram: @James_StarAtlas

X: https://x.com/noisesang

Country: choose your actual country of residence (Thailand if that is correct).

Meaningful work by people not listed: confirm before completing this field; do not assume “none.” AI development tools were used to build the app.

## Media fields

Demo video: not published. Desktop files `videos/supertab-showcase/renders/supertab-demo-final.mp4` and `videos/supertab-pitch/renders/supertab-founder-pitch-captioned.mp4` do not show the installed Android app. Record the Seeker flow and upload that video before submission. Device screenshots from the 8 October 2026 check are in `submission/supertab-seeker-*.png`.

Pitch: open `submission/pitch.html` in a browser. The spoken script is `submission/PITCH_SCRIPT.md`. Publish a link or upload the deck before submission.

Project logo: the app icon is the SuperTab tab mark in `android/app/src/main/res/`.

## APK

- File: `submission/supertab-clockin.apk`
- SHA-256: `c0fe8e1fece73cb650e1cdd65ffe7f86a220c883923f20dbb3507744a8f30456`
- Size: 23,290,208 bytes
- Source commit: `99bfc09069330b62fdad00f5ad1f68ae30eb7db1`
- Build: `.\gradlew.bat assembleRelease test` from `android/`, with `JAVA_HOME` on JDK 17 and the existing signing properties loaded
- The earlier local file hash `72d7c78915c89668a2041e0412493a674d2b22086e04670e4cb5b4f395c6c1ca` belonged to an APK that is no longer on disk. This rebuild is signed by the same certificate.
- Package: `app.supertab.shop`, versionName 1.0.0, versionCode 1
- minSdk 28, targetSdk 37, compileSdk 37
- Permission requested by the app: `android.permission.INTERNET`
- Signer certificate SHA-256: `0512b66bf8f8efc5119ce9c10191ed7a85317619986fbeda357c8cc39b42a439`
- Keystore: outside Git, at `%USERPROFILE%\.config\supertab\`
- The APK file is local. It is not in the GitHub repository.

## Requirement checklist — 9 October 2026

| Requirement | Artifact | Judge can open it now |
| --- | --- | --- |
| Functional Android APK | `submission/supertab-clockin.apk`, SHA-256 `c0fe8e1fece73cb650e1cdd65ffe7f86a220c883923f20dbb3507744a8f30456` | No. Local only. Not installed on a device in this rebuild. |
| Source repository | https://github.com/Kleangkao/supertab at `99bfc09069330b62fdad00f5ad1f68ae30eb7db1` | No. The repository is private. |
| Demo video | Not recorded from this APK. Existing renders are not the installed app. | No. |
| Pitch | `submission/pitch.html` and `submission/pitch.pdf` | No, until uploaded. |
| Metadata and install notes | This file | No, until pasted into the form. |
| Deadline | Align `submissionCloseDate` `2026-10-12T23:59:00.000Z` = 13 October 2026, 06:59 Asia/Bangkok | The public desk HTML does not show this. The authenticated form was not opened. |

Merchant-link wording is in commit `a4b6936`. Pushing `main` publishes production through the existing Vercel Git integration. That wording went live on `dpl_ABMeua9scWfnhyExygtmUYJQyCYZ` and stays on later production revisions from this branch. The APK loads the production alias.
