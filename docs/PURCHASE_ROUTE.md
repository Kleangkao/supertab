# Purchase route decision — October 4, 2026

No route yet connects one purchase across a selected product, a payable amount, Solana wallet funding, accepted merchant payment, and an independent merchant order.

The current milestone is one merchant-backed Solana USDC purchase. No accessible merchant can prove it. The owner has to authorize an owner-controlled devnet store before any integration. The required setup is recorded under "Merchant milestone". Earlier route evidence stays below and was not rechecked.

## Decision

Amazon through Crossmint Headless Orders is the documented physical-goods route, and it is blocked before a quote. On October 4, 2026 the staging key was sent one `POST /api/2022-06-09/orders` with locator `amazon:B01DFKC2SO`, `payment.method` `solana`, currency `usdc`, a documented placeholder email, and a disposable payer. No shipping address was invented. The response was HTTP 500. The message showed Crossmint calling `https://na.business-api.amazon.com/products/2020-08-26/products/getProductsByAsins` and Amazon returning 403. No order id, quote, or transaction was returned. The call was not repeated.

That separates the requirements:

| Requirement | Result |
| --- | --- |
| Staging authentication | Verified earlier the same day by `orders.read` HTTP 200. |
| `orders.create` reaches Amazon | The 500 is Amazon's 403, not a Crossmint 401. |
| Solana USDC quote | Not returned. The create-order schema still lists method `solana` and currency `usdc`. |
| Physical-goods staging | The request reached Amazon product lookup and stopped there. |
| Buyer eligibility | The schema says shipping country `US` only. The authorized buyer destination is Thailand, so a real quote would still be ineligible without a US address. None was invented. |
| Merchant order evidence | Absent. A Crossmint order id, had one been returned, would still not be Amazon's own order id. |

The narrative page `https://docs.crossmint.com/payments/headless/guides/providers/amazon` now renders Agent Checkouts, which is production-only and card-funded. The API reference still documents the Amazon locator. Agent Checkouts was not called.

**Owner access decision.** Amazon purchasing stays blocked until Crossmint or Amazon Business enables product lookup for this staging project. The confirmation needed is that `getProductsByAsins` succeeds for the project, and that a staging quote can be funded with Solana USDC without a production order. A US shipping address is also required by the current schema. Shopify and Helio were not called again.

Crossmint Headless Orders is not a usable Shopify purchase route. Do not call `POST /orders` again for a `shopify:` locator unless Crossmint documents that locator again or answers the support request below.

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

The create-order reference still has a physical `productLocator`, and its description and example are Amazon only. The later Amazon section records the one staging create that reached Amazon and received HTTP 403. That call stays closed.

Agent Checkouts, which now occupies the old Shopify guide URL, runs in production only. Its payment methods are cards and merchant methods such as Shop Pay. It does not show Solana wallet funding. Source: https://docs.crossmint.com/payments/headless/guides/providers/shopify and https://docs.crossmint.com/llms.txt as fetched October 4, 2026.

## Next route: Solana Pay on Shopify

Checked October 4, 2026 against the current MoonPay Commerce Solana Pay plugin page. This is the buyer-controlled route: the shopper pays from a Solana wallet, settlement defaults to USDC, and MoonPay Commerce does not custody the funds. A paid charge becomes a Shopify order only after the plugin reports `Completed`. The merchant portal and Helio API expose that link as `ShopifyPaymentGid`. Refunds are a separate merchant-approved wallet transaction.

That route is externally blocked before a quote:

- True Classic's previously checked checkout did not list Solana Pay. Activating it is a merchant action: install the app, accept its terms, complete KYB, and set a payout wallet.
- No Helio or MoonPay API key is configured. On October 4, `GET https://api.dev.hel.io/v1/currency` returned HTTP 200 without a key and included USDC on SOL. `GET https://api.dev.hel.io/v1/paylink` returned HTTP 401 `Unauthorized`. The public currency list is not payment access. `demo.hel.io` only embeds a paylink the merchant creates. The dev dashboard can make a Devnet paylink, and that still requires the owner's login.
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

## Later candidates, October 4, 2026

Shopify, Amazon, and Helio were not called again. Three new candidates were checked against current official pages and unauthenticated reads. No invoice, checkout, or account was created.

### 1. Bitrefill — gift cards, not the selected product

Official docs: https://docs.bitrefill.com/docs/crypto-payments, https://docs.bitrefill.com/docs/api-overview, https://docs.bitrefill.com/docs/test-products, https://docs.bitrefill.com/docs/refunds, and https://www.bitrefill.com/terms.

