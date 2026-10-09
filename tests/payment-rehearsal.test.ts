import { describe, expect, it } from "vitest";
import { advanceRehearsal, rehearsalMatchesTerms, startRehearsal } from "../src/lib/payment-rehearsal";

describe("isolated local payment rehearsal", () => {
  it("uses the payment ledger when duplicate and delayed fixture events arrive", () => {
    let state = startRehearsal(4800n, "terms-a");
    for (const action of ["approve", "authorize", "capture", "replay_capture", "late_authorization"] as const) state = advanceRehearsal(state, action);
    expect(state.payment).toBe("PAYMENT_CAPTURED");
    expect(state.order).toBe("ORDER_NOT_CREATED");
    expect(Object.keys(state.ledger!.events)).toHaveLength(2);
    state = advanceRehearsal(state, "refund");
    expect(advanceRehearsal(state, "replay_capture").payment).toBe("PAYMENT_REFUNDED");
    expect(advanceRehearsal(state, "late_authorization").payment).toBe("PAYMENT_REFUNDED");
  });
  it("requires approval and authorization before capture and separate evidence before an order", () => {
    const initial = startRehearsal(4800n, "terms-b");
    expect(() => advanceRehearsal(initial, "authorize")).toThrow();
    expect(() => advanceRehearsal(initial, "capture")).toThrow();
    const approved = advanceRehearsal(initial, "approve");
    const authorized = advanceRehearsal(approved, "authorize");
    expect(() => advanceRehearsal(authorized, "confirm_order")).toThrow();
    const captured = advanceRehearsal(authorized, "capture");
    expect(captured.order).toBe("ORDER_NOT_CREATED");
    expect(captured.orderReference).toBeNull();
    const ordered = advanceRehearsal(captured, "confirm_order");
    expect(ordered.orderReference).toMatch(/^SIMULATED-/);
    const refunded = advanceRehearsal(ordered, "refund");
    expect(refunded.payment).toBe("PAYMENT_REFUNDED");
    expect(refunded.order).toBe("ORDER_CONFIRMED");
    expect(() => advanceRehearsal(refunded, "refund")).toThrow();
    expect(initial.events).toEqual([]);
    expect(refunded.events).toEqual(["approve", "authorize", "capture", "confirm_order", "refund"]);
  });

  it("makes declined payments terminal and rejects invalid totals", () => {
    expect(() => startRehearsal(0n)).toThrow();
    const declined = advanceRehearsal(advanceRehearsal(startRehearsal(1n), "approve"), "decline");
    expect(declined.payment).toBe("PAYMENT_FAILED");
    expect(() => advanceRehearsal(declined, "capture")).toThrow();
    expect(() => advanceRehearsal(declined, "confirm_order")).toThrow();
  });

  it("keeps a lost response pending and refuses another start until reset", () => {
    const approved = advanceRehearsal(startRehearsal(4800n, "terms-c"), "approve");
    const pending = advanceRehearsal(approved, "mark_pending");
    expect(pending.payment).toBe("PAYMENT_PENDING");
    expect(pending.order).toBe("ORDER_NOT_CREATED");
    expect(() => advanceRehearsal(pending, "authorize")).toThrow();
    expect(() => advanceRehearsal(pending, "decline")).toThrow();
    expect(() => advanceRehearsal(pending, "mark_pending")).toThrow();
  });

  it("allows only late fixture evidence from pending, without creating an order", () => {
    const pending = advanceRehearsal(advanceRehearsal(startRehearsal(4800n, "terms-d"), "approve"), "mark_pending");
    const authorized = advanceRehearsal(pending, "resolve_pending_authorized");
    expect(authorized.payment).toBe("PAYMENT_AUTHORIZED");
    expect(authorized.order).toBe("ORDER_NOT_CREATED");
    expect(() => advanceRehearsal(authorized, "confirm_order")).toThrow();
    const declined = advanceRehearsal(pending, "resolve_pending_declined");
    expect(declined.payment).toBe("PAYMENT_FAILED");
    expect(declined.order).toBe("ORDER_NOT_CREATED");
    expect(() => advanceRehearsal(declined, "capture")).toThrow();
  });

  it("invalidates simulated consent when product terms change", () => {
    const state = advanceRehearsal(startRehearsal(4800n, "terms-old"), "approve");
    expect(rehearsalMatchesTerms(state, "terms-old", 4800n)).toBe(true);
    expect(rehearsalMatchesTerms(state, "terms-new", 4800n)).toBe(false);
    expect(rehearsalMatchesTerms(state, "terms-old", 5600n)).toBe(false);
  });
});
