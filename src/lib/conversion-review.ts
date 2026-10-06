import { associatedTokenAddress } from "../../merchant/ata";
import { CIRCLE_SOLANA_DEVNET_USDC_MINT } from "../../merchant/product";
import { decodeBase58, encodeBase58 } from "./base58";
import type { ConversionReview } from "./conversion-facts";
import { QUOTE_FRESHNESS_MS, type DflowQuote } from "./dflow";
import { formatFixedMinor } from "./money";
import { RECORDED_TEE_MERCHANT_TOTAL_USDC_BASE, recordedTeeQuote } from "./recorded-merchant-quote";
import {
  DEFAULT_SOL_RESERVE_LAMPORTS,
  NATIVE_SOL_MINT,
  USDC_DECIMALS,
  USDC_MINT,
  WSOL_MINT,
  knownMintMetadata,
} from "./tokens";

export const DFLOW_SWAP_PROGRAM = "DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH";
export const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const VALIDATION_LIMITS = "Checked from the unsigned transaction and DFlow's disclosed lookup tables. Not simulated, not signed, and not sent. A checked result is not a completed conversion.";

const TOKEN_FORBIDDEN = new Map<number, string>([
  [4, "Approve"],
  [6, "SetAuthority"],
  [7, "MintTo"],
  [8, "Burn"],
  [11, "FreezeAccount"],
  [13, "ApproveChecked"],
  [14, "MintToChecked"],
  [15, "BurnChecked"],
]);

export class ConversionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionInputError";
  }
}

export interface ResolvedConversionAsset {
  walletMint: string;
  quotedMint: string;
  decimals: number | null;
  symbol: string | null;
  kind: "native" | "spl";
  known: boolean;
}

export function resolveConversionAsset(mint: string, kind: "native" | "spl"): ResolvedConversionAsset {
  if (kind === "native" || mint === NATIVE_SOL_MINT) {
    if (mint !== NATIVE_SOL_MINT && mint !== WSOL_MINT) {
      throw new ConversionInputError("Native SOL is the only native asset this quote accepts.");
    }
    return { walletMint: NATIVE_SOL_MINT, quotedMint: WSOL_MINT, decimals: 9, symbol: "SOL", kind: "native", known: true };
  }
  if (!isMintAddress(mint)) {
    throw new ConversionInputError("Use the mint address. A token symbol is not a mint.");
  }
  if (mint === USDC_MINT) {
    throw new ConversionInputError("Mainnet USDC is the output asset, not a conversion input.");
  }
  if (mint === CIRCLE_SOLANA_DEVNET_USDC_MINT) {
    throw new ConversionInputError("Circle devnet USDC is a different mint from mainnet USDC and cannot be quoted on mainnet.");
  }
  const known = knownMintMetadata(mint);
  return {
    walletMint: mint,
    quotedMint: mint,
    decimals: known?.decimals ?? null,
    symbol: known?.symbol ?? null,
    kind: "spl",
    known: known != null,
  };
}

export function parseExactTokenAmount(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new ConversionInputError("Token decimals are not usable.");
  }
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new ConversionInputError("Enter the input amount as a decimal number.");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    throw new ConversionInputError(`This token has ${decimals} decimals. Extra digits were not rounded.`);
  }
  const scale = 10n ** BigInt(decimals);
  const fractionBase = fraction.length === 0 ? 0n : BigInt(fraction.padEnd(decimals, "0"));
  const amount = BigInt(whole!) * scale + fractionBase;
  if (amount <= 0n) throw new ConversionInputError("The input amount must be greater than zero.");
  return amount;
}

export function conversionQuoteExpired(expiresAt: string, nowMs: number): boolean {
  const expires = Date.parse(expiresAt);
  return !Number.isFinite(expires) || nowMs >= expires;
}

