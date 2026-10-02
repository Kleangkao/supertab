/** Explicit demo fixtures, never evidence of a merchant's payable total. */
export function simulatedCheckout(itemMinor: bigint, quantity: number) {
  if (itemMinor <= 0n || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    throw new Error("Choose a positive item price and a whole quantity for the simulation.");
  }
  const lineMinor = itemMinor * BigInt(quantity);
  const shippingMinor = 500n;
  const taxMinor = 300n;
  return { mode: "local_simulation" as const, currency: "USD" as const,
    merchantTotalVerified: false as const, itemMinor, quantity, lineMinor, shippingMinor, taxMinor,
    totalMinor: lineMinor + shippingMinor + taxMinor };
}
