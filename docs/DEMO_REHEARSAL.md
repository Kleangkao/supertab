# SuperTab demo rehearsal — October 6

## Startup

The public site is https://supertab-main.vercel.app. Devnet order reads go to https://supertab-devnet-merchant.jamesbitarcade.workers.dev. That service keeps the preserved ledger in durable storage. Do not start a new payment or refund for the rehearsal.

For a local run, use Node.js 20.19+ and the existing private .env.local configuration. Never copy secrets into the submission or video. Run npm ci when dependencies are missing, then npm run merchant and npm run dev in separate terminals. Open http://localhost:3000. The local merchant stays on 127.0.0.1:8787. Keep SUPERTAB_MAINNET_EXECUTION=disabled. Local recovery records and the merchant data file must be preserved.

Gemini is configured on the public site as the server-only `GEMINI_API_KEY` secret. Search and follow-ups use it, and the structured text parser remains the fallback if Gemini is unavailable. Do not paste the key into chat or the repository.

## Rehearsal

1. Start on the home page. The shopping request is the first interaction. Ask for a black polo under $50; check actual returned products, merchant names, and prices. If a provider is unavailable, say so; do not replace missing live results with invented listings.
2. Select a product. Check quantity, merchant link, and price breakdown. Explain that listed prices do not include a verified final retail checkout total.
3. Use the read-only demo wallet in the review. Check the current balances and funding gap. Optional wallet ownership proof is separate and is not needed to explore. Reconnect in Phantom's browser only if testing connection; never sign for this rehearsal.
4. Open Demo records (/evidence). Expand the recorded retail quote breakdown. Open View order & refund to read the existing merchant record. Confirm its returned status; this action must create no checkout.
5. Expand the mainnet quote tool if useful. Requesting a quote signs and sends nothing. Keep mint/provider diagnostics out of the main recording unless they explain a result.
6. The incomplete timestamp integration is a read-only note on Demo records. The confirmed conversion is historical evidence; no timestamp settlement or certificate is verified. Do not refresh, replay, replace, or submit its payment.
7. Inspect desktop and narrow layouts in the recording browser. Check focus, loading messages, dismissible errors, and wallet reconnect after refresh. Trusted reconnect is allowed only for the stored expected account; connection does not restore a signed ownership proof.

## Freeze

Run npm test, npm run typecheck, npm run lint, and npm run build. Restart the dev server if it retains stale modules. Rehearse again after any changes. Existing payment journals and devnet orders must remain intact. No new payment or refund is needed for the video. Use docs/SUBMISSION_COPY.md for the form; complete media links, judge repository access, and the team profile separately.

The old docs/DEMO.md contains historical capability notes; use this rehearsal for the polished home page.