export function assessConversionBalance(input: {
  kind: "native" | "spl";
  assetAmount: bigint;
  solLamports: bigint;
  inputAmount: bigint;
  reserveLamports?: bigint;
}): ConversionReview["balance"] {
  const reserve = input.reserveLamports ?? DEFAULT_SOL_RESERVE_LAMPORTS;
  const reserveDisplay = `${formatFixedMinor(reserve, 9)} SOL`;
  if (input.kind === "native") {
    if (input.inputAmount > input.assetAmount) {
      return { status: "insufficient_input", detail: "The wallet's SOL balance is below the requested input.", usdcBalanceBase: null, usdcBalanceDisplay: null };
    }
    const spendable = input.solLamports > reserve ? input.solLamports - reserve : 0n;
    if (input.inputAmount > spendable) {
      return {
        status: "insufficient_sol_fee",
        detail: `The requested SOL would spend the ${reserveDisplay} kept for network fees.`,
        usdcBalanceBase: null,
        usdcBalanceDisplay: null,
      };
    }
    return { status: "sufficient", detail: `${reserveDisplay} stays untouched for network fees.`, usdcBalanceBase: null, usdcBalanceDisplay: null };
  }
  if (input.inputAmount > input.assetAmount) {
    return { status: "insufficient_input", detail: "The wallet balance of this mint is below the requested input.", usdcBalanceBase: null, usdcBalanceDisplay: null };
  }
  if (input.solLamports < reserve) {
    return {
      status: "insufficient_sol_fee",
      detail: `This wallet has less than ${reserveDisplay}, so it cannot cover a Solana network fee.`,
      usdcBalanceBase: null,
      usdcBalanceDisplay: null,
    };
  }
  return { status: "sufficient", detail: `${reserveDisplay} is available for network fees. The token input is separate.`, usdcBalanceBase: null, usdcBalanceDisplay: null };
}

export interface DisclosedLookupTable {
  address: string;
  addresses: Record<string, string>;
}

export function parseDisclosedLookupTables(value: unknown): DisclosedLookupTable[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new ConversionInputError("DFlow lookup tables were unreadable.");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new ConversionInputError("DFlow lookup tables were unreadable.");
    const record = entry as Record<string, unknown>;
    if (!isMintAddress(typeof record.address === "string" ? record.address : "")) {
      throw new ConversionInputError("DFlow lookup tables were unreadable.");
    }
    if (!record.addresses || typeof record.addresses !== "object" || Array.isArray(record.addresses)) {
      throw new ConversionInputError("DFlow lookup tables were unreadable.");
    }
    const addresses: Record<string, string> = {};
    for (const [index, address] of Object.entries(record.addresses)) {
      if (!/^\d+$/.test(index) || typeof address !== "string" || !isMintAddress(address)) {
        throw new ConversionInputError("DFlow lookup tables were unreadable.");
      }
      addresses[index] = address;
    }
    return { address: record.address as string, addresses };
  });
}

export function decodeTransaction(encoded: string): Uint8Array | null {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padding);
  const bytes = Buffer.from(padded, "base64");
  if (bytes.length === 0) return null;
  if (Buffer.from(bytes).toString("base64").replace(/=+$/, "") !== padded.replace(/=+$/, "")) return null;
  return bytes;
}

export function validateConversionTransaction(input: {
  transaction: Uint8Array;
  payer: string;
  inputMint: string;
  outputMint: string;
  inAmount: bigint;
  outAmount: bigint;
  minOutAmount: bigint;
  lookupTables: DisclosedLookupTable[];
  prioritizationFeeLamports: bigint | null;
  executionMode: string | null;
  /** Quote review stays synchronous. Submission may also accept a documented async order. */
  allowAsync?: boolean;
}): ConversionReview["validation"] {
  const rejected = (explanation: string): ConversionReview["validation"] => ({
    status: "rejected",
    explanation,
    limits: VALIDATION_LIMITS,
  });
  if (input.executionMode !== "sync" && !(input.allowAsync === true && input.executionMode === "async")) {
    return rejected("DFlow did not return a synchronous conversion, so the transaction terms are not accepted.");
  }
  if (input.outputMint !== USDC_MINT) {
    return rejected("The output mint is not mainnet USDC.");
  }
  const parsed = parseUnsignedTransaction(input.transaction);
  if ("error" in parsed) return rejected(parsed.error);
  if (!parsed.signaturesAreZero) return rejected("The transaction is already signed. SuperTab will not forward it.");
  if (parsed.requiredSignatures !== 1) {
    return rejected("The transaction asks for an additional signer. That permission is not part of this quote.");
  }
  if (parsed.payer !== input.payer) {
    return rejected("The transaction fee payer does not match the wallet that requested the quote.");
  }
  const resolved = resolveKeys(parsed, input.lookupTables);
  if ("error" in resolved) return rejected(resolved.error);
  if (!resolved.keys.includes(input.inputMint) || !resolved.keys.includes(input.outputMint)) {
    return rejected("The unsigned transaction does not include the quoted input and output mints.");
  }
  let outputDestination: string;
  try {
    outputDestination = associatedTokenAddress(input.payer, input.outputMint);
  } catch {
    return rejected("The output destination could not be derived for this payer and mint.");
  }
  if (!resolved.keys.includes(outputDestination)) {
    return rejected("The payer's mainnet USDC account is not in the unsigned transaction, so the output destination is unverifiable.");
  }
  const fee = inspectInstructions(parsed, resolved.keys, input);
  if ("error" in fee) return rejected(fee.error);
  if (input.prioritizationFeeLamports == null || fee.priorityLamports !== input.prioritizationFeeLamports) {
    return rejected("The transaction's prioritization fee does not match the fee DFlow disclosed.");
  }
  return {
    status: "checked",
    explanation: `Unsigned transaction for ${input.payer}. It includes the quoted input amount and expected USDC output, and the payer's mainnet USDC account. The minimum received is DFlow's quoted threshold${fee.minimumEmbedded ? " and is also present in the instruction data" : ""}. Prioritization fee ${fee.priorityLamports.toString()} lamports.`,
    limits: VALIDATION_LIMITS,
  };
}

