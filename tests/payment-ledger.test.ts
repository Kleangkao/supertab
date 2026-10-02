import { expect, it } from "vitest";
import { applyPaymentEvent, createPaymentLedger, type PaymentLedgerEvent } from "../src/lib/payment-ledger";

const event = (kind: PaymentLedgerEvent["kind"], eventId: string = kind): PaymentLedgerEvent => ({
  eventId, kind, purchaseId: "purchase-1", currency: "USD", amountMinor: 4800n, mode: "local_simulation",
});

it("deduplicates delivery and rejects conflicting or mismatched evidence", () => {
  const initial = createPaymentLedger("purchase-1", 4800n, "local_simulation");
  const authorized = applyPaymentEvent(initial, event("authorized", "event-1"));
  expect(applyPaymentEvent(authorized, event("authorized", "event-1"))).toBe(authorized);
  expect(() => applyPaymentEvent(authorized, event("captured", "event-1"))).toThrow(/conflicting/);
  for (const patch of [{ purchaseId: "other" }, { currency: "EUR" }, { amountMinor: 4700n }, { mode: "live" as const }]) {
    expect(() => applyPaymentEvent(initial, { ...event("captured"), ...patch })).toThrow(/does not match/);
  }
  expect(initial.events).toEqual({});
});

it("does not regress capture or refund when earlier events arrive late", () => {
  const captured = applyPaymentEvent(createPaymentLedger("purchase-1", 4800n, "local_simulation"), event("captured"));
  expect(applyPaymentEvent(captured, event("authorized")).payment).toBe("PAYMENT_CAPTURED");
  expect(applyPaymentEvent(captured, event("declined")).payment).toBe("PAYMENT_CAPTURED");
  const refunded = applyPaymentEvent(captured, event("refunded"));
  expect(applyPaymentEvent(refunded, event("captured", "late-capture")).payment).toBe("PAYMENT_REFUNDED");
  expect(Object.keys(refunded)).not.toContain("order");
});

it("allows a premature refund to be retried after capture without consuming it", () => {
  const initial = createPaymentLedger("purchase-1", 4800n, "local_simulation");
  expect(() => applyPaymentEvent(initial, event("refunded"))).toThrow(/retry after capture/);
  expect(initial.events).toEqual({});
  expect(applyPaymentEvent(applyPaymentEvent(initial, event("captured")), event("refunded")).payment).toBe("PAYMENT_REFUNDED");
});
