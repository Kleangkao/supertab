import { describe, expect, it } from "vitest";
import { associatedTokenAddress } from "../merchant/ata";
import { CIRCLE_SOLANA_DEVNET_USDC_MINT } from "../merchant/product";
import { decodeBase58, encodeBase58 } from "../src/lib/base58";
import { readConfig } from "../src/lib/config";
import { DEVNET_CONVERSION_FINDING } from "../src/lib/conversion-facts";
import {
  COMPUTE_BUDGET_PROGRAM,
  ConversionInputError,
  DFLOW_SWAP_PROGRAM,
  assessConversionBalance,
  buildConversionReview,
  conversionQuoteExpired,
  parseExactTokenAmount,
  resolveConversionAsset,
  validateConversionTransaction,
} from "../src/lib/conversion-review";
import { requestConversionQuote } from "../src/lib/conversion-service";
import type { DflowQuote } from "../src/lib/dflow";
import { NATIVE_SOL_MINT, USDC_MINT, WSOL_MINT } from "../src/lib/tokens";
import type { AssetBalance } from "../src/lib/tokens";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const PAYER = encodeBase58(Uint8Array.from({ length: 32 }, () => 3));
const IN_AMOUNT = 10_000_000n;
const OUT_AMOUNT = 1_200_000n;
const MIN_AMOUNT = 1_194_000n;
const PRIORITY = 10_000n;

function pubkey(address: string): Uint8Array {
  const bytes = decodeBase58(address);
  if (!bytes || bytes.length !== 32) throw new Error(`fixture address ${address}`);
  return bytes;
}

function compact(value: number): number[] {
  return [value];
}

function u32(value: number): number[] {
  return [value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >> 24) & 255];
}

function u64(value: bigint): number[] {
  const bytes: number[] = [];
  let rest = value;
  for (let index = 0; index < 8; index += 1) {
    bytes.push(Number(rest & 255n));
    rest >>= 8n;
  }
  return bytes;
}

function transaction(keys: Uint8Array[], instructions: { program: number; data: number[] }[], lookups: { table: Uint8Array; writable: number[]; readonly: number[] }[] = []): Uint8Array {
  const versioned = lookups.length > 0;
  const body = [
    1,
    ...new Array<number>(64).fill(0),
    ...(versioned ? [128] : []),
    1,
    0,
    Math.max(0, keys.length - 2),
    ...compact(keys.length),
  ];
  for (const key of keys) body.push(...key);
  body.push(...new Array<number>(32).fill(7));
  body.push(...compact(instructions.length));
  for (const instruction of instructions) {
    body.push(instruction.program, 0, ...compact(instruction.data.length), ...instruction.data);
  }
  if (versioned) {
    body.push(...compact(lookups.length));
    for (const lookup of lookups) {
      body.push(...lookup.table, ...compact(lookup.writable.length), ...lookup.writable, ...compact(lookup.readonly.length), ...lookup.readonly);
    }
  }
  return Uint8Array.from(body);
}

function quoteTransaction(mutate?: (data: number[]) => void): Uint8Array {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, ...u64(IN_AMOUNT), ...u64(OUT_AMOUNT)];
  mutate?.(data);
  const keys = [
    pubkey(PAYER),
    pubkey(DFLOW_SWAP_PROGRAM),
    pubkey(WSOL_MINT),
    pubkey(USDC_MINT),
    pubkey(associatedTokenAddress(PAYER, USDC_MINT)),
    pubkey(COMPUTE_BUDGET_PROGRAM),
  ];
  return transaction(keys, [
    { program: 5, data: [2, ...u32(200_000)] },
    { program: 5, data: [3, ...u64(50_000n)] },
    { program: 1, data },
  ]);
}

function check(tx: Uint8Array, patch: Partial<Parameters<typeof validateConversionTransaction>[0]> = {}) {
  return validateConversionTransaction({
    transaction: tx,
    payer: PAYER,
    inputMint: WSOL_MINT,
    outputMint: USDC_MINT,
    inAmount: IN_AMOUNT,
    outAmount: OUT_AMOUNT,
    minOutAmount: MIN_AMOUNT,
    lookupTables: [],
    prioritizationFeeLamports: PRIORITY,
    executionMode: "sync",
    ...patch,
  });
}

const sampleQuote = {
  inputMint: WSOL_MINT,
  outputMint: USDC_MINT,
  inAmount: IN_AMOUNT,
  outAmount: OUT_AMOUNT,
  minOutAmount: MIN_AMOUNT,
  slippageBps: 50,
  priceImpactPct: "0.01",
  platformFeeText: "No platform fee was reported.",
  platformFeeAmount: null,
  platformFeeBps: null,
  platformFeeMode: null,
  prioritizationFeeLamports: null,
  contextSlot: 1,
  lastValidBlockHeight: null,
  executionMode: "sync",
  transactionPresent: false,
} satisfies DflowQuote;