export function buildConversionReview(input: {
  asset: ResolvedConversionAsset;
  decimals: number;
  quote: DflowQuote;
  quotedAtMs: number;
  balance: ConversionReview["balance"];
  validation: ConversionReview["validation"];
}): ConversionReview {
  const quote = input.quote;
  const covers = quote.minOutAmount >= RECORDED_TEE_MERCHANT_TOTAL_USDC_BASE;
  const symbol = input.asset.symbol;
  return {
    label: "Asset conversion — quote only",
    execution: "quote_only",
    completed: false,
    signing: "unavailable",
    broadcast: "unavailable",
    provider: "DFlow",
    network: "solana:mainnet-beta",
    walletAssetMint: input.asset.walletMint,
    inputMint: quote.inputMint,
    outputMint: quote.outputMint,
    inputSymbol: symbol,
    inputDecimals: input.decimals,
    outputDecimals: USDC_DECIMALS,
    inputAmountBase: quote.inAmount.toString(),
    inputAmountDisplay: amountLabel(quote.inAmount, input.decimals, symbol),
    estimatedOutputBase: quote.outAmount.toString(),
    estimatedOutputDisplay: amountLabel(quote.outAmount, USDC_DECIMALS, "USDC"),
    minimumOutputBase: quote.minOutAmount.toString(),
    minimumOutputDisplay: amountLabel(quote.minOutAmount, USDC_DECIMALS, "USDC"),
    slippageBps: quote.slippageBps,
    slippageDisplay: quote.slippageBps == null ? "Not reported" : `${quote.slippageBps} bps (${formatBps(quote.slippageBps)})`,
    platformFee: platformFeeDisplay(quote),
    prioritizationFeeLamports: quote.prioritizationFeeLamports?.toString() ?? null,
    networkFee: networkFeeDisplay(quote.prioritizationFeeLamports),
    quotedAt: new Date(input.quotedAtMs).toISOString(),
    expiresAt: new Date(input.quotedAtMs + QUOTE_FRESHNESS_MS).toISOString(),
    lastValidBlockHeight: quote.lastValidBlockHeight,
    contextSlot: quote.contextSlot,
    executionMode: quote.executionMode,
    coverage: {
      comparedWith: "recorded Solana Spaces quote, October 5, 2026",
      recordedMerchantTotal: recordedTeeQuote.merchantTotal,
      recordedUsdcBase: RECORDED_TEE_MERCHANT_TOTAL_USDC_BASE.toString(),
      minimumCoversRecordedTotal: covers,
      note: `The minimum received is ${covers ? "at least" : "below"} the recorded October 5, 2026 Solana Spaces total of ${recordedTeeQuote.merchantTotal}. This is a comparison with recorded evidence, not a current payable total. It does not reduce a funding gap or change the USDC balance.`,
    },
    balance: input.balance,
    walletUsdcIncludesQuote: false,
    fundingGapIncludesQuote: false,
    validation: input.validation,
  };
}

function amountLabel(amount: bigint, decimals: number, symbol: string | null): string {
  return `${formatFixedMinor(amount, decimals)} ${symbol ?? "tokens"}`;
}

function formatBps(bps: number): string {
  const sign = bps < 0 ? "-" : "";
  const abs = Math.abs(bps);
  const whole = Math.trunc(abs / 100);
  return `${sign}${whole}.${(abs % 100).toString().padStart(2, "0")}%`;
}

function platformFeeDisplay(quote: DflowQuote): string {
  if (quote.platformFeeAmount == null && quote.platformFeeBps == null) return "DFlow reported no platform fee.";
  const amount = quote.platformFeeAmount == null ? "an unreadable amount" : `${quote.platformFeeAmount.toString()} base units`;
  const bps = quote.platformFeeBps == null ? "an unreadable rate" : `${quote.platformFeeBps} bps`;
  const mode = quote.platformFeeMode ?? "unspecified mode";
  return `DFlow platform fee ${amount} at ${bps} (${mode}).`;
}