| Question | Evidence |
| --- | --- |
| Access | Personal API is a Bitrefill account plus a Bearer key from Account > Developers. Business test products require a partner application. `GET https://api.bitrefill.com/v2/ping` with no key returned HTTP 401, `Authorization token not found`. |
| Funding | `payment_method` `usdc_solana` is documented. The shopper sends the invoice's exact amount to `payment.address`. |
| Products | Gift cards, eSIMs, and phone top-ups. An Amazon gift card is not an Amazon order. |
| Test environment | Documented test product ids are free and work with `payment_method=balance`. The feature table reserves test products for Business and Affiliate keys. They do not exercise Solana. |
| Order evidence | `GET /orders/{id}` returns Bitrefill redemption info: a code, link, or PIN. That is not the retailer's order id. |
| Refunds | Failed delivery, stock failure, or cancellation returns other crypto to `refund_address`, typically in 10 minutes to 1 hour. Lightning cannot be refunded. The terms add a 30-day window, a processing fee on exceptional crypto refunds, no cooling-off after a code is revealed, and no refund when a buyer circumvents a country block. After 30 days a refund, if granted, is Bitrefill credit. |

Gift-card limits, stated so this is not treated as the product purchase: the buyer must redeem the code at the retailer; the catalog is country-specific; an unused remainder stays on the gift card; a failed Bitrefill delivery can return USDC, while a redeemed card follows the retailer's rules.

Smallest missing requirement: the owner creates a Bitrefill account, accepts its terms, and supplies a Personal API key. The first check is `GET /ping` and a country-filtered product read. A `usdc_solana` invoice spends real funds and was not created.

### 2. VoltVault — a store that asks for a direct Solana transfer

Public pages fetched October 4: https://shopvoltvault.com/pay-with-solana, https://shopvoltvault.com/checkout, and https://shopvoltvault.com/how-to-pay. Both checkout and the payment guide returned HTTP 200. No shipping form was submitted.

The checkout says to enter a delivery address, save a local order reference, send the exact total to a wallet shown on the page, then click place order. The guide describes shared deposit addresses, not a Solana Pay `solana:https://...` transaction request. Duties and tax are excluded. The refund offered on the page is 30 days, in the coin paid, with return postage paid by the buyer. There is no test environment and no API that returns a merchant order id.

This is one reseller's catalog, not general merchant coverage. It is not an executable test. The requirement that would unlock a direct Solana product purchase is a merchant URL that returns a transaction for one cart, then a merchant order id after payment. A shared address plus an email reference does not.

### 3. Coinbase Business Checkouts — rejected on mechanism

Official pages: https://docs.cdp.coinbase.com/coinbase-business/checkout-apis/overview, https://docs.cdp.coinbase.com/coinbase-business/checkout-apis/sandbox, and the Checkouts FAQ. The FAQ says the API supports USDC on Base, with more networks later. The create-checkout schema's network enum is `base`. Sandbox payments use USDC on Base Sepolia. `GET https://business.coinbase.com/sandbox/api/v1/checkouts` with no credentials returned HTTP 401.

A Coinbase Business account and CDP key would let that business receive USDC. It would not spend the shopper's Solana wallet at a third-party merchant. Refunds are a merchant-initiated checkout refund. This route stays closed even if the owner later opens a Coinbase Business account.

## Ranked access decision

1. Bitrefill is the only new route whose docs connect shopper Solana USDC to a purchased item. The owner must create the account and API key. The purchase would be a gift card or top-up, with the redemption and refund limits above.
2. A normal product still needs a merchant that exposes a unique Solana Pay request and a confirmable order. VoltVault does not. Helio was not called again.
3. Coinbase Business Checkouts does not become that route with more access.

## Merchant milestone

Checked October 4, 2026. No new provider account, Helio call, Shopify install, or payment was made.

### What we can already access

True Classic is reachable for catalog search and checkout pricing. The configured Shopify values are Catalog client credentials from the Dev Dashboard. Shopify's Checkout MCP documents those credentials as a client-credentials token for catalog and checkout tools. The published token example scope is `read_global_api_catalog_search`. Order reads are a separate scope, `read_global_api_orders`, and only for orders placed through that agent. Shopify's credential guide says client credentials exchange a token directly only for an app acting on stores in its own organization. They do not make SuperTab the owner of True Classic, do not grant that store's Admin API, and do not permit installing a payment app.

True Classic's previously inspected checkout did not offer Solana Pay. Its public discovery document `https://www.trueclassictees.com/.well-known/ucp` lists only Google Pay cards, Shopify card, and Shop Pay. No other merchant we can access returns a purchase-specific Solana USDC request and then an order id from the merchant's own system. VoltVault shows a shared deposit address. Bitrefill returns a redemption code. Coinbase Business Checkouts settle on Base. Those findings stay closed.

### Recommended setup

An owner-controlled test merchant that implements the Solana Pay transaction-request specification on Solana devnet. Official references: https://solana.com/docs/tools/solana-pay/specification/version1 and https://docs.solanapay.com/core/transfer-request/merchant-integration.

