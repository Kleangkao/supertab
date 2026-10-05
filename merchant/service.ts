import { generateSolanaKey } from "./keys";
import {
  CIRCLE_SOLANA_DEVNET_USDC_MINT,
  DEVNET_USDC_DECIMALS,
  TEST_PRODUCT,
} from "./product";
import { assertProductQuantity, MerchantStore, postedTotal, settlementFor, type CheckoutRecord, type OrderRecord } from "./store";
import { buildPaymentTransaction, transactionBase64, type BuiltTransaction } from "./transaction";
import { verifyTransfer, type ChainTransaction } from "./verify";

export const MERCHANT_SEPARATION = "This owner-controlled devnet merchant proves the integration. It does not prove that another retailer accepts Solana.";

export function postedProduct() {
  return {
    id: TEST_PRODUCT.id,
    name: TEST_PRODUCT.name,
    label: TEST_PRODUCT.label,
    quantity: TEST_PRODUCT.quantity,
    itemMinor: TEST_PRODUCT.itemMinor.toString(),
    shippingMinor: TEST_PRODUCT.shippingMinor.toString(),
    taxMinor: TEST_PRODUCT.taxMinor.toString(),
    totalMinor: postedTotal().toString(),
    mint: CIRCLE_SOLANA_DEVNET_USDC_MINT,
    mintIssuer: "Circle" as const,
    decimals: DEVNET_USDC_DECIMALS,
    network: "solana:devnet" as const,
    separation: MERCHANT_SEPARATION,
  };
}

export interface CheckoutResponse {
  id: string;
  productId: string;
  productName: string;
  label: string;
  quantity: number;
  itemMinor: string;
  shippingMinor: string;
  taxMinor: string;
  totalMinor: string;
  mint: string;
  mintIssuer: "Circle";
  decimals: number;
  network: "solana:devnet";
  buyer: string;
  recipient: string;
  sourceTokenAccount: string;
  destinationTokenAccount: string;
  reference: string;
  expiresAt: string;
  transaction: string;
  separation: string;
}

export type ConfirmResult =
  | { kind: "order"; order: OrderResponse }
  | { kind: "pending" }
  | { kind: "payment_recorded" }
  | { kind: "unapplied"; reason: string };

export interface OrderResponse {
  id: string;
  checkoutId: string;
  productId: string;
  buyer: string;
  totalMinor: string;
  mint: string;
  network: "solana:devnet";
  paymentSignature: string;
  settlement: "on_time" | "late";
  status: "paid" | "refunded";
  refundSignature: string | null;
  separation: string;
}

export class DevnetMerchant {
  private readonly pending = new Map<string, Promise<ConfirmResult>>();

  constructor(
    private readonly store: MerchantStore,
    readonly recipient: string,
    readonly destinationTokenAccount: string,
    private readonly fetchTransaction: (signature: string) => Promise<ChainTransaction | null>,
    private readonly blockhash: () => Promise<string>,
  ) {}

  async createCheckout(input: { buyer: string; sourceTokenAccount: string; quantity: number; now: number }): Promise<CheckoutResponse> {
    assertProductQuantity(input.quantity);
    const reference = generateSolanaKey().address;
    const refundReference = generateSolanaKey().address;
    const blockhash = await this.blockhash();
    const checkout = this.store.createCheckout({
      buyer: input.buyer,
      sourceTokenAccount: input.sourceTokenAccount,
      destinationTokenAccount: this.destinationTokenAccount,
      recipient: this.recipient,
      reference,
      refundReference,
      totalMinor: postedTotal(),
      transaction: "",
      now: input.now,
    });
    const built = paymentFor({ ...checkout, amount: checkout.totalMinor, memo: checkout.id, blockhash });
    return presentCheckout(this.store.noteTransaction(checkout.id, transactionBase64(built.transaction)));
  }

  confirm(checkoutId: string, signature: string, now: number): Promise<ConfirmResult> {
    const key = `${checkoutId}:${signature}`;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const work = this.confirmOnce(checkoutId, signature, now).finally(() => this.pending.delete(key));
    this.pending.set(key, work);
    return work;
  }

  async refund(orderId: string, signature: string): Promise<OrderResponse> {
    const order = this.store.orders.get(orderId);
    if (!order) throw new Error("Order not found.");
    if (order.refundSignature === signature && order.status === "refunded") return presentOrder(order);
    if (order.status !== "paid") throw new Error("Only a paid order can be refunded.");
    const checkout = this.store.checkouts.get(order.checkoutId);
    if (!checkout) throw new Error("Order not found.");
    const tx = await this.fetchTransaction(signature);
    if (!tx) throw new Error("Refund transaction is not confirmed yet.");
    const reason = verifyTransfer(tx, {
      sourceTokenAccount: checkout.destinationTokenAccount,
      destinationTokenAccount: checkout.sourceTokenAccount,
      sourceOwner: checkout.recipient,
      destinationOwner: checkout.buyer,
      mint: CIRCLE_SOLANA_DEVNET_USDC_MINT,
      amount: order.totalMinor,
      decimals: DEVNET_USDC_DECIMALS,
      reference: checkout.refundReference,
    });
    if (reason) throw new Error(`Refund transaction rejected: ${reason}.`);
    return presentOrder(this.store.markRefunded(order.id, signature));
  }

