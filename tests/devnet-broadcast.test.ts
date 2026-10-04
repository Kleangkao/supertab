import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { encodeBase58, requirePubkey } from "../merchant/base58";
import { ASSOCIATED_TOKEN_PROGRAM, associatedTokenAddress } from "../merchant/ata";
import { isOnCurve } from "../merchant/curve";
import { executeDevnetPurchase, type ChainRpc } from "../merchant/execute";
import { generateSolanaKey, keyFromStored, type SolanaKey } from "../merchant/keys";
import { normalizeChainTransaction } from "../merchant/normalize";
import { CIRCLE_SOLANA_DEVNET_USDC_MINT, TEST_TOTAL_MINOR } from "../merchant/product";
import { devnetChainRpc } from "../merchant/rpc";
import { verifyTransfer, type ChainTransaction } from "../merchant/verify";
import { verifyEd25519 } from "../src/lib/wallet-proof";

const blockhash = encodeBase58(new Uint8Array(32).fill(9));

describe("devnet broadcast preparation", () => {
  it("derives the same token accounts as Solana and keeps those addresses off the curve", () => {
    const key = generateSolanaKey();
    const identity = new Uint8Array(32);
    identity[0] = 1;
    expect(isOnCurve(key.publicKey)).toBe(true);
    expect(isOnCurve(identity)).toBe(true);
    expect(isOnCurve(new Uint8Array(32).fill(0xff))).toBe(false);
    const ata = associatedTokenAddress(key.address, CIRCLE_SOLANA_DEVNET_USDC_MINT);
    expect(associatedTokenAddress(key.address, CIRCLE_SOLANA_DEVNET_USDC_MINT)).toBe(ata);
    expect(isOnCurve(requirePubkey(ata, "associated token account"))).toBe(false);
    // Checked once against @solana/web3.js 1.99 findProgramAddressSync. The package is not a dependency.
    expect(associatedTokenAddress("3cZQhK76SC4ve12WjNcugVi7z1SgQgxY4dpbNtsoon6M", CIRCLE_SOLANA_DEVNET_USDC_MINT)).toBe("86TXh4mV9mkqgAjBZPCAUCpFScRn9gfRXtyYxQYpvXvx");
    expect(associatedTokenAddress("8rXZ9KFzc3NCMMvNdyfJ5irvHnTWYYGLqPJY5WuMuwmZ", CIRCLE_SOLANA_DEVNET_USDC_MINT)).toBe("3DFoabEcK3vXC7h5gXtXFd19HoTPRPTzRTKfX5cDGPYF");
  });

  it("verifies a jsonParsed transfer only after reading uiTokenAmount", () => {
    const payer = generateSolanaKey();
    const merchant = generateSolanaKey();
    const source = associatedTokenAddress(payer.address, CIRCLE_SOLANA_DEVNET_USDC_MINT);
    const destination = associatedTokenAddress(merchant.address, CIRCLE_SOLANA_DEVNET_USDC_MINT);
    const reference = generateSolanaKey().address;
    const raw = {
      meta: {
        err: null,
        preTokenBalances: [
          parsedBalance(1, payer.address, "2000000"),
          parsedBalance(2, merchant.address, "0"),
        ],
        postTokenBalances: [
          parsedBalance(1, payer.address, "1000000"),
          parsedBalance(2, merchant.address, "1000000"),
        ],
      },
      transaction: { message: { accountKeys: [payer.address, source, destination, CIRCLE_SOLANA_DEVNET_USDC_MINT, reference] } },
    };
    const expected = {
      sourceTokenAccount: source,
      destinationTokenAccount: destination,
      sourceOwner: payer.address,
      destinationOwner: merchant.address,
      mint: CIRCLE_SOLANA_DEVNET_USDC_MINT,
      amount: TEST_TOTAL_MINOR,
      decimals: 6,
      reference,
    };
    expect(verifyTransfer(raw as unknown as ChainTransaction, expected)).toBe("mint");
    const normalized = normalizeChainTransaction(raw);
    expect(normalized?.meta?.postTokenBalances?.[1]?.amount).toBe("1000000");
    expect(verifyTransfer(normalized!, expected)).toBeNull();
  });

  it("does not send when the payer has no devnet SOL or USDC", async () => {
    const payer = generateSolanaKey();
    const merchant = generateSolanaKey();
    const empty = mockRpc(payer, merchant, { lamports: 0n, usdcMinor: 0n, sourceExists: false, destinationExists: false });
    await expect(executeDevnetPurchase({ payer, merchantWallet: merchant, now: 1_000, rpc: empty.rpc })).resolves.toMatchObject({
      status: "blocked",
      missing: "devnet SOL",
      lamports: "0",
      usdcMinor: "0",
    });
    const solvent = mockRpc(payer, merchant, { lamports: 5_000_000n, usdcMinor: 0n, sourceExists: true, destinationExists: true });
    await expect(executeDevnetPurchase({ payer, merchantWallet: merchant, now: 1_000, rpc: solvent.rpc })).resolves.toMatchObject({
      status: "blocked",
      missing: "Circle devnet USDC",
    });
    expect(empty.sent).toEqual([]);
    expect(solvent.sent).toEqual([]);
  });

  it("creates a missing token account, confirms the order, and refunds it from chain fixtures", async () => {
    const payer = generateSolanaKey();
    const merchant = generateSolanaKey();
    const source = associatedTokenAddress(payer.address, CIRCLE_SOLANA_DEVNET_USDC_MINT);
    const destination = associatedTokenAddress(merchant.address, CIRCLE_SOLANA_DEVNET_USDC_MINT);
    const chain = mockRpc(payer, merchant, { lamports: 5_000_000n, usdcMinor: 2_000_000n, sourceExists: true, destinationExists: false });
    const result = await executeDevnetPurchase({ payer, merchantWallet: merchant, now: 1_000, rpc: chain.rpc });
    expect(result).toMatchObject({ status: "refunded", mint: CIRCLE_SOLANA_DEVNET_USDC_MINT });
    expect(chain.sent).toHaveLength(3);
    expect(accountKeys(chain.sent[0]!).includes(ASSOCIATED_TOKEN_PROGRAM)).toBe(true);
    expect(chain.sent[1]![0]).toBe(1);
    expect(chain.sent[2]![0]).toBe(2);
    verifyEd25519(payer.address, chain.sent[1]!.subarray(65), chain.sent[1]!.subarray(1, 65));
    verifyEd25519(payer.address, chain.sent[2]!.subarray(129), chain.sent[2]!.subarray(1, 65));
    verifyEd25519(merchant.address, chain.sent[2]!.subarray(129), chain.sent[2]!.subarray(65, 129));
    expect(accountKeys(chain.sent[1]!)[1]).toBe(source);
    expect(accountKeys(chain.sent[1]!)[2]).toBe(destination);
    expect(accountKeys(chain.sent[2]!)[2]).toBe(destination);
    expect(accountKeys(chain.sent[2]!)[3]).toBe(source);
  });
});

