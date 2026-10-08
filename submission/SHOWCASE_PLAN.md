# SuperTab silent product showcase

64 seconds · 1920×1080 · actual interface footage · light music · no talking.

| Time | Real footage | On-screen copy |
| --- | --- | --- |
| 0–5s | Returned shirt listing, image and price | Found it. Can my wallet cover it? |
| 5–16s | Home → type black polo under $50 → real results | Find a black polo under $50. |
| 16–25s | Navy follow-up → actual updated results | Try navy instead. |
| 25–39s | Selected product → price, shipping status, wallet coverage, shortfall | See the price. Check your balance. |
| 39–48s | Actual live SOL → USDC quote | Need more USDC? · Live quote, not a completed conversion |
| 48–58s | Existing refunded devnet order | Separate devnet checkout · Payment & refund verified |
| 58–64s | Home → clean end card | SuperTab · Find it. See what your wallet covers. · supertab-main.vercel.app |

Keep “Retail checkout: quote-only” visible during review. Clearly label read-only wallet data if used; do not imply a fresh balance read.

## Capture list
Record the public site at 1920×1080 and 100% browser zoom. Hide unrelated tabs/bookmarks. Leave two seconds before and after each action.

- shopping.webm: home → polo request → real results → navy follow-up → real results → select → review.
- funding.webm: existing mainnet conversion evidence. No new conversion or signing.
- order.webm: existing refunded devnet order e485b032-7abd-4a59-849c-f37775ec57c6. No new payment/refund.

Place recordings in videos/supertab-showcase/assets/footage/.

## Edit direction
Use actual UI as the hero. Captions stay away from controls and prices. Show context before enlarging details. Cut waiting with honest visible cuts. Make the mainnet-to-devnet transition explicit. Preserve shipping uncertainty and genuine shortfalls. Keep the final URL visible at least three seconds. Light music, no narration, short entrance fade and longer ending fade.

## Status
Real public-site footage was captured using Playwright. The complete HyperFrames composition is in videos/supertab-showcase, with six scenes, original instrumental music, and no narration. The export is renders/supertab-demo.mp4. Retail review remains quote-only; the mainnet funding scene shows a live quote and the checkout scene shows a separate existing refunded devnet order. No new financial transaction was created.
