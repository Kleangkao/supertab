import type { PaymentState } from "./payment-lifecycle";

export type EvidenceMode = "local_simulation" | "sandbox" | "live";
export interface PaymentLedger {
  purchaseId: string;
  currency: string;
  amountMinor: bigint;
  mode: EvidenceMode;
  payment: PaymentState;
  events: Record<string, string>;
}
export interface PaymentLedgerEvent {
  eventId: string;
  purchaseId: string;
  currency: string;
  amountMinor: bigint;
  mode: EvidenceMode;
  kind: "authorized" | "captured" | "refunded" | "declined";
}

/** State evidence only: no payment submission and no merchant order inference. */
export function createPaymentLedger(purchaseId: string, amountMinor: bigint, mode: EvidenceMode): PaymentLedger {
  if (!purchaseId.trim() || amountMinor <= 0n) throw new Error("A payment ledger needs a purchase and positive amount.");
  return { purchaseId, amountMinor, currency: "USD", mode, payment: "PAYMENT_READY", events: {} };
}

export function applyPaymentEvent(ledger: PaymentLedger, event: PaymentLedgerEvent): PaymentLedger {
  if (!event.eventId.trim() || event.purchaseId !== ledger.purchaseId || event.currency !== ledger.currency
    || event.mode !== ledger.mode || event.amountMinor !== ledger.amountMinor) {
    throw new Error("Payment evidence does not match this purchase, amount, currency or mode.");
  }
  const fingerprint = JSON.stringify([event.purchaseId, event.currency, event.amountMinor.toString(), event.mode, event.kind]);
  const seen = Object.hasOwn(ledger.events, event.eventId) ? ledger.events[event.eventId] : undefined;
  if (seen) {
    if (seen !== fingerprint) throw new Error("A duplicate payment event has conflicting evidence.");
    return ledger;
  }
  let payment = ledger.payment;
  switch (event.kind) {
    case "authorized":
      if (payment === "PAYMENT_READY") payment = "PAYMENT_AUTHORIZED";
      break;
    case "declined":
      if (payment === "PAYMENT_READY" || payment === "PAYMENT_AUTHORIZED") payment = "PAYMENT_FAILED";
      break;
    case "captured":
      if (payment !== "PAYMENT_REFUNDED") payment = "PAYMENT_CAPTURED";
      break;
    case "refunded":
      if (payment !== "PAYMENT_CAPTURED" && payment !== "PAYMENT_REFUNDED") {
        throw new Error("Refund evidence needs a captured payment; retry after capture evidence arrives.");
      }
      payment = "PAYMENT_REFUNDED";
      break;
    default:
      throw new Error("Unsupported payment evidence kind.");
  }
  return { ...ledger, payment, events: { ...ledger.events, [event.eventId]: fingerprint } };
}
