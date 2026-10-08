# SuperTab — submission text

Do not submit this form automatically. The authenticated CLOCK IN form was not opened, so extra fields are unverified. On 8 October 2026 the public desk page was a visual calendar and terminal; its HTML did not include the deadline. An earlier look at that calendar showed submissions close on 12 October 2026 at 6:59 PM GMT+7. Recheck the calendar before submitting. The announcement date of 8 October conflicts with that calendar.

## Brief description (under 500 characters)

SuperTab is an Android shopping app for people who hold Solana. It searches Shopify and eBay, lets you refine the request, and reviews a real listing price while shipping and tax stay unconfirmed. Mobile Wallet Adapter is available for a read-only balance check. Retail checkout is quote-only. An earlier owner-controlled devnet order was paid and refunded. A card rail is planned.

## What are you building, and who is it for?

I'm building SuperTab for people who have crypto in a Solana wallet and want to use it for everyday shopping. The CLOCK IN build is an installed Android app. You tell it what you want, like a black polo under $50, then refine that request. It finds real products and shows the listed price next to what a wallet would still need. Shipping and tax stay unknown until a merchant confirms them. Retail checkout is quote-only. A separate devnet checkout has a recorded payment and refund. A crypto card service is the next step toward paying ordinary stores.

## Why did you decide to build this, and why build it now?

I wanted to make crypto useful beyond holding and trading. Someone can have money in a Solana wallet and still face several steps just to buy something online. SuperTab puts search, funding review, and a clearly labeled test checkout in one Android app. Solana Mobile's wallet adapter is how a Seeker can connect without a desktop browser extension.

## Technologies

Next.js, React, TypeScript, Tailwind CSS, Gemini, Shopify/eBay product sources, Solana RPC, USDC, DFlow quotes, and a signed Android WebView shell with Mobile Wallet Adapter. Hosted on Vercel and Cloudflare Workers. The APK loads the hosted site. It does not embed server secrets.

## Chains

Solana

## How does your product use these chains? (under 500 characters)

The Android app can request a Mobile Wallet Adapter connection and read balances without sending a transaction. DFlow can quote a conversion into USDC. Retail checkout does not pay the store. A separate owner-controlled devnet order was paid and later refunded; the app can open that recorded order. No new payment is part of the demo.

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

On a physical Seeker, the installed app searched, refined, and reviewed a real $39.99 polo with shipping and tax unconfirmed. Mobile Wallet Adapter opened the Solana Mobile wallet, which then could not load the wallet, so a connected balance read is unverified. The devnet screen showed the existing refunded order. No funds were sent during this check.

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
- SHA-256: `72d7c78915c89668a2041e0412493a674d2b22086e04670e4cb5b4f395c6c1ca`
- Size: 23,371,140 bytes
- Package: `app.supertab.shop`, versionName 1.0.0, versionCode 1
- minSdk 28, targetSdk 37, compileSdk 37
- Permission requested by the app: `android.permission.INTERNET`
- Signer certificate SHA-256: `0512b66bf8f8efc5119ce9c10191ed7a85317619986fbeda357c8cc39b42a439`
- Keystore: outside Git, at `%USERPROFILE%\.config\supertab\`