  recover(): OrderResponse[] {
    const created: OrderResponse[] = [];
    for (const payment of this.store.payments.values()) {
      if (payment.status !== "validated" || payment.orderId || !payment.settlement) continue;
      const checkout = this.store.checkouts.get(payment.checkoutId);
      if (!checkout) continue;
      created.push(presentOrder(this.store.createOrder({
        checkoutId: checkout.id,
        productId: TEST_PRODUCT.id,
        buyer: checkout.buyer,
        totalMinor: checkout.totalMinor,
        mint: CIRCLE_SOLANA_DEVNET_USDC_MINT,
        paymentSignature: payment.signature,
        settlement: payment.settlement,
      })));
    }
    return created;
  }

  getOrder(orderId: string): OrderResponse | null {
    const order = this.store.orders.get(orderId);
    return order ? presentOrder(order) : null;
  }

  private async confirmOnce(checkoutId: string, signature: string, now: number): Promise<ConfirmResult> {
    const checkout = this.store.checkouts.get(checkoutId);
    if (!checkout) throw new Error("Checkout not found.");
    const prior = this.store.payments.get(signature);
    if (prior) {
      if (prior.checkoutId !== checkoutId) throw new Error("This signature already belongs to another checkout.");
      if (prior.orderId) {
        const order = this.store.orders.get(prior.orderId);
        if (!order || order.checkoutId !== checkoutId) throw new Error("This signature already belongs to another checkout.");
        return { kind: "order", order: presentOrder(order) };
      }
      if (prior.status === "validated") return { kind: "payment_recorded" };
      return { kind: "unapplied", reason: prior.reason ?? "rejected" };
    }
    if (checkout.orderId) return this.rememberUnapplied(checkout, signature, "already_fulfilled");
    const tx = await this.fetchTransaction(signature);
    if (!tx) return { kind: "pending" };
    const reason = verifyTransfer(tx, {
      sourceTokenAccount: checkout.sourceTokenAccount,
      destinationTokenAccount: checkout.destinationTokenAccount,
      sourceOwner: checkout.buyer,
      destinationOwner: checkout.recipient,
      mint: CIRCLE_SOLANA_DEVNET_USDC_MINT,
      amount: checkout.totalMinor,
      decimals: DEVNET_USDC_DECIMALS,
      reference: checkout.reference,
    });
    if (reason) return this.rememberUnapplied(checkout, signature, reason);
    const settlement = settlementFor(checkout, now);
    if (settlement === "too_late") return this.rememberUnapplied(checkout, signature, "too_late");
    this.store.recordPayment({ signature, checkoutId, status: "validated", reason: null, settlement, orderId: null });
    try {
      const order = this.store.createOrder({
        checkoutId,
        productId: TEST_PRODUCT.id,
        buyer: checkout.buyer,
        totalMinor: checkout.totalMinor,
        mint: CIRCLE_SOLANA_DEVNET_USDC_MINT,
        paymentSignature: signature,
        settlement,
      });
      return { kind: "order", order: presentOrder(order) };
    } catch {
      return { kind: "payment_recorded" };
    }
  }

  private rememberUnapplied(checkout: CheckoutRecord, signature: string, reason: string): ConfirmResult {
    if (!this.store.payments.has(signature)) {
      this.store.recordPayment({ signature, checkoutId: checkout.id, status: "unapplied", reason, settlement: null, orderId: null });
    }
    return { kind: "unapplied", reason };
  }
}

function paymentFor(input: {
  buyer: string;
  sourceTokenAccount: string;
  destinationTokenAccount: string;
  reference: string;
  amount: bigint;
  memo: string;
  blockhash: string;
}): BuiltTransaction {
  return buildPaymentTransaction({
    ...input,
    mint: CIRCLE_SOLANA_DEVNET_USDC_MINT,
    decimals: DEVNET_USDC_DECIMALS,
  });
}

function presentCheckout(checkout: CheckoutRecord): CheckoutResponse {
  return {
    id: checkout.id,
    productId: TEST_PRODUCT.id,
    productName: TEST_PRODUCT.name,
    label: TEST_PRODUCT.label,
    quantity: TEST_PRODUCT.quantity,
    itemMinor: TEST_PRODUCT.itemMinor.toString(),
    shippingMinor: TEST_PRODUCT.shippingMinor.toString(),
    taxMinor: TEST_PRODUCT.taxMinor.toString(),
    totalMinor: checkout.totalMinor.toString(),
    mint: CIRCLE_SOLANA_DEVNET_USDC_MINT,
    mintIssuer: "Circle",
    decimals: DEVNET_USDC_DECIMALS,
    network: "solana:devnet",
    buyer: checkout.buyer,
    recipient: checkout.recipient,
    sourceTokenAccount: checkout.sourceTokenAccount,
    destinationTokenAccount: checkout.destinationTokenAccount,
    reference: checkout.reference,
    expiresAt: new Date(checkout.expiresAt).toISOString(),
    transaction: checkout.transaction,
    separation: MERCHANT_SEPARATION,
  };
}

function presentOrder(order: OrderRecord): OrderResponse {
  return {
    id: order.id,
    checkoutId: order.checkoutId,
    productId: order.productId,
    buyer: order.buyer,
    totalMinor: order.totalMinor.toString(),
    mint: order.mint,
    network: "solana:devnet",
    paymentSignature: order.paymentSignature,
    settlement: order.settlement,
    status: order.status,
    refundSignature: order.refundSignature,
    separation: MERCHANT_SEPARATION,
  };
}
