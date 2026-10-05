import { expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { decodeBase58 } from "../src/lib/base58";
import { signDevnetTransfer } from "../src/lib/wallet-standard";
import { connectStandardWallet, discoverStandardWallets, signWalletMessage, supportsDevnetSigning, watchStandardWallet, type StandardWallet } from "../src/lib/wallet-standard";
import { generateSolanaKey } from "../merchant/keys";
import { CIRCLE_SOLANA_DEVNET_USDC_MINT } from "../merchant/product";
import { buildPaymentTransaction } from "../merchant/transaction";

const wallet: StandardWallet = { name: "Late Solana wallet", accounts: [], features: {} };

it("accepts exact signed bytes from another realm and rejects altered messages", async () => {
  const account = { address: "buyer", chains: ["solana:devnet"], features: ["solana:signTransaction"] };
  const transaction = new Uint8Array(70);
  transaction[0] = 1;
  transaction[65] = 1;
  let mutate = false;
  const foreignWallet: StandardWallet = {
    name: "Extension", accounts: [account], chains: ["solana:devnet"],
    features: { "solana:signTransaction": {
      supportedTransactionVersions: ["legacy"],
      signTransaction: async () => {
        const signed = runInNewContext("Uint8Array.from(bytes)", { bytes: [...transaction] }) as Uint8Array;
        expect(signed instanceof Uint8Array).toBe(false);
        signed[1] = 1;
        if (mutate) signed[65] = 2;
        return [{ signedTransaction: signed }];
      },
    } },
  };
  const encoded = Buffer.from(transaction).toString("base64");
  expect(await signDevnetTransfer(foreignWallet, account.address, encoded)).toBeTruthy();
  mutate = true;
  await expect(signDevnetTransfer(foreignWallet, account.address, encoded)).rejects.toThrow(/changed the payment message/);
});

it("invalidates account, network and capability changes and ignores events after cleanup", () => {
  let listener: (change: Record<string, unknown>) => void = () => {};
  let invalidations = 0;
  let cleanups = 0;
  const off = watchStandardWallet({ ...wallet, features: { "standard:events": {
    on: (event: string, callback: typeof listener) => {
      expect(event).toBe("change"); listener = callback;
      return () => { cleanups++; };
    },
  } } }, () => { invalidations++; });
  listener({}); listener({ name: "renamed" });
  expect(invalidations).toBe(0);
  listener({ accounts: [] }); listener({ chains: ["solana:devnet"] }); listener({ features: {} });
  expect(invalidations).toBe(3);
  off(); off(); listener({ accounts: [{ address: "another" }] });
  expect(invalidations).toBe(3);
  expect(cleanups).toBe(1);
});

it("supports wallets without the optional events feature", () => {
  expect(() => watchStandardWallet(wallet, () => { throw new Error("unexpected event"); })()).not.toThrow();
});

it("discovers a wallet registered after the app using the standard callback event", () => {
  const target = new EventTarget();
  const found = discoverStandardWallets(target);
  target.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", {
    detail: ({ register }: { register: (...wallets: StandardWallet[]) => unknown }) => register(wallet),
  }));
  expect(found).toEqual([wallet]);
  expect(discoverStandardWallets(target)).toBe(found);
});

it("deduplicates wallet registration and supports unregister", () => {
  const target = new EventTarget();
  const found = discoverStandardWallets(target);
  let unregister: (() => void) | undefined;
  target.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", {
    detail: ({ register }: { register: (...wallets: StandardWallet[]) => () => void }) => {
      unregister = register(wallet, wallet);
    },
  }));
  expect(found).toHaveLength(1);
  unregister!();
  expect(found).toHaveLength(0);
});

it("signs with the account returned by connect when the wallet account list stays empty", async () => {
  const account = { address: "connected-account", chains: ["solana:devnet"], features: ["solana:signMessage", "solana:signTransaction"] };
  let signedWith = "";
  const wallet: StandardWallet = {
    name: "Connect-only wallet", accounts: [], chains: ["solana:devnet"],
    features: {
      "standard:connect": { connect: async () => ({ accounts: [account] }) },
      "solana:signMessage": { signMessage: async (input: { account: { address: string }; message: Uint8Array }) => {
        signedWith = input.account.address;
        return [{ signedMessage: input.message, signature: new Uint8Array(64), signatureType: "ed25519" }];
      } },
      "solana:signTransaction": { signTransaction: async () => [], supportedTransactionVersions: ["legacy"] },
    },
  };
  const connected = await connectStandardWallet(wallet);
  expect(connected.account).toBe(account);
  expect(supportsDevnetSigning(wallet, account.address)).toBe(false);
  expect(supportsDevnetSigning(wallet, account.address, connected.account)).toBe(true);
  expect(await signWalletMessage(wallet, account.address, "control", connected.account)).toHaveLength(88);
  expect(signedWith).toBe("connected-account");
});