It satisfies the milestone because the pieces stay separate:

| Step | Who produces it |
| --- | --- |
| Product | The test merchant lists one SKU. |
| Complete payable total | The merchant calculates item, shipping, and tax before payment. SuperTab does not invent that total. |
| Purchase-specific payment request | The merchant returns one Solana Pay transaction containing a unique reference for that checkout. |
| User approval | The owner signs that transaction from a devnet wallet. |
| Confirmed payment | The merchant accepts it only after the on-chain transfer matches the recipient, amount, devnet USDC mint, and reference. |
| Merchant order | The merchant creates the order after that validation. SuperTab reads the order from the merchant. SuperTab does not write it. |

A Shopify development store with the MoonPay Commerce Solana Pay plugin is the closer shape to another retailer's order, and it is not the minimum. Shopify says a dev store cannot process real transactions; test orders use Bogus Gateway or a provider in test mode, and a dev store cannot be transferred to a merchant. MoonPay's plugin page requires installing the app, accepting its terms, completing KYB, setting a unique Solana payout wallet, and activating it. Its devnet page covers payment links and the dashboard at `moonpay.dev.hel.io`, not a Shopify test order. A paylink without the plugin does not create a Shopify order. That path needs the owner to become a MoonPay merchant and was not started.

### What the controlled test proves

It proves the six-step chain on a store the owner controls, using devnet USDC. It does not prove that True Classic, Amazon, or any other retailer will accept Solana USDC or create an order. Access to an unrelated retailer still requires that merchant to enable Solana Pay and to grant a credential that can read the merchant's order. For the documented Shopify plugin, that credential is the merchant's Helio API read of `ShopifyPaymentGid`, followed by the Shopify order itself.

### Owner action

Merchant participation is required. No existing store we can access can supply it. The owner must explicitly authorize the test merchant before implementation. That authorization is a devnet store the owner controls: one product, one payout wallet, and devnet USDC. It is not permission to install MoonPay, accept MoonPay or Shopify terms, contact True Classic, or spend mainnet funds.

### Implementation and verification after that authorization

1. The merchant exposes one product whose price already includes shipping and tax.
2. A checkout request returns a Solana Pay transaction request and a checkout id. The reference is unique to that checkout.
3. The owner approves or rejects it in a devnet wallet.
4. The merchant validates the confirmed transfer, then creates the order.
5. SuperTab calls the merchant's order read and records the order id, amount, mint, and transaction signature.
6. Verification is red when any check fails: rejected signature, wrong amount, wrong mint, missing or reused reference, or a confirmed transfer with no merchant order. It is green only when the order read succeeds after validation.

### Failure and refund cases

- The wallet prompt is dismissed. No transaction and no order.
- The transfer amount, recipient, mint, or reference does not match the checkout. The merchant does not create an order.
- The checkout expires before approval. A matching transfer in the next 24 hours is marked late. After that window the payment is stored and does not create an order.
- The chain shows the transfer, but the merchant order read does not. That is payment without an order and fails the milestone.
- A full refund is a second devnet USDC transfer from the merchant wallet back to the buyer for the same amount. The order read then says refunded and includes the refund signature. A wallet payment alone does not mark the refund.

## Engineering milestone status

Updated October 4, 2026. The local owner-controlled merchant is implemented and covered by `tests/devnet-merchant.test.ts` (7 tests). It sells one labeled devnet marker for 1.000000 Circle devnet USDC: item 0.500000, shipping 0.200000, and tax 0.300000. SuperTab can request the checkout and read the order. It does not write the order.

A devnet `getAccountInfo` for `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` returned the token program as owner, 82 bytes, and decimals 6. The owner then funded the generated payer. One devnet run paid 1.000000 Circle devnet USDC and refunded it. Payment `3kQNnZbAXi4CTuXkatAQoRG3ayp6mVjgpwRViAMEKTXDoabra5YnFyT7Wpbc3GCbxnktggiyT8MWY4N6htZivrM9` at slot 507317970 moved 1000000 minor units to the merchant. The merchant created order `6359fb8a-17c0-4243-813b-6c92ed9df309`. Refund `62Nwju2eZ8kRThBK7qJtq2ZfzKjpko9aonyUVQ9gFkJtioeXH7mG2jyij58b6Gpj4zbjv2LmARXk3JSMAXy52EuC` at slot 507317976 returned the same amount, and the order was marked refunded. SuperTab later read that payment from the merchant without another transfer. The read returned order `d0f4cec6-8265-4058-bc86-23f4b2f1dfeb`, marked late, and then refunded. This proves the owner-controlled merchant only. See `docs/PROJECT_STATE.md`.

## Not implemented

No Crossmint, Bitrefill, Coinbase, or VoltVault client was added. No retailer order exists. Another devnet purchase is not the next step.
