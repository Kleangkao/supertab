# Judge demo on Android

Install the local file `submission/supertab-clockin.apk`. Application id `app.supertab.shop`, version 1.0.0, version code 1. SHA-256 `0533ea859c8ff4fccde60e518bdce39b69858a6bab53b560f8517e8ec8d6a1c1`. Signer certificate SHA-256 `0512b66bf8f8efc5119ce9c10191ed7a85317619986fbeda357c8cc39b42a439`.

The phone needs a network connection. The app loads https://supertab-main.vercel.app/. It asks only for internet access. Production source is commit `f62491159cec2e17c25163a31fa57f8c22d02a49`.

1. Open SuperTab.
2. Search for a black polo, then refine the request. A retained search on 11 October 2026 used a $40 budget and kept two polos on the shortlist.
3. Open a result. Read the catalog planning price. Shipping, tax, and the final checkout total stay unconfirmed.
4. For a read-only funding check, use Explore without connecting and the public demo wallet, or enter a public address. Connect wallet uses Mobile Wallet Adapter and does not send a payment. Do not approve a signature.
5. Read any shortfall and DFlow quote as a quote only. On 11 October the public demo wallet still needed about 15.98 USDC for a $16.99 planning amount.
6. Open the product page or merchant cart. Those links do not pay or place an order. The merchant page can show a different live price from the planning amount.
7. Leave the app and come back. Funding balances clear. The search, shortlist, and selected product stay.
8. The devnet page can show historical order `e485b032-7abd-4a59-849c-f37775ec57c6`, which was paid and refunded on devnet. It did not pay for the selected retailer. Do not start a new checkout.

Source: https://github.com/Kleangkao/supertab is public. The pitch deck is `submission/pitch.html`. The Seeker recording is local at `videos/supertab-seeker-demo/supertab-seeker-demo-final-2026-10-11.mp4` and is not a public link yet.
