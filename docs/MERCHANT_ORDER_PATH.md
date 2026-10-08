# Merchant order path — October 8, 2026

Checked against Shopify’s public agent docs on this date. No checkout was completed, no order was created, and no payment was sent. The historical `orders_not_allowed` result in `docs/CLOSED_ROUTES.md` was not repeated.

## Verdict

**EXTERNAL ACCESS REQUIRED** for an agent-placed Shopify order. **There is no supported read** for an order a shopper finishes on a retailer’s own page, or for an arbitrary retailer that did not go through this agent’s `complete_checkout`.

A Bridge card capture is not this path. eBay listing search is not this path.

## 1. Supported path

Shopify Catalog credentials can search products and can price a checkout at a merchant’s UCP endpoint. They do not, by themselves, place the order.

The only documented way for this agent to receive a Shopify order id is:

1. `create_checkout` or `get_checkout` until `status` is `ready_for_complete`.
2. `complete_checkout`, with the buyer’s payment instrument and one UUID `idempotency-key`. That call submits payment and places the order.
3. When `status` is `completed`, read `order.id`. That id is a lookup key, not proof the line and total still match.
4. After the documented propagation delay, call `get_order` with that id. The order is confirmed only when that document matches the checkout id, variant, original quantity, currency, and approved total.

General Catalog access is documented as `requires_escalation` plus `continue_url`. For that access, Shopify says the buyer finishes on the storefront and the agent does not call `complete_checkout`.

## 2. APIs, permissions, and accounts

| Step | Call | What it needs |
| --- | --- | --- |
| Product discovery | Catalog MCP `search_catalog` on `https://catalog.shopify.com/api/ucp/mcp` | Dev Dashboard client credentials. The published token example scope is `read_global_api_catalog_search`. |
| Checkout pricing | `create_checkout`, `get_checkout`, `update_checkout` at `https://{shop-domain}/api/ucp/mcp` | Same token or a signed request. The shop origin must already be in `SHOPIFY_CHECKOUT_ALLOWED_ORIGINS`. |
| Checkout completion | `complete_checkout` | Token tier, and a token Shopify has granted permission to complete purchases. Body includes `checkout.payment.instruments` (`type: card`, a handler such as Google Pay). Requires `meta["idempotency-key"]`. |
| Payment-instrument submission | Inside `complete_checkout` | A credential collected in a trusted UI. The published instrument is a card handler. It is not a Solana transaction. |
| Order read | `get_order` | Token tier, scope `read_global_api_orders`, and an agent profile that declares `dev.ucp.shopping.order`. The example profile that declares it is `https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json`. |
| Later status | Order webhooks, or another `get_order` | Webhook endpoint configured by Shopify. `get_order` is the on-demand read, not a polling loop. |

Signed and anonymous agents can build a checkout. They cannot call `complete_checkout` or `get_order`.

SuperTab’s configured profile remains `https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json`. This pass did not switch it, because that profile is what checkout pricing already sends.

## 3. Arbitrary retailers or cooperating merchants

Checkout and order tools are Shopify platform tools, not a private app installed on one store. Shopify says the order capability is advertised on every shop’s `/.well-known/ucp` at UCP `2026-04-08` or later. There is no per-shop flag to turn it on.

That still does not cover an arbitrary retailer:

- The order id must come from `complete_checkout` on a checkout this agent created. Storefront orders, other apps, and buyer order history return `order_not_found`.
- `complete_checkout` is a separate grant. Catalog search does not include it.
- A shopper who pays on `continue_url` does not produce an order this agent can read back.
- The payment object is a card instrument. A Solana transfer is not an input to this API.
- eBay remains a different Order API. Search credentials do not grant it.

## 4. Binding an order to the approval

`src/lib/merchant-order.ts` applies the documented document shape. It does not call Shopify.

- A checkout is useful only when `status` is `completed` and `order.id` matches `gid://shopify/Order/{digits}`. `complete_in_progress` stays pending.
- `get_order` must return that same order id and the same `checkout_id`.
- The single line’s `item.id` and `quantity.original` must match the approved variant and quantity. `quantity.original` is the quantity placed at checkout; later edits change `quantity.total` and do not rewrite history.
- With no adjustments, the order `total` must equal the approved minor amount and the currency must match.
- Buyer, destination, payment instrument, and `permalink_url` are not kept. The permalink can be an authenticate link.

