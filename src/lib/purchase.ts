import type { MerchantOrderEvidence, PaymentEvidence } from "./order-evidence";
import { hasMerchantOrder } from "./order-evidence";
import { FinancialExecutionDisabled } from "./execution";

export const PURCHASE_STATES = [
  "DISCOVERING",
  "OFFER_SELECTED",
  "CHECKOUT_PREPARING",
  "CHECKOUT_READY",
  "FUNDING_ANALYZED",
  "SWAP_QUOTE_READY",
  "AWAITING_SWAP_APPROVAL",
  "SWAP_PENDING",
  "FUNDS_READY",
  "PAYMENT_RAIL_UNAVAILABLE",
  "PAYMENT_READY",
  "AWAITING_PAYMENT_APPROVAL",
  "PAYMENT_PENDING",
  "PAYMENT_CONFIRMED",
  "ORDER_PENDING",
  "ORDER_CONFIRMED",
  "FAILED",
  "REFUNDED",
] as const;

export type PurchaseState = (typeof PURCHASE_STATES)[number];

const EDGES: Record<PurchaseState, PurchaseState[]> = {
  DISCOVERING: ["OFFER_SELECTED", "FAILED"],
  OFFER_SELECTED: ["CHECKOUT_PREPARING", "FAILED"],
  CHECKOUT_PREPARING: ["CHECKOUT_READY", "FAILED"],
  CHECKOUT_READY: ["FUNDING_ANALYZED", "FAILED"],
  FUNDING_ANALYZED: ["SWAP_QUOTE_READY", "FUNDS_READY", "PAYMENT_RAIL_UNAVAILABLE", "FAILED"],
  SWAP_QUOTE_READY: ["AWAITING_SWAP_APPROVAL", "FUNDING_ANALYZED", "FAILED"],
  AWAITING_SWAP_APPROVAL: ["SWAP_PENDING", "FAILED"],
  SWAP_PENDING: ["FUNDS_READY", "FAILED"],
  FUNDS_READY: ["PAYMENT_RAIL_UNAVAILABLE", "PAYMENT_READY", "FAILED"],
  PAYMENT_RAIL_UNAVAILABLE: ["PAYMENT_READY", "FAILED"],
  PAYMENT_READY: ["AWAITING_PAYMENT_APPROVAL", "FAILED"],
  AWAITING_PAYMENT_APPROVAL: ["PAYMENT_PENDING", "FAILED"],
  PAYMENT_PENDING: ["PAYMENT_CONFIRMED", "FAILED"],
  PAYMENT_CONFIRMED: ["ORDER_PENDING", "REFUNDED", "FAILED"],
  ORDER_PENDING: ["ORDER_CONFIRMED", "FAILED"],
  ORDER_CONFIRMED: ["REFUNDED"],
  FAILED: [],
  REFUNDED: [],
};

export interface PurchaseTransitionInput {
  paymentEvidence?: PaymentEvidence | null;
  merchantOrderEvidence?: MerchantOrderEvidence | null;
  railReady?: boolean;
  quoteFresh?: boolean;
  executionPermitted?: boolean;
}

export function canTransition(from: PurchaseState, to: PurchaseState): boolean {
  return EDGES[from].includes(to);
}

export function transitionPurchase(
  from: PurchaseState,
  to: PurchaseState,
  input: PurchaseTransitionInput = {},
): PurchaseState {
  if (!canTransition(from, to)) {
    throw new Error(`Cannot move a purchase from ${from} to ${to}.`);
  }
  if ((to === "SWAP_PENDING" || to === "PAYMENT_PENDING" || to === "PAYMENT_CONFIRMED") && input.executionPermitted !== true) {
    throw new FinancialExecutionDisabled(`moving a purchase to ${to}`);
  }
  if (to === "PAYMENT_READY" && input.railReady !== true) {
    throw new Error("Payment cannot become ready while the payment rail is unavailable.");
  }
  if (to === "SWAP_QUOTE_READY" && input.quoteFresh !== true) {
    throw new Error("A purchase cannot hold a conversion quote that is missing or stale.");
  }
  if (to === "PAYMENT_CONFIRMED" && !input.paymentEvidence) {
    throw new Error("Payment confirmation requires payment evidence.");
  }
  if (to === "ORDER_CONFIRMED" && !hasMerchantOrder(input.merchantOrderEvidence ?? null)) {
    throw new Error("Order confirmation requires merchant order evidence. A card charge is not an order.");
  }
  return to;
}

export function assertPaymentIsNotAnOrder(state: PurchaseState, order: MerchantOrderEvidence | null): void {
  if (state === "PAYMENT_CONFIRMED" && hasMerchantOrder(order)) {
    throw new Error("Order evidence must be recorded as its own confirmation.");
  }
}
