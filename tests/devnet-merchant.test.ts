import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { encodeBase58, requirePubkey } from "../merchant/base58";
import { listen } from "../merchant/http";
import { generateSolanaKey } from "../merchant/keys";
import { CHECKOUT_TTL_MS, CIRCLE_SOLANA_DEVNET_USDC_MINT, DEVNET_USDC_DECIMALS, LATE_PAYMENT_WINDOW_MS, TEST_PRODUCT, TEST_TOTAL_MINOR } from "../merchant/product";
import { DevnetMerchant } from "../merchant/service";
import { MerchantStore, openDurableStore } from "../merchant/store";
import { buildPaymentTransaction, signTransaction } from "../merchant/transaction";
import type { ChainTransaction } from "../merchant/verify";
import { readDevnetOrder, requestDevnetCheckout, submitDevnetSignature } from "../src/lib/devnet-merchant-client";
import { verifyEd25519 } from "../src/lib/wallet-proof";

const blockhash = encodeBase58(new Uint8Array(32).fill(9));
const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (closers.length > 0) await closers.pop()!();
  while (files.length > 0) rmSync(files.pop()!, { force: true });
});

describe("owner-controlled devnet merchant", () => {
  it("pays one checkout, reads the merchant order, and rejects reuse", async () => {
    const fixture = harness();
    const checkout = await fixture.merchant.createCheckout({ buyer: fixture.buyer.address, sourceTokenAccount: fixture.source.address, quantity: 1, now: 1_000 });
    expect(checkout.totalMinor).toBe(TEST_TOTAL_MINOR.toString());
    expect(BigInt(checkout.itemMinor) + BigInt(checkout.shippingMinor) + BigInt(checkout.taxMinor)).toBe(TEST_TOTAL_MINOR);
    expect(checkout.mint).toBe(CIRCLE_SOLANA_DEVNET_USDC_MINT);
    expect(checkout.mintIssuer).toBe("Circle");
    expect(fixture.store.orders.size).toBe(0);

    const signature = sig();
    fixture.chain.set(signature, transfer(fixture, checkout.reference));
    const confirmed = await fixture.merchant.confirm(checkout.id, signature, 1_000);
    expect(confirmed.kind).toBe("order");
    if (confirmed.kind !== "order") return;
    const again = await fixture.merchant.confirm(checkout.id, signature, 1_000);
    expect(again).toEqual(confirmed);
    expect(fixture.store.orders.size).toBe(1);

    const second = sig();
    fixture.chain.set(second, transfer(fixture, checkout.reference));
    expect(await fixture.merchant.confirm(checkout.id, second, 1_000)).toMatchObject({ kind: "unapplied", reason: "already_fulfilled" });
    expect(fixture.store.orders.size).toBe(1);
  });

  it("rejects a changed amount, mint, recipient, or reference and keeps the payment unapplied", async () => {
    const fixture = harness();
    const checkout = await fixture.merchant.createCheckout({ buyer: fixture.buyer.address, sourceTokenAccount: fixture.source.address, quantity: 1, now: 1_000 });
    for (const [reason, mutate] of [
      ["amount", (tx: ChainTransaction) => { tx.meta!.postTokenBalances![1]!.amount = "1000001"; }],
      ["mint", (tx: ChainTransaction) => { tx.meta!.postTokenBalances![1]!.mint = fixture.buyer.address; tx.meta!.preTokenBalances![1]!.mint = fixture.buyer.address; }],
      ["recipient", (tx: ChainTransaction) => { tx.meta!.postTokenBalances![1]!.owner = fixture.buyer.address; }],
      ["reference", (tx: ChainTransaction) => { tx.transaction.message.accountKeys[6] = fixture.buyer.address; }],
    ] as const) {
      const signature = sig();
      const tx = transfer(fixture, checkout.reference);
      mutate(tx);
      fixture.chain.set(signature, tx);
      expect(await fixture.merchant.confirm(checkout.id, signature, 1_000)).toEqual({ kind: "unapplied", reason });
    }
    expect(fixture.store.orders.size).toBe(0);
    expect(fixture.store.payments.size).toBe(4);
  });

  it("recovers an order when the write fails after a valid payment", async () => {
    const fixture = harness();
    fixture.store.failOrderWrites = 1;
    const checkout = await fixture.merchant.createCheckout({ buyer: fixture.buyer.address, sourceTokenAccount: fixture.source.address, quantity: 1, now: 1_000 });
    const signature = sig();
    fixture.chain.set(signature, transfer(fixture, checkout.reference));
    expect(await fixture.merchant.confirm(checkout.id, signature, 1_000)).toEqual({ kind: "payment_recorded" });
    expect(fixture.store.orders.size).toBe(0);
    const [order] = fixture.merchant.recover();
    expect(order?.paymentSignature).toBe(signature);
    expect(fixture.merchant.recover()).toEqual([]);
  });

  it("accepts a late matching payment and records a payment that arrives after the late window", async () => {
    const fixture = harness();
    const checkout = await fixture.merchant.createCheckout({ buyer: fixture.buyer.address, sourceTokenAccount: fixture.source.address, quantity: 1, now: 1_000 });
    const lateSignature = sig();
    fixture.chain.set(lateSignature, transfer(fixture, checkout.reference));
    const late = await fixture.merchant.confirm(checkout.id, lateSignature, 1_000 + CHECKOUT_TTL_MS + 1);
    expect(late).toMatchObject({ kind: "order", order: { settlement: "late", status: "paid" } });

    const expired = await fixture.merchant.createCheckout({ buyer: fixture.buyer.address, sourceTokenAccount: fixture.source.address, quantity: 1, now: 5_000 });
    const tooLate = sig();
    fixture.chain.set(tooLate, transfer(fixture, expired.reference));
    expect(await fixture.merchant.confirm(expired.id, tooLate, 5_000 + CHECKOUT_TTL_MS + LATE_PAYMENT_WINDOW_MS + 1)).toEqual({ kind: "unapplied", reason: "too_late" });
    expect(fixture.store.payments.get(tooLate)?.status).toBe("unapplied");
  });

  it("marks a refund only after the return transfer matches", async () => {
    const fixture = harness();
    const checkout = await fixture.merchant.createCheckout({ buyer: fixture.buyer.address, sourceTokenAccount: fixture.source.address, quantity: 1, now: 1_000 });
    const payment = sig();
    fixture.chain.set(payment, transfer(fixture, checkout.reference));
    const paid = await fixture.merchant.confirm(checkout.id, payment, 1_000);
    if (paid.kind !== "order") throw new Error("expected order");
    const stored = fixture.store.checkouts.get(checkout.id)!;
    const bad = sig();
    fixture.chain.set(bad, refundTransfer(fixture, stored.refundReference));
    fixture.chain.get(bad)!.meta!.postTokenBalances![0]!.amount = "1";
    await expect(fixture.merchant.refund(paid.order.id, bad)).rejects.toThrow(/amount/);
    expect(fixture.merchant.getOrder(paid.order.id)?.status).toBe("paid");
    const refund = sig();
    fixture.chain.set(refund, refundTransfer(fixture, stored.refundReference));
    expect((await fixture.merchant.refund(paid.order.id, refund)).status).toBe("refunded");
    expect((await fixture.merchant.refund(paid.order.id, refund)).refundSignature).toBe(refund);
  });

  it("builds a buyer-approved devnet USDC transaction for the checkout reference", async () => {
    const fixture = harness();
    const checkout = await fixture.merchant.createCheckout({ buyer: fixture.buyer.address, sourceTokenAccount: fixture.source.address, quantity: 1, now: 1_000 });
    const raw = Buffer.from(checkout.transaction, "base64");
    expect(raw.includes(Buffer.from(requirePubkey(checkout.reference, "reference")))).toBe(true);
    expect(raw.includes(Buffer.from(requirePubkey(CIRCLE_SOLANA_DEVNET_USDC_MINT, "mint")))).toBe(true);
    expect(raw.includes(Buffer.from([0x40, 0x42, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x00]))).toBe(true);
    const built = buildPaymentTransaction({
      buyer: fixture.buyer.address,
      sourceTokenAccount: fixture.source.address,
      destinationTokenAccount: fixture.destination.address,
      mint: CIRCLE_SOLANA_DEVNET_USDC_MINT,
      reference: checkout.reference,
      amount: TEST_TOTAL_MINOR,
      decimals: DEVNET_USDC_DECIMALS,
      memo: checkout.id,
      blockhash,
    });
    const signed = signTransaction(built, [fixture.buyer]);
    verifyEd25519(fixture.buyer.address, built.message, signed.subarray(1, 65));
  });

  it("lets SuperTab read an order only after the merchant confirms it", async () => {
    const fixture = harness();
    const server = await listen(fixture.merchant);
    closers.push(server.close);
    const checkout = await requestDevnetCheckout(server.url, { buyer: fixture.buyer.address, sourceTokenAccount: fixture.source.address, quantity: 1 });
    expect(await readDevnetOrder(server.url, "missing")).toBeNull();
    const signature = sig();
    fixture.chain.set(signature, transfer(fixture, checkout.reference));
    const submitted = await submitDevnetSignature(server.url, checkout.id, signature) as { status: number; body: { kind: string; order: { id: string } } };
    expect(submitted.status).toBe(200);
    const order = await readDevnetOrder(server.url, submitted.body.order.id);
    expect(order).toMatchObject({ checkoutId: checkout.id, paymentSignature: signature, totalMinor: TEST_TOTAL_MINOR.toString(), mint: CIRCLE_SOLANA_DEVNET_USDC_MINT, separation: expect.stringContaining("does not prove") });
    expect(TEST_PRODUCT.label).toContain("not a product from another retailer");
  });

  it("reloads the same order and refund, and refuses to reuse the payment", async () => {
    const file = temporaryStore();
    const fixture = harness();
    const durable = openDurableStore(file);
    const merchant = merchantFor(fixture, durable);
    const checkout = await merchant.createCheckout({ buyer: fixture.buyer.address, sourceTokenAccount: fixture.source.address, quantity: 1, now: 1_000 });
    const signature = sig();
    fixture.chain.set(signature, transfer(fixture, checkout.reference));
    const paid = await merchant.confirm(checkout.id, signature, 1_000);
    if (paid.kind !== "order") throw new Error("expected order");
    const stored = durable.checkouts.get(checkout.id)!;
    const refund = sig();
    fixture.chain.set(refund, refundTransfer(fixture, stored.refundReference));
    expect((await merchant.refund(paid.order.id, refund)).status).toBe("refunded");

    const restarted = merchantFor(fixture, openDurableStore(file));
    const order = restarted.getOrder(paid.order.id);
    expect(order).toMatchObject({ id: paid.order.id, status: "refunded", refundSignature: refund, paymentSignature: signature });
    expect(await restarted.confirm(checkout.id, signature, 9_000)).toEqual({ kind: "order", order });
    const other = await restarted.createCheckout({ buyer: fixture.buyer.address, sourceTokenAccount: fixture.source.address, quantity: 1, now: 2_000 });
    await expect(restarted.confirm(other.id, signature, 2_000)).rejects.toThrow(/another checkout/);
    expect(restarted.getOrder(paid.order.id)?.id).toBe(paid.order.id);
    expect(restarted.recover()).toEqual([]);
  });

  it("recovers one order after a restart when the order write failed", async () => {
    const file = temporaryStore();
    const fixture = harness();
    const durable = openDurableStore(file);
    durable.failOrderWrites = 1;
    const merchant = merchantFor(fixture, durable);
    const checkout = await merchant.createCheckout({ buyer: fixture.buyer.address, sourceTokenAccount: fixture.source.address, quantity: 1, now: 1_000 });
    const signature = sig();
    fixture.chain.set(signature, transfer(fixture, checkout.reference));
    expect(await merchant.confirm(checkout.id, signature, 1_000)).toEqual({ kind: "payment_recorded" });

    const restarted = merchantFor(fixture, openDurableStore(file));
    expect(restarted.getOrder("missing")).toBeNull();
    const [order] = restarted.recover();
    expect(order?.paymentSignature).toBe(signature);
    const again = merchantFor(fixture, openDurableStore(file));
    expect(again.recover()).toEqual([]);
    expect(await again.confirm(checkout.id, signature, 1_000)).toEqual({ kind: "order", order });
  });

  it("lets SuperTab read one order again after the merchant process restarts", async () => {
    const file = temporaryStore();
    const fixture = harness();
    const first = await listen(merchantFor(fixture, openDurableStore(file)));
    const checkout = await requestDevnetCheckout(first.url, { buyer: fixture.buyer.address, sourceTokenAccount: fixture.source.address, quantity: 1 });
    const signature = sig();
    fixture.chain.set(signature, transfer(fixture, checkout.reference));
    const submitted = await submitDevnetSignature(first.url, checkout.id, signature) as { status: number; body: { order: { id: string } } };
    expect(submitted.status).toBe(200);
    await first.close();
    const second = await listen(merchantFor(fixture, openDurableStore(file)));
    closers.push(second.close);
    const order = await readDevnetOrder(second.url, submitted.body.order.id);
    expect(order).toMatchObject({ id: submitted.body.order.id, paymentSignature: signature, status: "paid", separation: expect.stringContaining("does not prove") });
    const replay = await submitDevnetSignature(second.url, checkout.id, signature) as { status: number; body: { order: { id: string } } };
    expect(replay.status).toBe(200);
    expect(replay.body.order.id).toBe(order?.id);
  });
});

