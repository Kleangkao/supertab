import { expect, it } from "vitest";
import { paymentStateFor } from "../src/lib/payment-lifecycle";

it("requires final total, explicit current approval, real funds and a ready rail", () => {
  const ready = { hasOffer: true, finalTotalKnown: true, fundsReady: true, approved: true, expired: false, railReady: true };
  expect(paymentStateFor(ready)).toBe("PAYMENT_READY");
  expect(paymentStateFor({ ...ready, finalTotalKnown: false })).toBe("PAYMENT_NOT_READY");
  expect(paymentStateFor({ ...ready, hasOffer: false })).toBe("PAYMENT_NOT_READY");
  expect(paymentStateFor({ ...ready, fundsReady: false })).toBe("PAYMENT_NOT_READY");
  expect(paymentStateFor({ ...ready, railReady: false })).toBe("PAYMENT_NOT_READY");
  expect(paymentStateFor({ ...ready, approved: false })).toBe("PAYMENT_APPROVAL_REQUIRED");
  expect(paymentStateFor({ ...ready, expired: true })).toBe("PAYMENT_APPROVAL_REQUIRED");
});
