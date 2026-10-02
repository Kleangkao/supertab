import { expect, it } from "vitest";
import { simulatedCheckout } from "../src/lib/simulated-checkout";
import { advanceRehearsal, startRehearsal } from "../src/lib/payment-rehearsal";

it("uses the selected item and quantity without claiming a verified merchant total", () => {
  const checkout = simulatedCheckout(3999n, 2);
  expect(checkout.lineMinor).toBe(7998n);
  expect(checkout.totalMinor).toBe(8798n);
  expect(checkout.mode).toBe("local_simulation");
  expect(checkout.merchantTotalVerified).toBe(false);
  const approved = advanceRehearsal(startRehearsal(checkout.totalMinor), "approve");
  expect(approved.ledger?.amountMinor).toBe(checkout.totalMinor);
  expect(approved.ledger?.mode).toBe("local_simulation");
});

it("rejects invalid fixture inputs", () => {
  for (const quantity of [0, 1.5, 21, NaN]) expect(() => simulatedCheckout(100n, quantity)).toThrow();
  expect(() => simulatedCheckout(0n, 1)).toThrow();
});
