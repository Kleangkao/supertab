import { describe, expect, it } from "vitest";
import { advanceRehearsal, startRehearsal } from "../src/lib/payment-rehearsal";

describe("isolated local payment rehearsal", () => {
  it("requires approval and authorization before capture and separate evidence before an order", () => {
    const initial = startRehearsal(4800n);
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
});
