import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
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

interface MerchantSnapshot {
  version: 1;
  checkouts: Array<Omit<CheckoutRecord, "totalMinor"> & { totalMinor: string }>;
  payments: PaymentRecord[];
  orders: Array<Omit<OrderRecord, "totalMinor"> & { totalMinor: string }>;
}

export class MerchantStore {
  readonly checkouts = new Map<string, CheckoutRecord>();
  readonly payments = new Map<string, PaymentRecord>();
  readonly orders = new Map<string, OrderRecord>();
  readonly references = new Map<string, string>();
  failOrderWrites = 0;
  private writer: (() => void) | null = null;

  /** Saves later mutations to one local file. The fault-injection counter stays in memory. */
  attachFile(file: string): void {
    this.writer = () => writeSnapshot(file, this.snapshot());
  }

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
    this.saved();
    return checkout;
  }

  noteTransaction(id: string, transaction: string): CheckoutRecord {
    const checkout = this.checkouts.get(id);
    if (!checkout) throw new Error("Checkout not found.");
    checkout.transaction = transaction;
    this.saved();
    return checkout;
  }

  recordPayment(payment: PaymentRecord): void {
    if (this.payments.has(payment.signature)) throw new Error("This signature was already recorded.");
    this.payments.set(payment.signature, payment);
    this.saved();
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
    this.saved();
    return order;
  }

  markRefunded(orderId: string, signature: string): OrderRecord {
    const order = this.orders.get(orderId);
    if (!order || order.status !== "paid") throw new Error("Only a paid order can be refunded.");
    order.status = "refunded";
    order.refundSignature = signature;
    this.saved();
    return order;
  }

  private saved(): void {
    this.writer?.();
  }

  private snapshot(): MerchantSnapshot {
    return {
      version: 1,
      checkouts: [...this.checkouts.values()].map((checkout) => ({ ...checkout, totalMinor: checkout.totalMinor.toString() })),
      payments: [...this.payments.values()],
      orders: [...this.orders.values()].map((order) => ({ ...order, totalMinor: order.totalMinor.toString() })),
    };
  }
}

/** Opens the local test-merchant file. A missing file starts empty; a damaged file is refused. */
export function openDurableStore(file: string): MerchantStore {
  const store = new MerchantStore();
  try {
    loadSnapshot(store, JSON.parse(readFileSync(file, "utf8")) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  store.attachFile(file);
  return store;
}

function loadSnapshot(store: MerchantStore, raw: unknown): void {
  if (!raw || typeof raw !== "object" || (raw as { version?: unknown }).version !== 1) {
    throw new Error("Devnet merchant store is not a supported snapshot.");
  }
  const snapshot = raw as MerchantSnapshot;
  if (!Array.isArray(snapshot.checkouts) || !Array.isArray(snapshot.payments) || !Array.isArray(snapshot.orders)) {
    throw new Error("Devnet merchant store is missing its records.");
  }
  for (const checkout of snapshot.checkouts) {
    const record = checkoutFrom(checkout);
    if (store.checkouts.has(record.id) || store.references.has(record.reference)) {
      throw new Error("Devnet merchant store has a duplicate checkout.");
    }
    store.checkouts.set(record.id, record);
    store.references.set(record.reference, record.id);
  }
  for (const payment of snapshot.payments) {
    if (store.payments.has(payment.signature)) throw new Error("Devnet merchant store has a duplicate payment.");
    if (!store.checkouts.has(payment.checkoutId)) throw new Error("Devnet merchant store has a payment without its checkout.");
    store.payments.set(payment.signature, payment);
  }
  for (const order of snapshot.orders) {
    const record = orderFrom(order);
    const payment = store.payments.get(record.paymentSignature);
    const checkout = store.checkouts.get(record.checkoutId);
    if (!payment || !checkout || payment.orderId !== record.id || checkout.orderId !== record.id || payment.checkoutId !== checkout.id) {
      throw new Error("Devnet merchant store has an order that does not match its payment.");
    }
    store.orders.set(record.id, record);
  }
  for (const payment of store.payments.values()) {
    if (payment.orderId && !store.orders.has(payment.orderId)) {
      throw new Error("Devnet merchant store has a payment whose order is missing.");
    }
  }
}

function checkoutFrom(value: MerchantSnapshot["checkouts"][number]): CheckoutRecord {
  return { ...value, totalMinor: minor(value.totalMinor) };
}

function orderFrom(value: MerchantSnapshot["orders"][number]): OrderRecord {
  return { ...value, totalMinor: minor(value.totalMinor) };
}

function minor(value: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error("Devnet merchant store has an invalid amount.");
  return BigInt(value);
}

function writeSnapshot(file: string, snapshot: MerchantSnapshot): void {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(snapshot));
  try {
    unlinkSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  renameSync(temporary, file);
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
