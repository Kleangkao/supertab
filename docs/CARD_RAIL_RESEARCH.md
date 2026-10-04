# Card rail research — October 3, 2026

Checked from current first-party docs. This is not a recommendation to open an account, and no account was created. Absence from a restricted-country list is not eligibility. A consumer card is not a programmable issuer.

SuperTab still has no connected rail. Bridge sandbox credentials are not configured. The previous Bridge dashboard sign-in did not produce an API key. No card number exists in the app, and no payment is sent.

## Real-world proof versus programmable rail

These are different jobs.

A real-world proof is a person completing individual KYC with a consumer product, funding it from Solana USDC, and paying a normal merchant with the resulting Visa or Mastercard. That can demonstrate purchasing power. It does not give SuperTab provisioning, spend controls, authorization webhooks, or revocation.

A programmable rail is an issuer API the application can call. The issuers with public APIs found in this pass require a platform or partner account. That is business onboarding, not an individual self-serve switch.

## Strongest accessible real-world proof

No first-party page in this pass proved that a specific consumer card both accepts a Thailand resident and settles Solana USDC, with a developer API. Marketing pages that claim Thailand plus Solana USDC exist, but they are not programmable and were not treated as eligibility proof when the underlying terms or country list could not be opened.

What is established:

- Gnosis Pay's own country article lists Thailand on the planned list, not the current supported list. Its card spends from a Gnosis Safe, not from Solana USDC. The API is real, and card creation requires KYC plus a supported country. Thailand fails that country check today. Source: https://help.gnosis.io/en/articles/14779917-countries-supported-restricted-on-the-roadmap
- RedotPay's own news post says USDC and USDT can be withdrawn to Solana. That is a withdrawal from their balance, not evidence of a Thailand individual KYC outcome or of a third-party issuing API. Source: https://www.redotpay.com/news/redotpay-now-supports-usdc-usdt-withdrawals-to-solana

The practical proof path, if the owner wants one, is still a consumer app the owner chooses after reading that provider's own eligibility and KYC terms. SuperTab should not embed that card's PAN or CVV.

## Strongest programmable path

Bridge plus Stripe Issuing remains the most concrete Solana USDC design in public docs, and it is not currently usable here.

- Sandbox keys require a Bridge developer account. Bridge's own quick start says to contact support@bridge.xyz first. Only dashboard admins can create keys. Source: https://apidocs.bridge.xyz/get-started/introduction/quick-start/setting-up-sandbox
- Cardholders can be individuals, and Bridge's customer country table includes Thailand. That does not make the platform signup individual or self-serve. Card issuance also depends on whether the card program is approved for the region. Source: https://apidocs.bridge.xyz/platform/cards/overview/kyc
- The local integration still refuses the production host and has no sandbox key. Status remains blocked, not ready.

Rain documents a Visa issuing API, webhooks, and a sandbox, but only after commercial alignment and an NDA. That is sales-gated. Source: https://www.rain.xyz/resources/launch-a-card-program-with-rain

Kulipa's onboarding guide says an onboarding engineer provides sandbox keys. That is not self-serve. Its public marketing says Solana can be deployed; the sandbox-key step is still partner-gated. Source: https://kulipa.readme.io/reference/onboarding-flow

## Strongest Solana-compatible programmable path

Immersve documents a public sandbox, simulator authorization, clearing, and reversal, plus RSA-signed webhooks. Its supported-chain table does not include Solana. On October 3, 2026 both published sandbox keys, card-issuer and account-admin, were sent to `GET /api/accounts/{partnerAccountId}/supported-regions` on `https://test.immersve.com`. Both returned HTTP 401 `API_KEY_DISABLED`. No card was created, and authorization, clearing, reversal, and webhook delivery were not exercised. Test-mode KYC exists in the docs and was not submitted. Source: https://docs.immersve.com/resources/public-sandbox-account/ and https://docs.immersve.com/guides/supported-chains/

No reviewed issuer combined all of: individual self-serve signup, confirmed Thailand eligibility, Solana USDC funding, and a developer API that can be called without a partner agreement.

## Explicitly the wrong funding model

Crossmint's agent-card quickstart charges a card the person already has. It says eligible U.S. Visa cards work and non-US Visa cards do not. The card data stays in a PCI-hosted component, which is the right credential boundary, but the product does not turn Solana USDC into a card. Source: https://docs.crossmint.com/agents/cards-quickstart.md

## What SuperTab should keep separate

Funding readiness, card authorization, capture, and merchant order confirmation stay separate. Gemini and ordinary logs must not receive a PAN, CVV, or full card credential. Until a sandbox key exists, the rail status stays not connected or sandbox blocked. The local payment rehearsal is still a simulation.
