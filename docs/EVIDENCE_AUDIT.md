# End-to-end evidence audit — October 3, 2026

Implementation inspected at `65aa512`. This is an incomplete MVP audit, not an end-to-end completion claim. Earlier PC balance checks using the imported Artportal Devnet RPC cannot establish mainnet funding readiness.

| Required step | Authoritative evidence currently available | Remaining proof |
| --- | --- | --- |
| Real product | Browser catalog searches returned real Shopify products and merchant links. | Availability can change; repeat the search for the demonstration. |
| Real checkout total | True Classic Bangkok Pay now on the merchant page reconciles: subtotal 1,750.00, shipping 506.53, duties 795.49, taxes 222.82, total 3,274.84 THB. The authenticated API states the same total but records duty as 704.31, so its components are 91.18 short. Status stays `requires_escalation` with `extension_interaction_required` after contact details. Pay on delivery changes the page total to 2,256.53. No payment was submitted. SuperTab does not fund from the unreconciled API breakdown or from a non-USD total. | A reconciled USD total at `ready_for_complete`. The current THB page total can still change with the duties choice and the checkout extension. |
| Real Solana wallet | Edge connected an account and the server accepted its control-message signature. The address was checked as part of that verification and was not written to the log. This standalone check did not read balances. | A fresh balance read for that connected account. The control signature is not a balance proof. |
| Funding plan | Integer USDC deficit/reserve calculations; real browser insufficient-funds result after correcting the RPC network. | Recompute against the verified final merchant amount and current buyer balances. |
| Live DFlow | Opt-in production quote and unsigned preparation tests passed. | User-controlled conversion execution is disabled. A prepared quote cannot prove converted USDC. |
| Explicit approval | Terms-bound merchant approval and separate quote consent, with refresh/expiry invalidation tests. | Browser approval of an actual verified final total. Wallet connection or a message signature does not establish purchase approval. |
| Wallet signing | On October 3, 2026 Edge signed the wallet-control message. The server logged `wallet-control start` and then `wallet-control verify`, and the verify request returned HTTP 200. That path checks the exact challenge and verifies the Ed25519 signature before recording wallet control. The signature is not stored. No purchase was created and no transaction was broadcast. | A fresh signature after the five-minute proof expires. The separate Devnet memo check was not signed. |
| USDC ready | Canonical mainnet USDC account aggregation and funding calculations tested. | Fresh buyer USDC covering the real total. Neither a conversion quote nor sample balance qualifies. |
| CardRail | Provider-neutral boundary; Bridge accepts only its sandbox host and has no key. Immersve’s published sandbox keys returned HTTP 401 `API_KEY_DISABLED` on the supported-regions read. Authorization, clearing, reversal, and webhooks were not called. | A different legitimate sandbox that authenticates. The published Immersve keys are an external access block, not an implementation miss. |
| Authorization / capture | Explicitly labeled local rehearsal handles approval, decline, authorization, capture and refund. | Provider sandbox lifecycle evidence. Local fixtures cannot be presented as Bridge or Stripe sandbox transactions. |
| Merchant order | Order remains separate from payment; local rehearsal requires independent simulated receipt evidence. Actual application reports ORDER_NOT_CREATED. | A legitimate sandbox merchant order independently retrieved and matched to the selected purchase. No real purchase is authorized. |

## Next evidence collection

1. **Merchant:** the Bangkok Pay now page total reconciles in THB and is not a USD funding amount. The API duty line is still short by 91.18, and `extension_interaction_required` remains. Do not complete the production checkout. A later read must stay sanitized: amount, status, variant, and quantity only.
2. **Wallet:** the Edge control-message signature is verified. It expires after five minutes and does not approve a purchase. The separate Devnet memo check was not signed and must not be broadcast if it is used later.
3. **CardRail/order:** provide legitimate provider sandbox access in the ignored local configuration. Verify authentication before card issuance; exercise sandbox authorization/capture/refund and retrieve a separate sandbox merchant order. Keep provider evidence distinct from the existing local rehearsal.

The public Shopify mock-shop starter explicitly mocks checkout and creates no order. It is useful for catalog/cart development but cannot close the final-total or merchant-order evidence gaps: [official mock-shop starter](https://github.com/Shopify/mock-shop-starter). Authenticated merchant checkout requirements are documented in [Shopify Checkout MCP](https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp).

## Current engineering checks

At `65aa512`, 92 deterministic tests and four opt-in live checks passed; lint and the production build with TypeScript checking passed. These checks prove their covered paths, not the missing browser/provider ceremonies above. Runtime financial execution remains disabled. Local sessions are in memory and disappear on server restart.