it("accepts a reordered v0 payment and rejects an added compute-budget instruction", async () => {
  const buyer = generateSolanaKey().address;
  const legacy = buildPaymentTransaction({
    buyer,
    sourceTokenAccount: generateSolanaKey().address,
    destinationTokenAccount: generateSolanaKey().address,
    mint: CIRCLE_SOLANA_DEVNET_USDC_MINT,
    reference: generateSolanaKey().address,
    amount: 1_000_000n,
    decimals: 6,
    memo: "checkout",
    blockhash: generateSolanaKey().address,
  }).transaction;
  const returned = asVersioned(swapLastReadonlyAccounts(legacy));
  returned[1] = 9;
  expect(returned.length).toBe(legacy.length + 2);
  const encoded = Buffer.from(legacy).toString("base64");
  const wallet = paymentWallet(buyer, () => returned);
  expect(await signDevnetTransfer(wallet, buyer, encoded)).toBe(Buffer.from(returned).toString("base64"));

  const changed = withComputeBudget(legacy);
  changed[1] = 9;
  await expect(signDevnetTransfer(paymentWallet(buyer, () => changed), buyer, encoded)).rejects.toThrow(/added ComputeBudget/);
  await expect(signDevnetTransfer(paymentWallet(buyer, () => changed), buyer, encoded)).rejects.not.toThrow(new RegExp(buyer));
  await expect(signDevnetTransfer(paymentWallet(buyer, () => changed), buyer, encoded)).rejects.not.toThrow(/checkout/);
});

it("does not use a stale account when connect returns no authorized accounts", async () => {
  await expect(connectStandardWallet({
    name: "Disconnected wallet",
    accounts: [{ address: "old-account" }],
    features: { "standard:connect": { connect: async () => ({ accounts: [] }) } },
  })).rejects.toThrow(/address/);
});

function paymentWallet(buyer: string, signedTransaction: () => Uint8Array): StandardWallet {
  const account = { address: buyer, chains: ["solana:devnet"], features: ["solana:signTransaction"] };
  return {
    name: "Phantom fixture",
    accounts: [account],
    chains: ["solana:devnet"],
    features: {
      "solana:signTransaction": {
        supportedTransactionVersions: ["legacy", 0],
        signTransaction: async () => [{ signedTransaction: signedTransaction() }],
      },
    },
  };
}

function asVersioned(legacy: Uint8Array): Uint8Array {
  return Uint8Array.from([...legacy.subarray(0, 65), 128, ...legacy.subarray(65), 0]);
}

function swapLastReadonlyAccounts(transaction: Uint8Array): Uint8Array {
  const copy = transaction.slice();
  const start = 65;
  const keyCount = copy[start + 3]!;
  const readonlyUnsigned = copy[start + 2]!;
  const left = keyCount - 2;
  const right = keyCount - 1;
  if (readonlyUnsigned < 2 || left < 0) throw new Error("Payment fixture has no readonly pair.");
  const keyAt = (index: number) => start + 4 + index * 32;
  const first = copy.slice(keyAt(left), keyAt(left) + 32);
  copy.set(copy.slice(keyAt(right), keyAt(right) + 32), keyAt(left));
  copy.set(first, keyAt(right));
  remap(copy, start + 4 + keyCount * 32 + 32, left, right);
  return copy;
}

function withComputeBudget(transaction: Uint8Array): Uint8Array {
  const program = decodeBase58("ComputeBudget111111111111111111111111111111");
  if (!program || program.length !== 32) throw new Error("Compute Budget program did not decode.");
  const start = 65;
  const keyCount = transaction[start + 3]!;
  const blockhashAt = start + 4 + keyCount * 32;
  const next = transaction.slice();
  next[start + 2] = transaction[start + 2]! + 1;
  next[start + 3] = keyCount + 1;
  const inserted = Uint8Array.from([
    ...next.subarray(0, blockhashAt),
    ...program,
    ...next.subarray(blockhashAt),
  ]);
  const countAt = blockhashAt + 32 + 32;
  inserted[countAt] = inserted[countAt]! + 1;
  return Uint8Array.from([...inserted, keyCount, 0, 9, 3, 1, 0, 0, 0, 0, 0, 0, 0]);
}

function remap(bytes: Uint8Array, offset: number, left: number, right: number): void {
  const instructionCount = bytes[offset]!;
  let cursor = offset + 1;
  for (let index = 0; index < instructionCount; index += 1) {
    bytes[cursor] = swapped(bytes[cursor]!, left, right);
    cursor += 1;
    const accountCount = bytes[cursor]!;
    cursor += 1;
    for (let account = 0; account < accountCount; account += 1) {
      bytes[cursor] = swapped(bytes[cursor]!, left, right);
      cursor += 1;
    }
    const dataLength = bytes[cursor]!;
    cursor += 1 + dataLength;
  }
}

function swapped(value: number, left: number, right: number): number {
  if (value === left) return right;
  if (value === right) return left;
  return value;
}
