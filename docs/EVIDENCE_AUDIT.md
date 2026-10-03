# End-to-end evidence audit — October 3, 2026

Implementation inspected at `65aa512`. This is an incomplete MVP audit, not an end-to-end completion claim. Earlier PC balance checks using the imported Artportal Devnet RPC cannot establish mainnet funding readiness.

| Required step | Authoritative evidence currently available | Remaining proof |
| --- | --- | --- |
| Real product | Browser catalog searches returned real Shopify products and merchant links. | Availability can change; repeat the search for the demonstration. |
| Real checkout total | Authenticated True Classic read reached an incomplete checkout. Strict variant, quantity, currency, expiry and reconciled totals are tested with fixtures. | A buyer-completed, ready checkout accepted through the actual adapter. Catalog price and provisional checkout totals do not qualify. |
| Real Solana wallet | Live mainnet RPC read after checking its genesis hash. Balances expire after one minute. | Actual buyer account connection in a wallet-enabled browser. A public address lookup is read-only. |
| Funding plan | Integer USDC deficit/reserve calculations; real browser insufficient-funds result after correcting the RPC network. | Recompute against the verified final merchant amount and current buyer balances. |
| Live DFlow | Opt-in production quote and unsigned preparation tests passed. | User-controlled conversion execution is disabled. A prepared quote cannot prove converted USDC. |
| Explicit approval | Terms-bound merchant approval and separate quote consent, with refresh/expiry invalidation tests. | Browser approval of an actual verified final total. Wallet connection or a message signature does not establish purchase approval. |
| Wallet signing | Real Ed25519 verification with ephemeral test keys; Wallet Standard message and Devnet sign-only memo paths implemented. Devnet RPC accepts the memo format. | Actual extension signature and its server verification. No production signing or broadcast. |
| USDC ready | Canonical mainnet USDC account aggregation and funding calculations tested. | Fresh buyer USDC covering the real total. Neither a conversion quote nor sample balance qualifies. |
| CardRail | Provider-neutral boundary; Bridge accepts only its sandbox host. | Legitimate sandbox credentials and an actual provider response. Configuration presence alone does not prove access. |
| Authorization / capture | Explicitly labeled local rehearsal handles approval, decline, authorization, capture and refund. | Provider sandbox lifecycle evidence. Local fixtures cannot be presented as Bridge or Stripe sandbox transactions. |
| Merchant order | Order remains separate from payment; local rehearsal requires independent simulated receipt evidence. Actual application reports ORDER_NOT_CREATED. | A legitimate sandbox merchant order independently retrieved and matched to the selected purchase. No real purchase is authorized. |

## Next evidence collection

1. **Merchant:** use an owner-controlled Shopify development store with test checkout, or have the buyer finish contact/delivery details directly at the chosen merchant. Read the current checkout reference through the authenticated adapter. Do not complete a production checkout. Record only sanitized amount/status/variant/quantity evidence; do not save raw capability references, buyer details or payment instruments.
2. **Wallet:** open SuperTab in an owner-authorized wallet-enabled browser. The owner connects their account, reads the exact control message and signs it. If the account advertises Devnet legacy signing, the owner may review/sign the separate memo check. Confirm the server receipt says broadcast false. No seed phrase, key, balance top-up or production transaction is needed.
3. **CardRail/order:** provide legitimate provider sandbox access in the ignored local configuration. Verify authentication before card issuance; exercise sandbox authorization/capture/refund and retrieve a separate sandbox merchant order. Keep provider evidence distinct from the existing local rehearsal.

The public Shopify mock-shop starter explicitly mocks checkout and creates no order. It is useful for catalog/cart development but cannot close the final-total or merchant-order evidence gaps: [official mock-shop starter](https://github.com/Shopify/mock-shop-starter). Authenticated merchant checkout requirements are documented in [Shopify Checkout MCP](https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp).

## Current engineering checks

At `65aa512`, 92 deterministic tests and four opt-in live checks passed; lint and the production build with TypeScript checking passed. These checks prove their covered paths, not the missing browser/provider ceremonies above. Runtime financial execution remains disabled. Local sessions are in memory and disappear on server restart.
