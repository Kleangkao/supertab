export const PAYMENT_STATES = [
  "PAYMENT_NOT_READY",
  "PAYMENT_READY",
  "PAYMENT_APPROVAL_REQUIRED",
  "PAYMENT_PENDING",
  "PAYMENT_AUTHORIZED",
  "PAYMENT_CAPTURED",
  "PAYMENT_FAILED",
  "PAYMENT_REVERSED",
  "REFUND_PENDING",
  "PAYMENT_REFUNDED",
] as const;

export type PaymentState = (typeof PAYMENT_STATES)[number];

export const ORDER_STATES = [
  "ORDER_NOT_CREATED",
  "ORDER_PENDING",
  "ORDER_CONFIRMED",
  "ORDER_EXCEPTION",
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

export function paymentStateFor(input: {
  hasOffer: boolean;
  finalTotalKnown: boolean;
  fundsReady: boolean;
  approved: boolean;
  expired: boolean;
  railReady: boolean;
}): PaymentState {
  if (!input.hasOffer || !input.finalTotalKnown) return "PAYMENT_NOT_READY";
  if (!input.approved || input.expired) return "PAYMENT_APPROVAL_REQUIRED";
  if (!input.railReady || !input.fundsReady) return "PAYMENT_NOT_READY";
  return "PAYMENT_READY";
}

export function capturedPaymentIsNotAnOrder(payment: PaymentState, order: OrderState): boolean {
  return payment === "PAYMENT_CAPTURED" && order !== "ORDER_CONFIRMED";
}