it.skipIf(process.env.RUN_DEVNET_BROADCAST !== "1")("live devnet purchase stays blocked until the payer is funded", async () => {
  const stored = JSON.parse(readFileSync("merchant/secrets/devnet-keys.json", "utf8")) as {
    payer: { address: string; publicKey: string; seed: string };
    merchant: { address: string; publicKey: string; seed: string };
  };
  const result = await executeDevnetPurchase({
    payer: keyFromStored(stored.payer),
    merchantWallet: keyFromStored(stored.merchant),
    now: Date.now(),
    rpc: devnetChainRpc(),
  });
  expect(result.status).toBe("blocked");
});

function parsedBalance(accountIndex: number, owner: string, amount: string) {
  return { accountIndex, mint: CIRCLE_SOLANA_DEVNET_USDC_MINT, owner, uiTokenAmount: { amount, decimals: 6 } };
}

function mockRpc(payer: SolanaKey, merchant: SolanaKey, input: { lamports: bigint; usdcMinor: bigint; sourceExists: boolean; destinationExists: boolean }): { rpc: ChainRpc; sent: Uint8Array[] } {
  const source = associatedTokenAddress(payer.address, CIRCLE_SOLANA_DEVNET_USDC_MINT);
  const destination = associatedTokenAddress(merchant.address, CIRCLE_SOLANA_DEVNET_USDC_MINT);
  const sent: Uint8Array[] = [];
  const signatures = new Map<string, Uint8Array>();
  const rpc: ChainRpc = {
    async getBalance() { return input.lamports; },
    async tokenAccount(address) {
      if (address === source && input.sourceExists) return { amount: input.usdcMinor };
      if (address === destination && input.destinationExists) return { amount: 0n };
      return null;
    },
    async rent() { return 2_000_000n; },
    async blockhash() { return blockhash; },
    async send(transaction) {
      const signature = encodeBase58(randomBytes(64));
      signatures.set(signature, transaction);
      sent.push(transaction);
      return signature;
    },
    async getTransaction(signature) {
      const transaction = signatures.get(signature);
      if (!transaction) return null;
      const keys = accountKeys(transaction);
      if (keys.includes(ASSOCIATED_TOKEN_PROGRAM)) {
        return { meta: { err: null, preTokenBalances: [], postTokenBalances: [] }, transaction: { message: { accountKeys: keys } } };
      }
      const sourceIndex = keys.indexOf(source);
      const destinationIndex = keys.indexOf(destination);
      if (sourceIndex < 0 || destinationIndex < 0) throw new Error("Token accounts are missing from the signed transaction.");
      const payment = transaction[0] === 1;
      return {
        meta: {
          err: null,
          preTokenBalances: [
            parsedBalance(sourceIndex, payer.address, payment ? "2000000" : "0"),
            parsedBalance(destinationIndex, merchant.address, payment ? "0" : TEST_TOTAL_MINOR.toString()),
          ],
          postTokenBalances: [
            parsedBalance(sourceIndex, payer.address, payment ? "1000000" : TEST_TOTAL_MINOR.toString()),
            parsedBalance(destinationIndex, merchant.address, payment ? TEST_TOTAL_MINOR.toString() : "0"),
          ],
        },
        transaction: { message: { accountKeys: keys } },
      };
    },
    async pause() {},
  };
  return { rpc, sent };
}

function accountKeys(transaction: Uint8Array): string[] {
  const signatures = transaction[0]!;
  const message = transaction.subarray(1 + signatures * 64);
  const count = message[3]!;
  return Array.from({ length: count }, (_, index) => encodeBase58(message.subarray(4 + index * 32, 4 + (index + 1) * 32)));
}
