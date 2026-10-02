import type { OrderState, PaymentState } from "./payment-lifecycle";

/** Local fixtures only. This module has no provider, wallet or network access. */
export interface PaymentRehearsal {
  mode: "local_simulation";
  totalMinor: bigint;
  payment: PaymentState;
  order: OrderState;
  orderReference: string | null;
  events: RehearsalAction[];
}

export type RehearsalAction = "approve" | "authorize" | "decline" | "capture" | "confirm_order" | "refund";

export function startRehearsal(totalMinor: bigint): PaymentRehearsal {
  if (totalMinor <= 0n) throw new Error("A rehearsal needs a positive fixture total.");
  return { mode: "local_simulation", totalMinor, payment: "PAYMENT_APPROVAL_REQUIRED",
    order: "ORDER_NOT_CREATED", orderReference: null, events: [] };
}

export function advanceRehearsal(state: PaymentRehearsal, action: RehearsalAction): PaymentRehearsal {
  const next = { ...state, events: [...state.events, action] };
  switch (action) {
    case "approve":
      requireState(state.payment === "PAYMENT_APPROVAL_REQUIRED");
      next.payment = "PAYMENT_READY";
      break;
    case "authorize":
    case "decline":
      requireState(state.payment === "PAYMENT_READY");
      next.payment = action === "authorize" ? "PAYMENT_AUTHORIZED" : "PAYMENT_FAILED";
      break;
    case "capture":
      requireState(state.payment === "PAYMENT_AUTHORIZED");
      next.payment = "PAYMENT_CAPTURED";
      break;
    case "confirm_order":
      requireState(state.payment === "PAYMENT_CAPTURED" && state.order === "ORDER_NOT_CREATED");
      next.order = "ORDER_CONFIRMED";
      next.orderReference = "SIMULATED-ORDER-FIXTURE";
      break;
    case "refund":
      requireState(state.payment === "PAYMENT_CAPTURED");
      next.payment = "PAYMENT_REFUNDED";
      break;
    default:
      throw new Error("Unknown rehearsal action.");
  }
  return next;
}

function requireState(valid: boolean): void {
  if (!valid) throw new Error("This action is not allowed at the current rehearsal stage.");
}