A card event never reaches this binder as an order. `bindRetrievedOrder` rejects an issuing transaction.

## 5. Recovery without buying again

| What was lost | What to do | What not to do |
| --- | --- | --- |
| `complete_checkout` response, checkout now `complete_in_progress` | Call `get_checkout` again. | Do not call `complete_checkout` again. |
| Checkout `completed` | Call `get_order` with `order.id`. | Do not treat the checkout payload as the order record. |
| `get_order` returns `order_not_found` immediately after a known completion | Wait and read `get_order` again. Shopify documents this as propagation, despite the code’s usual “do not retry” label. | Do not start a new checkout or a new payment. |
| `order_not_found` with no completion in progress | Stop. The order is not this agent’s. | Do not pay again to make it appear. |
| HTTP or JSON-RPC transport error, including timeout | Outcome stays unknown. | Do not mark success or decline. |
| A retry is still required while status is `ready_for_complete` | Reuse the stored UUID. | A new idempotency key is a second payment. This build does not send that retry. |

`acceptOrderEvidence` keeps the first order id. The same id is a no-op. A different id is refused.

A refund is an order `adjustments` entry with a stable Shopify id and a negative total. It is stored beside the order. It does not erase the order and it is not a card-rail refund.

## 6. What can be tested now

Fixture-tested in `tests/merchant-order.test.ts`: completed checkout id extraction, in-progress recovery, handoff, card-event rejection, idempotency-key reuse, order binding, amount and variant rejection, duplicate adjustment, and `orders_not_allowed`.

Not tested live, and not called:

- `complete_checkout`
- `get_order` with a real order
- any payment instrument
- any new destination

The last live order probe, recorded in `docs/CLOSED_ROUTES.md`, was `get_order` for `gid://shopify/Order/0`. It returned `orders_not_allowed` because `read_global_api_orders` was missing. `tools/list` included `get_order` and `complete_checkout`. The completion schema named card funding, not Solana.

## 7. Sources

Fetched October 8, 2026:

- https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp
- https://shopify.dev/docs/agents/get-started/checkout
- https://shopify.dev/docs/agents/orders
- https://shopify.dev/docs/agents/orders/order-mcp
- https://shopify.dev/docs/agents/get-started/monitor-orders
- https://shopify.dev/docs/agents/profiles/auth-and-rate-limiting

## Two product scopes

**Agent-completed checkout.** Shopify documents this. It needs purchase-completion permission, a card instrument, `read_global_api_orders`, and a profile that declares the order capability. The order can then be read with `get_order`. SuperTab does not have that grant, and the instrument is not Solana.

**Shopper-completed checkout.** The buyer uses `continue_url`. SuperTab can keep the selected product and the priced total, but Order MCP will not return that order. Browser automation is not a substitute for `get_order`. There is no supported independent verification on this path.

## Smallest code added

`readCheckoutForOrder`, `classifyOrderToolResult`, `bindRetrievedOrder`, `acceptOrderEvidence`, and `assertCompletionRetry` in `src/lib/merchant-order.ts`. The shopping view still reports `ORDER_NOT_CREATED`. Nothing in the request path calls these functions, because a fixture must not become a live order.

## Fully agentic retail purchase

Not achievable through this integration. Solana funding never enters `complete_checkout`. Even the card path is blocked until Shopify grants completion and `read_global_api_orders`. A shopper-finished retailer checkout cannot be read back.

## Next concrete step

Ask Shopify, from the Dev Dashboard admin, to grant this existing Catalog client `read_global_api_orders` and permission to call `complete_checkout`. Do not create a second app. After that grant, the first call is still read-only: `get_order` for an order id this agent did not place must return `order_not_found` rather than `orders_not_allowed`. Do not call `complete_checkout` until the owner supplies a payment instrument and explicitly authorizes one purchase.