describe("conversion quote review", () => {
  it("rejects a symbol, the wrong USDC mint, and extra decimal places", () => {
    expect(() => resolveConversionAsset("USDC", "spl")).toThrow(/mint address/i);
    expect(() => resolveConversionAsset(USDC_MINT, "spl")).toThrow(/output asset/i);
    expect(() => resolveConversionAsset(CIRCLE_SOLANA_DEVNET_USDC_MINT, "spl")).toThrow(/devnet USDC/i);
    expect(() => parseExactTokenAmount("0.0000001", 6)).toThrow(ConversionInputError);
    expect(parseExactTokenAmount("0.01", 9)).toBe(IN_AMOUNT);
  });

  it("keeps an expired quote, a short balance, and a missing SOL reserve distinct", () => {
    const review = buildConversionReview({
      asset: resolveConversionAsset(NATIVE_SOL_MINT, "native"),
      decimals: 9,
      quote: sampleQuote,
      quotedAtMs: 1_000,
      balance: { status: "not_read", detail: "No wallet was read. This quote is not compared with a balance.", usdcBalanceBase: null, usdcBalanceDisplay: null },
      validation: { status: "not_prepared", explanation: "No wallet address was read, so DFlow was not asked for an unsigned transaction.", limits: "fixture" },
    });
    expect(conversionQuoteExpired(review.expiresAt, 1_000 + 45_000)).toBe(true);
    expect(conversionQuoteExpired(review.expiresAt, 1_000 + 44_999)).toBe(false);
    expect(review.walletUsdcIncludesQuote).toBe(false);
    expect(review.fundingGapIncludesQuote).toBe(false);
    expect(review.coverage.recordedMerchantTotal).toBe("$55.53");
    expect(review.coverage.minimumCoversRecordedTotal).toBe(false);
    expect(review.coverage.note).toMatch(/not a current payable total/);
    expect(assessConversionBalance({ kind: "spl", assetAmount: 5n, solLamports: 20_000_000n, inputAmount: 6n }).status).toBe("insufficient_input");
    expect(assessConversionBalance({ kind: "spl", assetAmount: 6n, solLamports: 1_000n, inputAmount: 6n }).status).toBe("insufficient_sol_fee");
    expect(assessConversionBalance({ kind: "native", assetAmount: 15_000_000n, solLamports: 15_000_000n, inputAmount: IN_AMOUNT }).status).toBe("insufficient_sol_fee");
  });

  it("checks a fixture transaction and rejects altered terms, permissions, and undisclosed accounts", () => {
    expect(check(quoteTransaction()).status).toBe("checked");
    expect(check(quoteTransaction((data) => { data[data.length - 1] = 9; })).explanation).toMatch(/unverifiable/i);
    expect(check(quoteTransaction(), { payer: encodeBase58(Uint8Array.from({ length: 32 }, () => 4)) }).explanation).toMatch(/fee payer/i);
    const approved = quoteTransaction();
    const token = pubkey(TOKEN_PROGRAM);
    const withApprove = transaction(
      [pubkey(PAYER), pubkey(DFLOW_SWAP_PROGRAM), pubkey(WSOL_MINT), pubkey(USDC_MINT), pubkey(associatedTokenAddress(PAYER, USDC_MINT)), pubkey(COMPUTE_BUDGET_PROGRAM), token],
      [
        { program: 5, data: [2, ...u32(200_000)] },
        { program: 5, data: [3, ...u64(50_000n)] },
        { program: 1, data: [1, 2, 3, 4, 5, 6, 7, 8, ...u64(IN_AMOUNT), ...u64(OUT_AMOUNT)] },
        { program: 6, data: [4, ...u64(1n)] },
      ],
    );
    expect(approved.length).toBeGreaterThan(0);
    expect(check(withApprove).explanation).toMatch(/Approve/);
    const hidden = transaction(
      [pubkey(PAYER), pubkey(DFLOW_SWAP_PROGRAM), pubkey(WSOL_MINT), pubkey(COMPUTE_BUDGET_PROGRAM)],
      [
        { program: 3, data: [2, ...u32(200_000)] },
        { program: 3, data: [3, ...u64(50_000n)] },
        { program: 1, data: [1, 2, 3, 4, 5, 6, 7, 8, ...u64(IN_AMOUNT), ...u64(OUT_AMOUNT)] },
      ],
      [{ table: Uint8Array.from({ length: 32 }, () => 9), writable: [0], readonly: [1] }],
    );
    expect(check(hidden).explanation).toMatch(/lookup table/i);
  });
});

