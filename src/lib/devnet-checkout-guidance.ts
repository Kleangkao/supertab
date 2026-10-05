/** October 5, 2026 Phantom devnet order. Read its status from the merchant; do not assume it here. */
export const VERIFIED_DEVNET_ORDER_ID = "e485b032-7abd-4a59-849c-f37775ec57c6";

/** Owner decision: these stay paid. The shopper flow must not ask to refund them. */
export const PRESERVED_PAID_DEVNET_ORDER_IDS = [
  "ab0421c2-e708-40cd-b30c-a1e2a433b512",
  "3518beef-1b53-4e5c-8682-0baca6b1c3fa",
] as const;

const preservedPaidOrders = new Set<string>(PRESERVED_PAID_DEVNET_ORDER_IDS);

export function isPreservedPaidOrder(orderId: string): boolean {
  return preservedPaidOrders.has(orderId);
}

export interface CheckoutGuidanceInput {
  checkoutId: string | null;
  signed: boolean;
  broadcastSignature: string | null;
  orderCheckoutId: string | null;
  orderStatus: "paid" | "refunded" | null;
  expired: boolean;
  blocked: boolean;
}

export interface CheckoutGuidance {
  signDisabled: boolean;
  sendDisabled: boolean;
  paymentNote: string | null;
  freshReview: boolean;
  recoverExisting: boolean;
}

export function devnetCheckoutGuidance(input: CheckoutGuidanceInput): CheckoutGuidance {
  const matchingOrder = !!input.checkoutId && input.orderCheckoutId === input.checkoutId && !!input.orderStatus;
  const submitted = !!input.broadcastSignature;
  const freshReview = input.expired && !submitted && !matchingOrder;
  const recoverExisting = submitted && !matchingOrder;

  let paymentNote: string | null = null;
  if (matchingOrder && input.orderStatus === "refunded") {
    paymentNote = "The merchant confirmed this payment and the refund. Neither is still only on this device. Signing and sending stay off for this checkout.";
  } else if (matchingOrder) {
    paymentNote = "The merchant confirmed this payment. It is no longer only on this device. Signing and sending stay off for this checkout.";
  } else if (submitted && input.expired) {
    paymentNote = "This checkout expired after a signature was submitted. Ask the merchant about that signature. A new checkout will not recover this payment.";
  } else if (submitted) {
    paymentNote = "This signature was submitted on devnet. The merchant has not confirmed an order for this checkout yet. Ask the merchant about this signature. Do not start a new checkout to recover it.";
  } else if (input.expired) {
    paymentNote = "This checkout expired. No payment was sent. Review a fresh checkout, then approve and sign again.";
  } else if (input.signed) {
    paymentNote = "The wallet signed this payment. It is still on this device and has not been sent.";
  }

  return {
    signDisabled: input.blocked || matchingOrder || submitted,
    sendDisabled: input.blocked || matchingOrder || !input.signed,
    paymentNote,
    freshReview,
    recoverExisting,
  };
}