const files: string[] = [];

function temporaryStore(): string {
  const file = join(tmpdir(), `supertab-merchant-${randomBytes(4).toString("hex")}.json`);
  files.push(file);
  return file;
}

function merchantFor(fixture: ReturnType<typeof harness>, store: MerchantStore): DevnetMerchant {
  return new DevnetMerchant(store, fixture.recipient.address, fixture.destination.address, async (signature) => fixture.chain.get(signature) ?? null, async () => blockhash);
}

function harness() {
  const store = new MerchantStore();
  const buyer = generateSolanaKey();
  const recipient = generateSolanaKey();
  const source = generateSolanaKey();
  const destination = generateSolanaKey();
  const chain = new Map<string, ChainTransaction>();
  const merchant = new DevnetMerchant(store, recipient.address, destination.address, async (signature) => chain.get(signature) ?? null, async () => blockhash);
  return { store, buyer, recipient, source, destination, chain, merchant };
}

function transfer(fixture: ReturnType<typeof harness>, reference: string, amount = TEST_TOTAL_MINOR): ChainTransaction {
  const before = 2_000_000n;
  return balances(fixture, reference, before.toString(), (before - amount).toString(), "0", amount.toString(), fixture.buyer.address, fixture.recipient.address);
}

function refundTransfer(fixture: ReturnType<typeof harness>, reference: string): ChainTransaction {
  return balances(fixture, reference, "0", TEST_TOTAL_MINOR.toString(), TEST_TOTAL_MINOR.toString(), "0", fixture.buyer.address, fixture.recipient.address);
}

