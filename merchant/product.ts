/** Circle's published Solana devnet USDC mint. It has no dollar backing. */
export const CIRCLE_SOLANA_DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const DEVNET_USDC_DECIMALS = 6;
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

export const TEST_PRODUCT = {
  id: "devnet-test-marker",
  name: "Devnet test marker",
  label: "Owner-controlled devnet fixture. This is not a product from another retailer.",
  itemMinor: 500_000n,
  shippingMinor: 200_000n,
  taxMinor: 300_000n,
  quantity: 1,
} as const;

export const TEST_TOTAL_MINOR = TEST_PRODUCT.itemMinor + TEST_PRODUCT.shippingMinor + TEST_PRODUCT.taxMinor;
export const CHECKOUT_TTL_MS = 10 * 60_000;
export const LATE_PAYMENT_WINDOW_MS = 24 * 60 * 60_000;
