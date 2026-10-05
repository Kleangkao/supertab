import { expect, it } from "vitest";
import { generateSolanaKey } from "../merchant/keys";
import { buildPaymentTransaction } from "../merchant/transaction";
import { CIRCLE_SOLANA_DEVNET_USDC_MINT } from "../merchant/product";
import { samePaymentMessage } from "../src/lib/payment-message";

function payment() {
  const key = () => generateSolanaKey().address;
  return buildPaymentTransaction({ buyer: key(), sourceTokenAccount: key(), destinationTokenAccount: key(),
    mint: CIRCLE_SOLANA_DEVNET_USDC_MINT, reference: key(), amount: 1_000_000n, decimals: 6,
    memo: "checkout", blockhash: key() }).transaction;
}

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
