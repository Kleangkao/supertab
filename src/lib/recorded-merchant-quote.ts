/**
 * Recorded Solana Spaces quote from October 5, 2026.
 * This is evidence of what the merchant displayed. It is not a live total,
 * and it must not unlock approval, funding, signing, or payment.
 * Destination contact details are intentionally absent.
 */
export const recordedTeeQuote = {
  path: "real-product-quote-only",
  merchant: "Solana Spaces",
  title: "Just Build It Tee",
  variant: "Medium",
  quantity: 1,
  checkedOn: "October 5, 2026",
  destinationScope: "Authorized Thailand destination",
  item: "$35.00",
  shippingName: "GlobalPost Economy",
  shipping: "$20.53",
  displayedTax: "$0.00",
  merchantTotal: "$55.53",
  visibleUsdcOption: "$55.53",
  estimatedDelivery: "October 19",
  duties: "Unverified",
  networkFees: "Unverified",
  payment: "unavailable",
  orderPlaced: false,
  freshQuoteUrl: "https://solanaspaces.com/checkout",
} as const;

/** $55.53 in 6-decimal USDC base units. Comparison evidence only, not a payable total. */
export const RECORDED_TEE_MERCHANT_TOTAL_USDC_BASE = 55_530_000n;

export function recordedQuoteCanStartPayment(): false {
  return false;
}
