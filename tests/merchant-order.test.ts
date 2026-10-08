import { describe, expect, it } from "vitest";
import {
  acceptOrderEvidence,
  assertCompletionRetry,
  bindRetrievedOrder,
  classifyOrderToolResult,
  readCheckoutForOrder,
} from "../src/lib/merchant-order";

const checkoutId = "gid://shopify/Checkout/fixture?key=TEST_ONLY";
const orderId = "gid://shopify/Order/9876543210";
const variantId = "gid://shopify/ProductVariant/1";
const verifiedAt = "2026-10-08T05:00:00.000Z";
const binding = {
  orderId, checkoutId, sourceItemId: variantId, quantity: 1, currency: "USD",
  reviewedAmountMinor: 1750n, verifiedAt,
};

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: orderId,
    checkout_id: checkoutId,
    permalink_url: "https://merchant.test/orders/secret-authenticate",
    currency: "USD",
    totals: [{ type: "subtotal", amount: 1200 }, { type: "fulfillment", amount: 500 }, { type: "tax", amount: 50 }, { type: "total", amount: 1750 }],
    line_items: [{
      id: "gid://shopify/LineItem/1",
      item: { id: variantId, title: "Black / S", price: 1200 },
      quantity: { original: 1, total: 1, fulfilled: 0 },
      status: "processing",
      parent_id: null,
    }],
    fulfillment: { expectations: [{ destination: { street_address: "DO_NOT_KEEP" } }], events: [] },
    adjustments: [],
    ...overrides,
  };
}

describe("Shopify order evidence", () => {
  it("returns an order id from a completed checkout without treating it as confirmation", () => {
    const read = readCheckoutForOrder({
      status: "completed",
      payment: { instruments: [{ id: "DO_NOT_KEEP", type: "card" }] },
      order: { id: orderId, permalink_url: "https://merchant.test/orders/secret" },
    }, true);
    expect(read).toEqual({ status: "order_id_returned", next: "get_order", orderId });
    expect(JSON.stringify(read)).not.toContain("DO_NOT_KEEP");
  });

  it("keeps an in-progress completion pending and does not start another one", () => {
    expect(readCheckoutForOrder({ status: "complete_in_progress", order: { id: orderId } }, true)).toEqual({
      status: "pending_completion", next: "get_checkout",
    });
  });

  it("does not turn a card event, a handoff, or a lost ready checkout into an order", () => {
    expect(readCheckoutForOrder({ object: "issuing.transaction", amount: 1750 }, true).status).toBe("card_event");
    expect(readCheckoutForOrder({ status: "requires_escalation", continue_url: "https://merchant.test/checkout?key=SECRET" }, false).status).toBe("handoff");
    expect(readCheckoutForOrder({ status: "ready_for_complete" }, true).status).toBe("retry_same_key_only");
    expect(readCheckoutForOrder({ status: "ready_for_complete" }, false).status).toBe("not_started");
    expect(readCheckoutForOrder({ status: "completed", order: { id: checkoutId } }, true).status).toBe("unreadable");
  });

  it("rejects a second completion key", () => {
    const key = "661e9500-f39c-52e5-b827-557766551111";
    expect(() => assertCompletionRetry(key, key.toUpperCase())).not.toThrow();
    expect(() => assertCompletionRetry(key, "772f0611-a40d-4636-8938-668877662222")).toThrow(/same idempotency key/);
  });

  it("binds a matching order and leaves buyer and payment data out", () => {
    const bound = bindRetrievedOrder(order(), binding);
    expect(bound.evidence).toEqual({ kind: "merchant_order_api", reference: orderId, verifiedAt });
    expect(bound.currentTotalMinor).toBe(1750n);
    expect(bound.refunds).toEqual([]);
    expect(Object.keys(bound)).toEqual(["evidence", "checkoutId", "currency", "currentTotalMinor", "sourceItemId", "originalQuantity", "refunds"]);
  });

  it("rejects a different total, variant, quantity, checkout, or extra line", () => {
    expect(() => bindRetrievedOrder(order({ totals: [{ type: "total", amount: 1800 }] }), binding)).toThrow(/approved final total/);
    const otherLine = order();
    otherLine.line_items[0]!.item.id = "gid://shopify/ProductVariant/2";
    expect(() => bindRetrievedOrder(otherLine, binding)).toThrow(/does not match/);
    const otherQuantity = order();
    otherQuantity.line_items[0]!.quantity.original = 2;
    expect(() => bindRetrievedOrder(otherQuantity, binding)).toThrow(/does not match/);
    expect(() => bindRetrievedOrder(order({ checkout_id: "gid://shopify/Checkout/other?key=TEST_ONLY" }), binding)).toThrow(/not for this checkout/);
    expect(() => bindRetrievedOrder(order({ line_items: [order().line_items[0], order().line_items[0]] }), binding)).toThrow(/only the selected product/);
  });

  it("records a refund adjustment without replacing the order or the payment", () => {
    const bound = bindRetrievedOrder(order({
      totals: [{ type: "total", amount: 0 }],
      adjustments: [
        { id: "gid://shopify/SalesAgreement/1", type: "refund", totals: [{ type: "total", amount: -1750 }] },
        { id: "gid://shopify/SalesAgreement/1", type: "refund", totals: [{ type: "total", amount: -1750 }] },
      ],
    }), binding);
    expect(bound.evidence.reference).toBe(orderId);
    expect(bound.currentTotalMinor).toBe(0n);
    expect(bound.refunds).toEqual([{ adjustmentId: "gid://shopify/SalesAgreement/1", amountMinor: -1750n }]);
    expect(() => bindRetrievedOrder(order({
      adjustments: [
        { id: "gid://shopify/SalesAgreement/1", totals: [{ type: "total", amount: -1750 }] },
        { id: "gid://shopify/SalesAgreement/1", totals: [{ type: "total", amount: -100 }] },
      ],
    }), binding)).toThrow(/different amount/);
  });

  it("keeps one order and refuses a second", () => {
    const evidence = { kind: "merchant_order_api" as const, reference: orderId, verifiedAt };
    expect(acceptOrderEvidence(evidence, { ...evidence, verifiedAt: "2026-10-08T06:00:00.000Z" })).toBe(evidence);
    expect(() => acceptOrderEvidence(evidence, { ...evidence, reference: "gid://shopify/Order/2" })).toThrow(/already recorded/);
  });

  it("separates missing scope, a missing order, and an unknown transport error", () => {
    const blocked = { result: { isError: true, structuredContent: { messages: [{ code: "orders_not_allowed" }] } } };
    expect(classifyOrderToolResult(blocked, false)).toEqual({ outcome: "access_blocked", code: "orders_not_allowed" });
    const missing = { result: { isError: true, structuredContent: { messages: [{ code: "order_not_found" }] } } };
    expect(classifyOrderToolResult(missing, false)).toEqual({ outcome: "not_found", next: "stop" });
    expect(classifyOrderToolResult(missing, true)).toEqual({ outcome: "not_found", next: "reread_order" });
    expect(classifyOrderToolResult({ error: { code: -32000, message: "Unauthorized" } }, false).outcome).toBe("unknown");
    expect(classifyOrderToolResult({ result: { isError: false, structuredContent: order() } }, false).outcome).toBe("document");
  });
});
