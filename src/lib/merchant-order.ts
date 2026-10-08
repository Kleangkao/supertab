import type { MerchantOrderEvidence } from "./order-evidence";

// Shopify Order MCP contract. This module does not call the network and does
// not submit payment. https://shopify.dev/docs/agents/orders/order-mcp
// https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp

const ORDER_ID = /^gid:\/\/shopify\/Order\/[1-9]\d*$/;
const COMPLETION_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CheckoutOrderRead =
  | { status: "pending_completion"; next: "get_checkout" }
  | { status: "order_id_returned"; next: "get_order"; orderId: string }
  | { status: "handoff" }
  | { status: "not_started" }
  | { status: "retry_same_key_only" }
  | { status: "canceled" }
  | { status: "card_event" }
  | { status: "unreadable" };

export interface OrderRefundEvidence {
  adjustmentId: string;
  amountMinor: bigint;
}

export interface BoundMerchantOrder {
  evidence: MerchantOrderEvidence;
  checkoutId: string;
  currency: string;
  currentTotalMinor: bigint;
  sourceItemId: string;
  originalQuantity: number;
  refunds: OrderRefundEvidence[];
}

export interface OrderBinding {
  orderId: string;
  checkoutId: string;
  sourceItemId: string;
  quantity: number;
  currency: string;
  reviewedAmountMinor: bigint;
  verifiedAt: string;
}

export type OrderToolOutcome =
  | { outcome: "access_blocked"; code: "orders_not_allowed" }
  | { outcome: "not_found"; next: "stop" | "reread_order" }
  | { outcome: "invalid_id" }
  | { outcome: "unknown" }
  | { outcome: "document"; order: Record<string, unknown> };

/** A completion retry keeps the key already stored. A new key is a second payment. */
export function assertCompletionRetry(stored: string, retry: string): void {
  if (completionKey(stored) !== completionKey(retry)) {
    throw new Error("A completion retry must reuse the same idempotency key.");
  }
}

/**
 * Read a checkout document after a completion attempt or a later get_checkout.
 * `completed` returns an order id to look up. It is not merchant confirmation.
 */
export function readCheckoutForOrder(checkout: unknown, completionAttempted: boolean): CheckoutOrderRead {
  if (isCardEvent(checkout)) return { status: "card_event" };
  const document = record(checkout);
  const status = String(document?.status ?? "");
  if (status === "complete_in_progress") return { status: "pending_completion", next: "get_checkout" };
  if (status === "completed") {
    const orderId = String(record(document?.order)?.id ?? "");
    return ORDER_ID.test(orderId) ? { status: "order_id_returned", next: "get_order", orderId } : { status: "unreadable" };
  }
  if (status === "requires_escalation" || status === "incomplete") return { status: "handoff" };
  if (status === "ready_for_complete") return { status: completionAttempted ? "retry_same_key_only" : "not_started" };
  if (status === "canceled") return { status: "canceled" };
  return { status: "unreadable" };
}

/** Classify a get_order JSON-RPC payload. An error is not an order and is not a decline. */
export function classifyOrderToolResult(payload: unknown, propagationPending: boolean): OrderToolOutcome {
  const root = record(payload);
  if (root?.error) return { outcome: "unknown" };
  const result = record(root?.result);
  if (!result) return { outcome: "unknown" };
  if (result.isError === true) {
    const code = messageCode(result.structuredContent);
    if (code === "orders_not_allowed") return { outcome: "access_blocked", code };
    if (code === "invalid_order_id") return { outcome: "invalid_id" };
    if (code === "order_not_found") return { outcome: "not_found", next: propagationPending ? "reread_order" : "stop" };
    return { outcome: "unknown" };
  }
  const order = record(result.structuredContent);
  if (!order || !ORDER_ID.test(String(order.id ?? ""))) return { outcome: "unknown" };
  return { outcome: "document", order };
}

