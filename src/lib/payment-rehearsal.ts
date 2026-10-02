import type { OrderState, PaymentState } from "./payment-lifecycle";
import { applyPaymentEvent, createPaymentLedger, type PaymentLedger, type PaymentLedgerEvent } from "./payment-ledger";

/** Local fixtures only. This module has no provider, wallet or network access. */
export interface PaymentRehearsal {
  mode: "local_simulation";
  totalMinor: bigint;
  payment: PaymentState;
  order: OrderState;
  orderReference: string | null;
  events: RehearsalAction[];
  ledger: PaymentLedger | null;
}

export type RehearsalAction = "approve" | "authorize" | "decline" | "capture" | "confirm_order" | "refund" | "replay_capture" | "late_authorization";

export function startRehearsal(totalMinor: bigint): PaymentRehearsal {
  if (totalMinor <= 0n) throw new Error("A rehearsal needs a positive fixture total.");
  return { mode: "local_simulation", totalMinor, payment: "PAYMENT_APPROVAL_REQUIRED",
    order: "ORDER_NOT_CREATED", orderReference: null, events: [], ledger: null };
}

export function advanceRehearsal(state: PaymentRehearsal, action: RehearsalAction): PaymentRehearsal {
  const next = { ...state, events: [...state.events, action] };
  switch (action) {
    case "approve":
      requireState(state.payment === "PAYMENT_APPROVAL_REQUIRED");
      next.payment = "PAYMENT_READY";
      next.ledger = createPaymentLedger("rehearsal-fixture", state.totalMinor, "local_simulation");
      break;
    case "authorize":
    case "decline":
      requireState(state.payment === "PAYMENT_READY");
      applyEvidence(action === "authorize" ? "authorized" : "declined");
      break;
    case "capture":
      requireState(state.payment === "PAYMENT_AUTHORIZED");
      applyEvidence("captured");
      break;
    case "confirm_order":
      requireState(state.payment === "PAYMENT_CAPTURED" && state.order === "ORDER_NOT_CREATED");
      next.order = "ORDER_CONFIRMED";
      next.orderReference = "SIMULATED-ORDER-FIXTURE";
      break;
    case "refund":
      requireState(state.payment === "PAYMENT_CAPTURED");
      applyEvidence("refunded");
      break;
    case "replay_capture":
    case "late_authorization":
      requireState(state.payment === "PAYMENT_CAPTURED" || state.payment === "PAYMENT_REFUNDED");
      applyEvidence(action === "replay_capture" ? "captured" : "authorized");
      break;
    default:
      throw new Error("Unknown rehearsal action.");
  }
  return next;

  function applyEvidence(kind: PaymentLedgerEvent["kind"]) {
    requireState(state.ledger != null);
    next.ledger = applyPaymentEvent(state.ledger!, {
      eventId: `fixture-${kind}`, kind, purchaseId: "rehearsal-fixture",
      amountMinor: state.totalMinor, currency: "USD", mode: "local_simulation",
    });
    next.payment = next.ledger.payment;
  }
}

function requireState(valid: boolean): void {
  if (!valid) throw new Error("This action is not allowed at the current rehearsal stage.");
}