function networkFeeDisplay(priority: bigint | null): string {
  if (priority == null) {
    return "DFlow did not report a prioritization fee on this quote-only response. A Solana base fee would be paid in SOL only if a transaction were signed and sent. Nothing was signed or sent.";
  }
  return `DFlow reported a prioritization fee of ${priority.toString()} lamports. The Solana base fee is separate and is not charged by this quote. Nothing was signed or sent.`;
}

function isMintAddress(value: string): boolean {
  return decodeBase58(value)?.length === 32;
}

interface ParsedTransaction {
  requiredSignatures: number;
  payer: string;
  signaturesAreZero: boolean;
  staticKeys: string[];
  instructions: { programIndex: number; data: Uint8Array }[];
  lookups: { table: string; writable: number[]; readonly: number[] }[];
}

function parseUnsignedTransaction(bytes: Uint8Array): ParsedTransaction | { error: string } {
  try {
    if (bytes.length > 1232) return { error: "The transaction is larger than a Solana packet." };
    let offset = 0;
    const byte = () => {
      if (offset >= bytes.length) throw new Error("truncated");
      return bytes[offset++]!;
    };
    const count = () => {
      let value = 0;
      for (let shift = 0; shift <= 14; shift += 7) {
        const part = byte();
        if (shift === 14 && part > 3) throw new Error("compact");
        value |= (part & 127) << shift;
        if ((part & 128) === 0) {
          if (shift > 0 && part === 0) throw new Error("compact");
          return value;
        }
      }
      throw new Error("compact");
    };
    const take = (length: number) => {
      if (offset + length > bytes.length) throw new Error("truncated");
      const part = bytes.subarray(offset, offset + length);
      offset += length;
      return part;
    };
    const signatures = count();
    if (signatures !== 1) return { error: "The transaction asks for an additional signer. That permission is not part of this quote." };
    const signature = take(64);
    const marker = byte();
    const versioned = (marker & 128) !== 0;
    if (versioned && marker !== 128) return { error: "The transaction version is not supported." };
    const required = versioned ? byte() : marker;
    const readonlySigned = byte();
    const readonlyUnsigned = byte();
    const accounts = count();
    if (required !== signatures || accounts < required || accounts > 256 || readonlySigned >= required || readonlyUnsigned > accounts - required) {
      return { error: "The transaction header does not describe one fee payer." };
    }
    const staticKeys: string[] = [];
    for (let index = 0; index < accounts; index += 1) staticKeys.push(encodeBase58(take(32)));
    take(32);
    const instructionCount = count();
    if (instructionCount < 1 || instructionCount > 64) return { error: "The transaction instructions are not usable." };
    const instructions = Array.from({ length: instructionCount }, () => {
      const programIndex = byte();
      const accountIndexes = Array.from({ length: count() }, () => byte());
      const data = Uint8Array.from(take(count()));
      return { programIndex, accountIndexes, data };
    });
    const lookups: ParsedTransaction["lookups"] = [];
    if (versioned) {
      const tables = count();
      for (let index = 0; index < tables; index += 1) {
        const table = encodeBase58(take(32));
        const writable = Array.from({ length: count() }, () => byte());
        const readonly = Array.from({ length: count() }, () => byte());
        lookups.push({ table, writable, readonly });
      }
    }
    if (offset !== bytes.length) return { error: "The transaction has trailing bytes." };
    const keyCount = accounts + lookups.reduce((sum, lookup) => sum + lookup.writable.length + lookup.readonly.length, 0);
    for (const instruction of instructions) {
      if (instruction.programIndex >= keyCount || instruction.accountIndexes.some((index) => index >= keyCount)) {
        return { error: "The transaction references an account it does not list." };
      }
    }
    return {
      requiredSignatures: required,
      payer: staticKeys[0] ?? "",
      signaturesAreZero: signature.every((part) => part === 0),
      staticKeys,
      instructions: instructions.map(({ programIndex, data }) => ({ programIndex, data })),
      lookups,
    };
  } catch {
    return { error: "The unsigned transaction could not be read." };
  }
}