/** Bind a get_order document to the checkout and approval. Payment fields are ignored. */
export function bindRetrievedOrder(order: unknown, expected: OrderBinding): BoundMerchantOrder {
  if (isCardEvent(order)) throw new Error("A card event is not a merchant order.");
  const document = record(order);
  if (!document) throw new Error("The merchant did not return an order.");
  const orderId = String(document.id ?? "");
  if (!ORDER_ID.test(orderId) || orderId !== expected.orderId) throw new Error("The merchant returned a different order.");
  if (String(document.checkout_id ?? "") !== expected.checkoutId) throw new Error("The order is not for this checkout.");
  if (String(document.currency ?? "").toUpperCase() !== expected.currency.toUpperCase()) {
    throw new Error("The order currency does not match the approval.");
  }
  const lines = Array.isArray(document.line_items) ? document.line_items : [];
  if (lines.length !== 1) throw new Error("The order must contain only the selected product.");
  const line = record(lines[0]);
  const item = record(line?.item);
  const quantity = record(line?.quantity);
  if (item?.id !== expected.sourceItemId || quantity?.original !== expected.quantity) {
    throw new Error("The order product, variant, or quantity does not match the approval.");
  }
  const currentTotalMinor = signedTotal(document.totals);
  const refunds = refundAdjustments(document.adjustments);
  if (refunds.length === 0 && currentTotalMinor !== expected.reviewedAmountMinor) {
    throw new Error("The order total is not the approved final total.");
  }
  if (!Number.isFinite(Date.parse(expected.verifiedAt))) throw new Error("Order evidence needs a verification time.");
  return {
    evidence: { kind: "merchant_order_api", reference: orderId, verifiedAt: expected.verifiedAt },
    checkoutId: expected.checkoutId,
    currency: expected.currency.toUpperCase(),
    currentTotalMinor,
    sourceItemId: expected.sourceItemId,
    originalQuantity: expected.quantity,
    refunds,
  };
}

/** The first order evidence sticks. The same order is a no-op. A second order is refused. */
export function acceptOrderEvidence(current: MerchantOrderEvidence | null, next: MerchantOrderEvidence): MerchantOrderEvidence {
  if (!current) return next;
  if (current.kind === next.kind && current.reference === next.reference) return current;
  throw new Error("A different merchant order is already recorded.");
}

function completionKey(value: string): string {
  if (!COMPLETION_KEY.test(value)) throw new Error("A checkout completion needs one UUID idempotency key.");
  return value.toLowerCase();
}

function isCardEvent(value: unknown): boolean {
  const body = record(value);
  const nested = record(body?.object);
  return body?.object === "issuing.transaction" || nested?.object === "issuing.transaction";
}

function messageCode(value: unknown): string {
  const messages = record(value)?.messages;
  if (!Array.isArray(messages)) return "";
  return String(record(messages[0])?.code ?? "");
}

function signedTotal(value: unknown): bigint {
  if (!Array.isArray(value)) throw new Error("The merchant order has no total.");
  const totals = value.filter(entry => record(entry)?.type === "total");
  if (totals.length !== 1) throw new Error("The merchant order has no total.");
  const amount = record(totals[0])?.amount;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount)) throw new Error("The merchant order total is invalid.");
  return BigInt(amount);
}

function refundAdjustments(value: unknown): OrderRefundEvidence[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("The merchant order adjustments are unreadable.");
  const seen = new Map<string, bigint>();
  for (const raw of value) {
    const entry = record(raw);
    const id = String(entry?.id ?? "");
    if (!id.startsWith("gid://shopify/")) throw new Error("A merchant adjustment has no stable id.");
    const amount = signedTotal(entry?.totals);
    const prior = seen.get(id);
    if (prior !== undefined && prior !== amount) throw new Error("The same merchant adjustment arrived with a different amount.");
    seen.set(id, amount);
  }
  return [...seen].filter(([, amount]) => amount < 0n).map(([adjustmentId, amountMinor]) => ({ adjustmentId, amountMinor }));
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
