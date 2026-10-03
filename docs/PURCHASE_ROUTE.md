# Purchase route decision — October 4, 2026

No route yet connects one purchase across a selected product, a payable amount, Solana wallet funding, accepted merchant payment, and an independent merchant order.

## Decision

Crossmint Headless Orders is not a usable Shopify purchase route. Do not call `POST /orders` again for a `shopify:` locator unless Crossmint documents that locator again or answers the support request below. Agent Checkouts is a different product and does not fund the purchase from the shopper's Solana wallet.

## Hypothesis tested

The October 3 HTTP 500, `Orders from Shopify are temporarily unavailable`, is a temporary outage, a staging limitation, a True Classic incompatibility, or a malformed request.

| Explanation | Result | Evidence |
| --- | --- | --- |
| Staging limitation | Contradicted | October 4 `GET /api/2022-06-09/orders?page=1&perPage=1` with the same staging server key returned HTTP 200 and an empty list. The key can read orders. |
| Malformed request | Contradicted for this 500 | The server returned a Shopify-specific HTTP 500, not a validation error. The current item-selection guide shows collection and token locators, not a `shopify:` locator. |
| This merchant only | Uncertain, and not worth another create | The error names Shopify orders, not True Classic. The current create-order schema documents an Amazon product locator and does not mention Shopify. |
| Temporary outage | Not corroborated | The error text says temporary. No status incident was found. The docs index fetched on October 4 has no Shopify page. The old Shopify guide URL now renders Agent Checkouts. |

`POST /orders` was not repeated.

## What the current docs support

Headless Checkout still exists for tokenized assets. Its item-selection guide uses `collectionLocator` and `tokenLocator`. Solana appears there as a payment method for a Solana token purchase, which is not a normal merchant order.

The create-order reference still has a physical `productLocator`, and its description and example are Amazon only. A previous Amazon locator on this key was access-denied. That call was not repeated.

Agent Checkouts, which now occupies the old Shopify guide URL, runs in production only. Its payment methods are cards and merchant methods such as Shop Pay. It does not show Solana wallet funding. Source: https://docs.crossmint.com/payments/headless/guides/providers/shopify and https://docs.crossmint.com/llms.txt as fetched October 4, 2026.

## Next route: Solana Pay on Shopify

Checked October 4, 2026 against the current MoonPay Commerce Solana Pay plugin page. This is the buyer-controlled route: the shopper pays from a Solana wallet, settlement defaults to USDC, and MoonPay Commerce does not custody the funds. A paid charge becomes a Shopify order only after the plugin reports `Completed`. The merchant portal and Helio API expose that link as `ShopifyPaymentGid`. Refunds are a separate merchant-approved wallet transaction.

That route is externally blocked before a quote:

- True Classic's previously checked checkout did not list Solana Pay. Activating it is a merchant action: install the app, accept its terms, complete KYB, and set a payout wallet.
- No Helio or MoonPay API key is configured. `demo.hel.io` only embeds a paylink the merchant creates. The dev dashboard can make a Devnet paylink, and that still requires the owner's login.
- Without that merchant key, SuperTab cannot independently read the Shopify order after a wallet payment.

Missing access, in order: a store that has Solana Pay enabled, then a Helio API credential for that store that can read `ShopifyPaymentGid`. Do not install the app, accept its terms, or complete KYB from here.

## Other routes still blocked

| Route | Status |
| --- | --- |
| Solana Pay handoff | Blocked on merchant activation and a Helio read credential, as above. |
| Issuer card | Immersve published sandbox keys returned `API_KEY_DISABLED`. Bridge has no sandbox key. A card sandbox would still not be this merchant order. |
| x402 | No True Classic x402 payment request exists. |

## Unsent support request

Do not send this unless the owner approves. Do not attach the API key or a wallet address.

> I am an individual developer. On October 4, 2026, `GET https://staging.crossmint.com/api/2022-06-09/orders?page=1&perPage=1` with a staging server key returned HTTP 200 and an empty list. An earlier `POST` to that orders path with `payment.method` `solana`, currency `usdc`, and a `shopify:` product locator returned HTTP 500, `Orders from Shopify are temporarily unavailable`. No order id remained. The current docs index does not list Shopify, and the create-order `productLocator` example is Amazon. Is Shopify headless ordering temporarily down, or is that locator retired? If it is retired, which API can pay a normal Shopify product from the shopper's own Solana USDC and return the merchant's order id?

## Not implemented

No Crossmint client was added. A quote, a signed transaction, a merchant payment, and a merchant order are all absent.
