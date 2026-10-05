import { describe, expect, it } from "vitest";
import { generateSolanaKey } from "../merchant/keys";
import { DevnetMerchant } from "../merchant/service";
import { MerchantStore } from "../merchant/store";
import { devnetPaymentBlock } from "../src/lib/devnet-payment";

const blockhash = "11111111111111111111111111111111";

describe("devnet payment approval gate", () => {
  it("blocks signing until the connected devnet account approves the exact checkout", async () => {
    const buyer = generateSolanaKey();
    const merchant = new DevnetMerchant(new MerchantStore(), generateSolanaKey().address, generateSolanaKey().address, async () => null, async () => blockhash);
    const checkout = await merchant.createCheckout({ buyer: buyer.address, sourceTokenAccount: generateSolanaKey().address, quantity: 1, now: 1_000 });
    const terms = {
      transaction: checkout.transaction, buyer: checkout.buyer, mint: checkout.mint, reference: checkout.reference,
      totalMinor: checkout.totalMinor, checkoutId: checkout.id, expiresAt: checkout.expiresAt,
    };
    expect(devnetPaymentBlock({ terms: null, connectedAddress: null, devnetCapable: true, approvedCheckoutId: null, now: 1_000 })).toMatch(/Connect/);
    expect(devnetPaymentBlock({ terms, connectedAddress: buyer.address, devnetCapable: false, approvedCheckoutId: checkout.id, now: 1_000 })).toMatch(/devnet/);
    expect(devnetPaymentBlock({ terms, connectedAddress: buyer.address, devnetCapable: true, approvedCheckoutId: null, now: 1_000 })).toMatch(/Approve/);
    expect(devnetPaymentBlock({ terms, connectedAddress: generateSolanaKey().address, devnetCapable: true, approvedCheckoutId: checkout.id, now: 1_000 })).toMatch(/buyer/);
    expect(devnetPaymentBlock({ terms, connectedAddress: buyer.address, devnetCapable: true, approvedCheckoutId: checkout.id, now: Date.parse(checkout.expiresAt) })).toMatch(/expired/);
    expect(devnetPaymentBlock({ terms, connectedAddress: buyer.address, devnetCapable: true, approvedCheckoutId: checkout.id, now: 1_000 })).toBeNull();
  });
});
