# Purchase route decision — October 3, 2026

No accessible route yet connects one purchase across a selected product, a merchant payable amount, Solana wallet funding, accepted merchant payment, and an independent merchant order. This is a route decision, not an end-to-end purchase.

Credentials were found outside this repository, in the AgentTab environment. They were not copied here. Existing SuperTab checkout and wallet edits were left uncommitted.

## Decision

Prepare for Crossmint Headless Orders, and do not call it until Shopify quoting works. It is the only checked route that both authenticates today and is documented to pay a Shopify product from SOL or Solana USDC. The live create is blocked before a quote, so there is nothing to sign and no merchant order to confirm.

## What was called

| Call | Result |
| --- | --- |
| `GET https://staging.crossmint.com/api/2022-06-09/orders?page=1&perPage=1` with the AgentTab staging server key | HTTP 200, empty order list. `orders.read` works. |
| `POST https://staging.crossmint.com/api/2022-06-09/orders` | HTTP 500, `Orders from Shopify are temporarily unavailable`. |
| Same list after the failed create | HTTP 200, still empty. No order id was retained. |

The create used a placeholder recipient, `payment.method` `solana`, currency `usdc`, a disposable payer address, and a True Classic Shopify locator. It was not signed, not broadcast, and not repeated after the error text was read. The staging key was not sent to production.

## Routes compared

| Route | Access today | Funding | Merchant payment | Order evidence | Why it is not the purchase |
| --- | --- | --- | --- | --- | --- |
| Crossmint Headless Orders | Staging key authenticates. Shopify create returns 500. | Documented SOL or Solana USDC, payer signs the returned transaction. US address required for a real quote. | One provider order is supposed to pay the Shopify locator. Not observed. | Merchant order id would have to be in the provider response. None was returned. | Blocked before a quote. |
| Crossmint Agent Checkouts | Staging read on September 30 returned 403, production only. Not called again. | Published payment method is `card`, backed by a saved card. Not the shopper's Solana wallet. | Would be a separate card checkout, not proof that USDC paid the merchant. | A receipt may omit the merchant order id. | Rejected. It does not show Solana funding. |
| Buyer handoff to Solana Pay | No merchant credential. | Wallet approves on the merchant page. | Only if that checkout lists Solana Pay. True Classic's checked handlers were card and Google Pay, not Solana. | Merchant payments page, which this app cannot read. | Unverified handoff. Opening checkout does not pay. |
| Issuer card, then merchant checkout | Immersve published sandbox keys returned `API_KEY_DISABLED`. Bridge sandbox key is empty. | A programmable issuer would have to spend Solana USDC. A consumer card is not that API. | A merchant sandbox was not shown to accept that issuer's test card. | Card capture is not a merchant order. | No working issuer access. Two sandboxes would still not be one purchase. |
| x402 | Protocol code exists in AgentTab. No True Classic x402 endpoint was found. | Solana payment to a resource that asks for it. | Does not pay an ordinary Shopify checkout. | Settlement id is not a Shopify order. | Wrong merchant surface. |

## Smallest integration, after the 500 clears

Keep the call server-side. Do not store the API key, the payer address, or `clientSecret`. Require the connected wallet to be the payer. Use USDC on Solana. Bind the quote to the same product, variant, quantity, and merchant total, and refuse it when the total is not a reconciled USD amount or is no longer current. Show the unsigned transaction and the maximum spend. Approval of that transaction is separate from the wallet-control message. Do not broadcast from SuperTab. Do not retry a create whose result is unknown. Payment status, capture, and merchant order stay separate: `ORDER_CONFIRMED` requires the provider response to name the merchant order id. A refund reported by the provider is not the same event as a new payment.

Until `POST /orders` returns that quote instead of the Shopify unavailable error, SuperTab must not add a live Crossmint call.