describe("conversion quote service", () => {
  it("returns the recorded devnet finding without calling a provider", async () => {
    const review = await requestConversionQuote({ network: "solana:devnet" }, {
      config: readConfig({}),
      fetchImpl: () => { throw new Error("devnet probe must not run"); },
    });
    expect(review).toMatchObject({ supported: false, finding: DEVNET_CONVERSION_FINDING, completed: false });
  });

  it("asks DFlow for a mainnet USDC quote and does not treat the output as a balance", async () => {
    let called = "";
    const tx = Buffer.from(quoteTransaction()).toString("base64");
    const review = await requestConversionQuote({
      network: "solana:mainnet-beta",
      inputMint: NATIVE_SOL_MINT,
      amountText: "0.01",
      assetKind: "native",
      walletAddress: PAYER,
    }, {
      config: readConfig({ DFLOW_QUOTE_BASE_URL: "https://dflow.test", DFLOW_SLIPPAGE_BPS: "50" }),
      now: () => Date.parse("2026-10-05T12:00:00.000Z"),
      readBalances: async () => [sol(30_000_000n), usdc(4n)],
      fetchImpl: (input) => {
        called = String(input);
        return Promise.resolve(Response.json({
          inputMint: WSOL_MINT,
          inAmount: "10000000",
          outputMint: USDC_MINT,
          outAmount: "1200000",
          minOutAmount: "1194000",
          slippageBps: 50,
          platformFee: null,
          priceImpactPct: "0",
          contextSlot: 11,
          executionMode: "sync",
          prioritizationFeeLamports: 10_000,
          lastValidBlockHeight: 99,
          transaction: tx,
          addressLookupTables: [],
        }));
      },
    });
    expect(called).toContain(`outputMint=${USDC_MINT}`);
    expect(called).not.toContain(CIRCLE_SOLANA_DEVNET_USDC_MINT);
    expect(called).toContain("includeAddressLookupTables=true");
    if (!("validation" in review)) throw new Error("expected a mainnet quote");
    expect(review.validation.status).toBe("checked");
    expect(review.slippageDisplay).toBe("50 bps (0.50%)");
    expect(review.completed).toBe(false);
    expect(review.signing).toBe("unavailable");
    expect(review.balance.usdcBalanceBase).toBe("4");
    expect(review.outputMint).toBe(USDC_MINT);
    expect(review.inputMint).toBe(WSOL_MINT);
    expect(JSON.stringify(review)).not.toContain(tx.slice(0, 80));
  });

  it("reports provider failure and an insufficient balance without moving funds", async () => {
    await expect(requestConversionQuote({
      inputMint: NATIVE_SOL_MINT,
      amountText: "0.01",
      assetKind: "native",
    }, {
      config: readConfig({ DFLOW_QUOTE_BASE_URL: "https://dflow.test" }),
      fetchImpl: () => Promise.resolve(new Response("upstream", { status: 500 })),
    })).rejects.toThrow(/DFlow quote failed \(500\)/);

    const review = await requestConversionQuote({
      inputMint: NATIVE_SOL_MINT,
      amountText: "0.01",
      assetKind: "native",
      walletAddress: PAYER,
    }, {
      config: readConfig({ DFLOW_QUOTE_BASE_URL: "https://dflow.test" }),
      now: () => 1_000,
      readBalances: async () => [sol(1_000n), usdc(7n)],
      fetchImpl: () => Promise.resolve(Response.json({
        inputMint: WSOL_MINT,
        inAmount: "10000000",
        outputMint: USDC_MINT,
        outAmount: "1200000",
        minOutAmount: "1194000",
        slippageBps: 50,
        platformFee: null,
        executionMode: "sync",
        contextSlot: 1,
      })),
    });
    if (!("balance" in review)) throw new Error("expected a quote");
    expect(review.balance.status).toBe("insufficient_input");
    expect(review.balance.usdcBalanceBase).toBe("7");
    expect(review.validation.status).toBe("rejected");
    expect(review.fundingGapIncludesQuote).toBe(false);
  });
});

function sol(amount: bigint): AssetBalance {
  return { mint: NATIVE_SOL_MINT, symbol: "SOL", name: "Solana", decimals: 9, amount, kind: "native", isUsdc: false, routeKnown: false, observed: true };
}

function usdc(amount: bigint): AssetBalance {
  return { mint: USDC_MINT, symbol: "USDC", name: "USD Coin", decimals: 6, amount, kind: "stablecoin", isUsdc: true, routeKnown: false, observed: true };
}
