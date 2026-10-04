import { randomUUID } from "node:crypto";
import { CHECKOUT_TTL_MS, LATE_PAYMENT_WINDOW_MS, TEST_PRODUCT, TEST_TOTAL_MINOR } from "./product";

export interface CheckoutRecord {
  id: string;
  buyer: string;
  sourceTokenAccount: string;
  destinationTokenAccount: string;
  recipient: string;
  reference: string;
  refundReference: string;
  totalMinor: bigint;
  createdAt: number;
  expiresAt: number;
  transaction: string;
  orderId: string | null;
}

export interface PaymentRecord {
  signature: string;
  checkoutId: string;
  status: "validated" | "unapplied";
  reason: string | null;
  settlement: "on_time" | "late" | null;
  orderId: string | null;
}

export interface OrderRecord {
  id: string;
  checkoutId: string;
  productId: string;
  buyer: string;
  totalMinor: bigint;
  mint: string;
  paymentSignature: string;
  settlement: "on_time" | "late";
  status: "paid" | "refunded";
  refundSignature: string | null;
}

export class MerchantStore {
  readonly checkouts = new Map<string, CheckoutRecord>();
  readonly payments = new Map<string, PaymentRecord>();
  readonly orders = new Map<string, OrderRecord>();
  readonly references = new Map<string, string>();
  failOrderWrites = 0;

  createCheckout(input: Omit<CheckoutRecord, "id" | "createdAt" | "expiresAt" | "orderId"> & { now: number }): CheckoutRecord {
    const { now, ...fields } = input;
    const id = randomUUID();
    const checkout: CheckoutRecord = {
      ...fields,
      id,
      createdAt: now,
      expiresAt: now + CHECKOUT_TTL_MS,
      orderId: null,
    };
    this.checkouts.set(id, checkout);
    this.references.set(checkout.reference, id);
    return checkout;
  }

  recordPayment(payment: PaymentRecord): void {
    if (this.payments.has(payment.signature)) throw new Error("This signature was already recorded.");
    this.payments.set(payment.signature, payment);
  }

  createOrder(input: Omit<OrderRecord, "id" | "status" | "refundSignature">): OrderRecord {
    if (this.failOrderWrites > 0) {
      this.failOrderWrites -= 1;
      throw new Error("The order record could not be written.");
    }
    const checkout = this.checkouts.get(input.checkoutId);
    const payment = this.payments.get(input.paymentSignature);
    if (!checkout || !payment || payment.checkoutId !== checkout.id || payment.status !== "validated") {
      throw new Error("An order requires a validated payment for this checkout.");
    }
    if (checkout.orderId || payment.orderId) throw new Error("This payment already has an order.");
    const order: OrderRecord = { ...input, id: randomUUID(), status: "paid", refundSignature: null };
    checkout.orderId = order.id;
    payment.orderId = order.id;
    this.orders.set(order.id, order);
    return order;
  }

  markRefunded(orderId: string, signature: string): OrderRecord {
    const order = this.orders.get(orderId);
    if (!order || order.status !== "paid") throw new Error("Only a paid order can be refunded.");
    order.status = "refunded";
    order.refundSignature = signature;
    return order;
  }
}

export function settlementFor(checkout: CheckoutRecord, now: number): "on_time" | "late" | "too_late" {
  if (now <= checkout.expiresAt) return "on_time";
  if (now <= checkout.expiresAt + LATE_PAYMENT_WINDOW_MS) return "late";
  return "too_late";
}

export function assertProductQuantity(quantity: number): void {
  if (quantity !== TEST_PRODUCT.quantity) throw new Error("This test merchant sells one marker at its posted total.");
}

export function postedTotal(): bigint {
  return TEST_TOTAL_MINOR;
}
