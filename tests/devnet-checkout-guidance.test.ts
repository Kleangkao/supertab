import { expect, it } from "vitest";
import { VERIFIED_DEVNET_ORDER_ID, devnetCheckoutGuidance, isPreservedPaidOrder } from "../src/lib/devnet-checkout-guidance";

const checkoutId = "checkout-1";

function guide(overrides: Partial<Parameters<typeof devnetCheckoutGuidance>[0]> = {}) {
  return devnetCheckoutGuidance({
    checkoutId,
    signed: false,
    broadcastSignature: null,
    orderCheckoutId: null,
    orderStatus: null,
    expired: false,
    blocked: false,
    ...overrides,
  });
}

it("says a signed payment is still local only before it is sent", () => {
  const guidance = guide({ signed: true });
  expect(guidance.paymentNote).toMatch(/still on this device/);
  expect(guidance.paymentNote).toMatch(/has not been sent/);
  expect(guidance.sendDisabled).toBe(false);
  expect(guidance.signDisabled).toBe(false);
  expect(guidance.freshReview).toBe(false);
});

it("does not call a submitted payment local, and does not offer a new checkout to recover it", () => {
  const pending = guide({ signed: true, broadcastSignature: "sig" });
  expect(pending.paymentNote).not.toMatch(/still on this device|has not been sent/);
  expect(pending.paymentNote).toMatch(/Do not start a new checkout/);
  expect(pending.recoverExisting).toBe(true);
  expect(pending.freshReview).toBe(false);
  expect(pending.signDisabled).toBe(true);
  expect(pending.sendDisabled).toBe(false);

  const expiredAfterSend = guide({ signed: true, broadcastSignature: "sig", expired: true, blocked: true });
  expect(expiredAfterSend.freshReview).toBe(false);
  expect(expiredAfterSend.paymentNote).toMatch(/will not recover this payment/);
  expect(expiredAfterSend.sendDisabled).toBe(true);
});

it("turns signing and sending off once this checkout has a paid or refunded order", () => {
  for (const orderStatus of ["paid", "refunded"] as const) {
    const guidance = guide({ signed: true, broadcastSignature: "sig", orderCheckoutId: checkoutId, orderStatus });
    expect(guidance.signDisabled).toBe(true);
    expect(guidance.sendDisabled).toBe(true);
    expect(guidance.paymentNote).not.toMatch(/still on this device|has not been sent/);
    expect(guidance.freshReview).toBe(false);
    expect(guidance.recoverExisting).toBe(false);
  }
  expect(guide({ signed: true, broadcastSignature: "sig", orderCheckoutId: checkoutId, orderStatus: "refunded" }).paymentNote).toMatch(/refund/);
});

it("offers a fresh review only when the checkout expired before any send", () => {
  const guidance = guide({ signed: true, expired: true, blocked: true });
  expect(guidance.freshReview).toBe(true);
  expect(guidance.paymentNote).toMatch(/No payment was sent/);
  expect(guidance.sendDisabled).toBe(true);
  expect(guidance.signDisabled).toBe(true);
});

it("leaves the two earlier paid orders out of the refund prompt", () => {
  expect(isPreservedPaidOrder("ab0421c2-e708-40cd-b30c-a1e2a433b512")).toBe(true);
  expect(isPreservedPaidOrder("3518beef-1b53-4e5c-8682-0baca6b1c3fa")).toBe(true);
  expect(isPreservedPaidOrder(VERIFIED_DEVNET_ORDER_ID)).toBe(false);
});

it("does not treat another checkout's order as this payment", () => {
  const guidance = guide({
    signed: true,
    orderCheckoutId: "other-checkout",
    orderStatus: "refunded",
  });
  expect(guidance.paymentNote).toMatch(/has not been sent/);
  expect(guidance.sendDisabled).toBe(false);
  expect(guidance.signDisabled).toBe(false);
});
