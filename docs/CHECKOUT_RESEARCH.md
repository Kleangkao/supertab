# Merchant checkout access — October 2, 2026

The catalog amount is a planning input. It does not prove the final shipping, tax, discounts or payable total.

## Shopify

Official Checkout MCP documentation requires authentication or signed requests. Catalog client credentials come from the Shopify Dev Dashboard; tokens remain server-side. Checkout tools operate at the merchant UCP endpoint. `create_checkout` prepares a session; `get_checkout` retrieves its current state. `complete_checkout` submits payment and places an order and is prohibited in this build.

Source: https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp

Cart MCP estimates are not final checkout evidence. Any future checkout adapter must bind the response to the merchant, variant, quantity, currency and fulfillment selections. An incomplete or escalated session must not automatically become payable. Expiry and changes must invalidate prior approvals and funding quotes. Neither the model nor client-supplied JSON can be the authority for a verified total.

Source: https://shopify.dev/docs/agents/carts-and-checkout/cart-mcp

## eBay

Browse API access is separate from Order API checkout access. Guest and member checkout methods have restrictions, including sandbox access. Production access requires application approval. Existing search credentials alone do not prove checkout permission.

Source: https://developer.ebay.com/api-docs/buy/buy-requirements.html

## Current honest path

The purchase review now exposes the provider's HTTPS cart link when available, otherwise its product link. The buyer can inspect shipping and price directly at the merchant. SuperTab continues to show final total unknown; opening the link neither approves a purchase nor creates evidence. No paid purchase, account creation, buyer contact details or address submission occurs automatically.

Authenticated checkout access and buyer-selected fulfillment details remain required before a verified final total can drive purchase approval. No checkout API credential has been invented, and no catalog or cart amount has been relabeled as a final total.

## Browser-backed evidence

Browser verification opened the provider-returned True Classic cart link for Black Classic Polo, size S, quantity one. The merchant checkout showed the same $39.99 item price and requested an address before shipping methods could be determined. Its exposed read-only WebMCP `get_checkout` returned status `incomplete`, canonical variant `gid://shopify/ProductVariant/39301338103880`, subtotal/total 3999 USD cents, tax 0, and no fulfillment destinations or groups. Validation messages required contact and delivery details. The displayed total therefore remains provisional; zero tax at this stage is not final tax evidence.

This browser transport is distinct from the authenticated server MCP endpoint. It provides a legitimate read-only investigation path without API onboarding, but is not integrated into SuperTab's application. A future integration needs an authorized browser transport, buyer-controlled fulfillment entry, sanitized evidence binding, and freshness handling. Do not copy raw checkout responses: session IDs/continuation URLs may contain capability keys, and responses can include buyer or payment information. No buyer data was entered and neither update nor completion was called in this verification.
