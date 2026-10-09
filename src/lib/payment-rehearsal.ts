import type { OrderState, PaymentState } from "./payment-lifecycle";
import { applyPaymentEvent, createPaymentLedger, noteUnresolvedAttempt, type PaymentLedger, type PaymentLedgerEvent } from "./payment-ledger";

/** Local fixtures only. This module has no provider, wallet or network access. */
export interface PaymentRehearsal {
  mode: "local_simulation";
  totalMinor: bigint;
  termsKey: string;
  payment: PaymentState;
  order: OrderState;
  orderReference: string | null;
  events: RehearsalAction[];
  ledger: PaymentLedger | null;
}

export type RehearsalAction =
  | "approve"
  | "authorize"
  | "decline"
  | "mark_pending"
  | "capture"
  | "confirm_order"
  | "refund"
  | "replay_capture"
  | "late_authorization";

export function startRehearsal(totalMinor: bigint, termsKey = "rehearsal-fixture"): PaymentRehearsal {
  if (totalMinor <= 0n) throw new Error("A rehearsal needs a positive fixture total.");
  if (!termsKey.trim()) throw new Error("A rehearsal needs a terms key bound to the selected product.");
  return { mode: "local_simulation", totalMinor, termsKey, payment: "PAYMENT_APPROVAL_REQUIRED",
    order: "ORDER_NOT_CREATED", orderReference: null, events: [], ledger: null };
}

/** Changing product, quantity, or live terms invalidates simulated consent. */
export function rehearsalMatchesTerms(state: PaymentRehearsal, termsKey: string, totalMinor: bigint): boolean {
  return state.termsKey === termsKey && state.totalMinor === totalMinor;
}

export function advanceRehearsal(state: PaymentRehearsal, action: RehearsalAction): PaymentRehearsal {
  const next = { ...state, events: [...state.events, action] };
  switch (action) {
    case "approve":
      requireState(state.payment === "PAYMENT_APPROVAL_REQUIRED");
      next.payment = "PAYMENT_READY";
      next.ledger = createPaymentLedger(state.termsKey, state.totalMinor, "local_simulation");
      break;
    case "authorize":
    case "decline":
      requireState(state.payment === "PAYMENT_READY");
      applyEvidence(action === "authorize" ? "authorized" : "declined");
      break;
    case "mark_pending":
      requireState(state.payment === "PAYMENT_READY" && state.ledger != null);
      next.ledger = noteUnresolvedAttempt(state.ledger!);
      next.payment = next.ledger.payment;
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
      eventId: `fixture-${kind}`, kind, purchaseId: state.termsKey,
      amountMinor: state.totalMinor, currency: "USD", mode: "local_simulation",
    });
    next.payment = next.ledger.payment;
  }
}

function requireState(valid: boolean): void {
  if (!valid) throw new Error("This action is not allowed at the current rehearsal stage.");
}