function resolveKeys(parsed: ParsedTransaction, tables: DisclosedLookupTable[]): { keys: string[] } | { error: string } {
  const writable: string[] = [];
  const readonly: string[] = [];
  for (const lookup of parsed.lookups) {
    const table = tables.find((item) => item.address === lookup.table);
    if (!table) return { error: "The transaction uses a lookup table DFlow did not disclose, so its accounts are unverifiable." };
    for (const index of lookup.writable) {
      const address = table.addresses[String(index)];
      if (!address) return { error: "A lookup-table account was not disclosed, so the transaction is unverifiable." };
      writable.push(address);
    }
    for (const index of lookup.readonly) {
      const address = table.addresses[String(index)];
      if (!address) return { error: "A lookup-table account was not disclosed, so the transaction is unverifiable." };
      readonly.push(address);
    }
  }
  return { keys: [...parsed.staticKeys, ...writable, ...readonly] };
}

function inspectInstructions(
  parsed: ParsedTransaction,
  keys: string[],
  expected: { inAmount: bigint; outAmount: bigint; minOutAmount: bigint },
): { priorityLamports: bigint; minimumEmbedded: boolean } | { error: string } {
  let units: bigint | null = null;
  let price: bigint | null = null;
  let sawInput = false;
  let sawOutput = false;
  let sawMinimum = false;
  const inputBytes = u64Bytes(expected.inAmount);
  const outputBytes = u64Bytes(expected.outAmount);
  const minimumBytes = u64Bytes(expected.minOutAmount);
  for (const instruction of parsed.instructions) {
    const program = keys[instruction.programIndex];
    if (!program) return { error: "The transaction references a program it does not list." };
    if (program === COMPUTE_BUDGET_PROGRAM) {
      const data = instruction.data;
      if (data[0] === 2 && data.length === 5 && units == null) units = readU32(data, 1);
      else if (data[0] === 3 && data.length === 9 && price == null) price = readU64(data, 1);
      else return { error: "The transaction includes an unexpected compute-budget instruction." };
      continue;
    }
    if (program === TOKEN_PROGRAM || program === TOKEN_2022_PROGRAM) {
      const tokenError = inspectTokenInstruction(instruction.data, expected);
      if (tokenError) return { error: tokenError };
      continue;
    }
    if (program !== DFLOW_SWAP_PROGRAM) {
      return { error: "The unsigned transaction includes an instruction this check cannot verify." };
    }
    if (containsBytes(instruction.data, inputBytes)) sawInput = true;
    if (containsBytes(instruction.data, outputBytes)) sawOutput = true;
    if (containsBytes(instruction.data, minimumBytes)) sawMinimum = true;
  }
  if (units == null || price == null) return { error: "The unsigned transaction does not disclose a compute budget, so its network fee cannot be checked." };
  if (!sawInput || !sawOutput) {
    return { error: "The unsigned transaction does not contain the quoted input and expected output, so its terms are unverifiable." };
  }
  const priorityLamports = (units * price + 999_999n) / 1_000_000n;
  return { priorityLamports, minimumEmbedded: sawMinimum };
}

function inspectTokenInstruction(
  data: Uint8Array,
  expected: { inAmount: bigint; outAmount: bigint; minOutAmount: bigint },
): string | null {
  const disc = data[0];
  if (disc == null) return "The unsigned transaction includes an empty token instruction.";
  const forbidden = TOKEN_FORBIDDEN.get(disc);
  if (forbidden) return `The unsigned transaction asks for token ${forbidden}. That additional permission is rejected.`;
  if (disc === 9 || disc === 17) return data.length === 1 ? null : "The unsigned transaction includes a token instruction this check cannot verify.";
  if (disc !== 3 && disc !== 12) return "The unsigned transaction includes a token instruction this check cannot verify.";
  const amount = data.length >= 9 ? readU64(data, 1) : null;
  if (amount == null || (disc === 3 && data.length !== 9) || (disc === 12 && data.length !== 10)) {
    return "The unsigned transaction includes a token transfer this check cannot verify.";
  }
  if (amount !== expected.inAmount && amount !== expected.outAmount && amount !== expected.minOutAmount) {
    return "A token transfer amount does not match the quoted input, expected output, or minimum received.";
  }
  return null;
}

function u64Bytes(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  let rest = value;
  for (let index = 0; index < 8; index += 1) {
    bytes[index] = Number(rest & 255n);
    rest >>= 8n;
  }
  return bytes;
}

function containsBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length > haystack.length) return false;
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    let match = true;
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[start + index] !== needle[index]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

function readU32(data: Uint8Array, offset: number): bigint {
  return BigInt(data[offset]!) | (BigInt(data[offset + 1]!) << 8n) | (BigInt(data[offset + 2]!) << 16n) | (BigInt(data[offset + 3]!) << 24n);
}

function readU64(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let index = 0; index < 8; index += 1) value |= BigInt(data[offset + index]!) << (8n * BigInt(index));
  return value;
}