function balances(fixture: ReturnType<typeof harness>, reference: string, sourceBefore: string, sourceAfter: string, destinationBefore: string, destinationAfter: string, sourceOwner: string, destinationOwner: string): ChainTransaction {
  const keys = [fixture.buyer.address, fixture.source.address, fixture.destination.address, CIRCLE_SOLANA_DEVNET_USDC_MINT, "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", reference];
  return {
    meta: {
      err: null,
      preTokenBalances: [
        { accountIndex: 1, mint: CIRCLE_SOLANA_DEVNET_USDC_MINT, owner: sourceOwner, amount: sourceBefore, decimals: 6 },
        { accountIndex: 2, mint: CIRCLE_SOLANA_DEVNET_USDC_MINT, owner: destinationOwner, amount: destinationBefore, decimals: 6 },
      ],
      postTokenBalances: [
        { accountIndex: 1, mint: CIRCLE_SOLANA_DEVNET_USDC_MINT, owner: sourceOwner, amount: sourceAfter, decimals: 6 },
        { accountIndex: 2, mint: CIRCLE_SOLANA_DEVNET_USDC_MINT, owner: destinationOwner, amount: destinationAfter, decimals: 6 },
      ],
    },
    transaction: { message: { accountKeys: keys } },
  };
}

function sig(): string {
  return encodeBase58(randomBytes(64));
}
