# Merchant checkout access — October 3, 2026

The catalog amount is a planning input. It does not prove the final shipping, tax, discounts or payable total.

## Shopify

Official Checkout MCP documentation requires authentication or signed requests. Catalog client credentials come from the Shopify Dev Dashboard; tokens remain server-side. Checkout tools operate at the merchant UCP endpoint. `create_checkout` prepares a session; `get_checkout` retrieves its current state. `complete_checkout` submits payment and places an order and is prohibited in this build.

Source: https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp

Cart MCP estimates are not final checkout evidence. Checkout responses are bound to the merchant, variant, quantity, currency and fulfillment selections. An incomplete or escalated session is not an approvable final total. A reconciled fulfillment and tax breakdown can drive the funding plan and is labeled as still able to change. Expiry and changes invalidate prior approvals and funding quotes. Neither the model nor client-supplied JSON can be the authority for a verified total.

Source: https://shopify.dev/docs/agents/carts-and-checkout/cart-mcp

## eBay

Browse API access is separate from Order API checkout access. Guest and member checkout methods have restrictions, including sandbox access. Production access requires application approval. Existing search credentials alone do not prove checkout permission.

Source: https://developer.ebay.com/api-docs/buy/buy-requirements.html

## What can be known before payment

Shopify's Checkout MCP is the merchant calculation path available to this Catalog credential. `create_checkout` starts a pricing session. `complete_checkout` submits payment and is not called. Official docs describe `buyer` as required, but a live True Classic call on October 3, 2026 with only a variant and quantity was accepted, then canceled.

That live response was `requires_escalation`. Its totals were `subtotal` and `total` only. Message codes were `buyer_identity_contact_method_required`, `extension_interaction_required`, `delivery_address_required`, and `delivery_no_delivery_available`. SuperTab does not treat that subtotal as a payable amount. Shipping and tax were not calculated because no destination was sent. No buyer data was invented. The created session was canceled in the same probe; its capability id was not stored.

A destination the buyer actually enters can be sent with `create_checkout`. If the merchant then returns a reconciled USD total that includes both `fulfillment` and `tax`, SuperTab uses it as a merchant-calculated funding amount. Automatic discounts and a submitted discount code are reflected only when they appear in the merchant totals or `discounts.applied`. A code that does not appear as applied does not change the amount. A `provisional: true` discount cannot be approved.

Certainty stops there:

| Merchant result | Funding amount | Purchase approval |
| --- | --- | --- |
| Catalog or listing price | Planning only | No |
| Subtotal without fulfillment and tax | Not accepted | No |
| Reconciled total with fulfillment and tax, status not `ready_for_complete` | Merchant-calculated; can still change | No |
| `ready_for_complete`, no blocking message, no provisional discount | Current final total, expires within five minutes | Yes, for that amount only |

`extension_interaction_required` means some checkouts still need the buyer on the merchant page, including Shop Pay or a checkout extension. The API total is then not final. WebMCP can read and update the checkout inside the buyer's browser on that page, and it does not need a separate merchant app, but SuperTab cannot call another origin's WebMCP from its own page. The cart link remains the handoff. eBay Order API checkout is still a separate, restricted permission.

## Bangkok destination, October 3, 2026

An owner-supplied Bangkok destination was used only to price True Classic’s Black Classic Polo, quantity one. No name, email, or phone was invented. No payment was submitted and no order was placed.

The Checkout MCP response was `requires_escalation` in THB. It stated subtotal 1,750.00, shipping 506.53, tax 222.82, duty 704.31, and total 3,274.84. Those components sum to 3,183.66, short of the stated total by 91.18. The only delivery option was Express Courier (Air), already selected. No discount was applied. The session was canceled after the read. SuperTab does not use that unreconciled API breakdown as a funding amount.

The merchant checkout page, with the same destination and Pay now selected, showed a breakdown that does add up: subtotal 1,750.00, shipping 506.53, duties 795.49, taxes 222.82, total 3,274.84 THB. The page duty is 91.18 above the API duty, which is the whole API gap. Pay on delivery showed total 2,256.53, equal to the subtotal plus shipping, and labeled duties and taxes as possibly charged on delivery.

After the authorized name, email, and phone were entered on that same page, Pay now still showed 3,274.84 THB and the lines still added up. A separate `create_checkout` with the same buyer and destination no longer asked for contact or a delivery name. Its only remaining message was `extension_interaction_required`. Its stated total was still 3,274.84 THB, and its duty line was still 704.31, so the API components still do not add up. That API session was canceled. No payment was submitted. The checkout is not ready for completion, and the THB amount is not a USD funding amount.

## Browser-backed evidence

Browser verification opened the provider-returned True Classic cart link for Black Classic Polo, size S, quantity one. The merchant checkout showed the same $39.99 item price and requested an address before shipping methods could be determined. Its exposed read-only WebMCP `get_checkout` returned status `incomplete`, canonical variant `gid://shopify/ProductVariant/39301338103880`, subtotal/total 3999 USD cents, tax 0, and no fulfillment destinations or groups. Validation messages required contact and delivery details. The displayed total therefore remains provisional; zero tax at this stage is not final tax evidence.

This browser transport is distinct from the authenticated server MCP endpoint. It provides a legitimate read-only investigation path without API onboarding, but is not integrated into SuperTab's application. A future integration needs an authorized browser transport, buyer-controlled fulfillment entry, sanitized evidence binding, and freshness handling. Do not copy raw checkout responses: session IDs/continuation URLs may contain capability keys, and responses can include buyer or payment information. No buyer data was entered and neither update nor completion was called in this verification.
