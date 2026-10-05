import { expect, it } from "vitest";
import { generateSolanaKey } from "../merchant/keys";
import { buildPaymentTransaction } from "../merchant/transaction";
import { CIRCLE_SOLANA_DEVNET_USDC_MINT } from "../merchant/product";
import { samePaymentMessage, samePaymentWithWalletBudget } from "../src/lib/payment-message";
import { decodeBase58 } from "../src/lib/base58";

function payment() {
  const key = () => generateSolanaKey().address;
  return buildPaymentTransaction({ buyer: key(), sourceTokenAccount: key(), destinationTokenAccount: key(),
    mint: CIRCLE_SOLANA_DEVNET_USDC_MINT, reference: key(), amount: 1_000_000n, decimals: 6,
    memo: "checkout", blockhash: key() }).transaction;
}

function addBudget(legacy: Uint8Array, price: bigint, units = 200_000) {
  const header = [...legacy.subarray(65, 69)];
  header[2] += 1;
  header[3] += 1;
  const unitBytes = Array.from({ length: 4 }, (_, i) => (units >>> (i * 8)) & 255);
  const priceBytes = Array.from({ length: 8 }, (_, i) => Number((price >> BigInt(i * 8)) & 255n));
  const instructionsOffset = 65 + 4 + 7 * 32 + 32;
  return Uint8Array.from([
    ...legacy.subarray(0, 65), ...header, ...legacy.subarray(69, 69 + 7 * 32),
    ...decodeBase58("ComputeBudget111111111111111111111111111111")!,
    ...legacy.subarray(69 + 7 * 32, instructionsOffset), 4,
    7, 0, 5, 2, ...unitBytes, 7, 0, 9, 3, ...priceBytes,
    ...legacy.subarray(instructionsOffset + 1),
  ]);
}

it("accepts only a bounded wallet compute budget while preserving the payment", () => {
  const legacy = payment();
  const withBudget = addBudget(legacy, 500_000n);
  expect(withBudget.length - legacy.length).toBe(52);
  expect(samePaymentMessage(legacy, withBudget)).toBe(false);
  expect(samePaymentWithWalletBudget(legacy, withBudget)).toBe(true);
  expect(samePaymentWithWalletBudget(legacy, addBudget(legacy, 500_001n))).toBe(false);
  expect(samePaymentWithWalletBudget(legacy, addBudget(legacy, 0n, 1_400_001))).toBe(false);
  const altered = withBudget.slice();
  altered[altered.length - 1] ^= 1;
  expect(samePaymentWithWalletBudget(legacy, altered)).toBe(false);
  const unknown = withBudget.slice();
  unknown[65 + 4 + 8 * 32 + 32 + 1 + 3] = 1;
  expect(samePaymentWithWalletBudget(legacy, unknown)).toBe(false);
});

it("accepts a legacy payment serialized as v0 without lookup tables", () => {
  const legacy = payment();
  const versioned = Uint8Array.from([...legacy.subarray(0, 65), 128, ...legacy.subarray(65), 0]);
  versioned[1] = 1;
  expect(samePaymentMessage(legacy, versioned)).toBe(true);
  versioned[versioned.length - 1] = 1;
  expect(samePaymentMessage(legacy, versioned)).toBe(false);
});

it("rejects changes to amount, privileges, payer, blockhash, and appended bytes", () => {
  const legacy = payment();
  // Fixed header with seven keys; transferChecked data follows its five accounts.
  const transferAmountOffset = 65 + 3 + 1 + 7 * 32 + 32 + 1 + 1 + 1 + 5 + 1 + 1;
  for (const index of [66, 69, 65 + 4 + 7 * 32, transferAmountOffset]) {
    const changed = legacy.slice();
    changed[index] ^= 1;
    expect(samePaymentMessage(legacy, changed)).toBe(false);
  }
  expect(samePaymentMessage(legacy, Uint8Array.from([...legacy, 0]))).toBe(false);
});

it("rejects an additional instruction even when the original payment is unchanged", () => {
  const legacy = payment();
  const changed = Uint8Array.from([...legacy, 4, 0, 0]);
  changed[65 + 4 + 7 * 32 + 32] = 3;
  expect(samePaymentMessage(legacy, changed)).toBe(false);
});
