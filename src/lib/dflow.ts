import { ceilDiv } from "./money";
import { USDC_MINT } from "./tokens";

/** DFlow does not return an expiry on a quote-only order. SuperTab refuses the quote after this window. */
export const QUOTE_FRESHNESS_MS = 45_000;

export class DflowRouteError extends Error {
  readonly code = "NO_ROUTE";

  constructor(message = "DFlow did not return a route for this pair and amount.") {
    super(message);
    this.name = "DflowRouteError";
  }
}

export interface DflowQuote {
  inputMint: string;
  outputMint: string;
  inAmount: bigint;
  outAmount: bigint;
  minOutAmount: bigint;
  slippageBps: number | null;
  priceImpactPct: string | null;
  platformFeeText: string | null;
  platformFeeAmount: bigint | null;
  platformFeeBps: number | null;
  platformFeeMode: string | null;
  prioritizationFeeLamports: bigint | null;
  contextSlot: number | null;
  lastValidBlockHeight: number | null;
  executionMode: string | null;
  transactionPresent: boolean;
}

export interface DflowClientOptions {
  baseUrl: string;
  apiKey?: string;
  slippageBps?: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
  /** Ask DFlow for a synchronous route. An async response is still rejected by the purchase adapter. */
  syncOnly?: boolean;
}

export function solanaTransactionSummary(encoded: string): {
  valid: boolean;
  version: "legacy" | "v0" | null;
  byteLength: number;
} {
  const bytes = decodeTransactionBytes(encoded);
  if (!bytes || bytes.length < 1 + 64 + 3) {
    return { valid: false, version: null, byteLength: bytes?.length ?? 0 };
  }
  const invalid = { valid: false, version: null, byteLength: bytes.length };
  // Structural validation only, not simulation or verification of program semantics.
  // https://solana.com/docs/core/transactions/transaction-structure
  let at = 0;
  const readByte = () => { if (at >= bytes.length) throw new Error("Truncated transaction"); return bytes[at++]!; };
  const readLength = () => {
    let value = 0;
    for (let shift = 0; shift <= 14; shift += 7) {
      const byte = readByte();
      if (shift === 14 && byte > 3) throw new Error("Invalid compact-u16");
      value |= (byte & 127) << shift;
      if ((byte & 128) === 0) {
        if (shift > 0 && byte === 0) throw new Error("Non-canonical compact-u16");
        return value;
      }
    }
    throw new Error("Invalid compact-u16");
  };
  const take = (length: number) => {
    if (at + length > bytes.length) throw new Error("Truncated transaction");
    const part = bytes.subarray(at, at + length); at += length; return part;
  };
  try {
    if (bytes.length > 1232) return invalid;
    const signatures = readLength();
    if (signatures < 1 || signatures > 8) return invalid;
    // This path must only accept unsigned transactions.
    if (take(signatures * 64).some(byte => byte !== 0)) return invalid;
    const marker = readByte();
    const version = (marker & 128) === 0 ? "legacy" : "v0";
    if (version === "v0" && marker !== 128) return invalid;
    const required = version === "v0" ? readByte() : marker;
    const readonlySigned = readByte();
    const readonlyUnsigned = readByte();
    const accounts = readLength();
    if (required !== signatures || accounts < required || accounts > 256 || readonlySigned >= required || readonlyUnsigned > accounts - required) return invalid;
    take(accounts * 32); take(32);
    const instructions = readLength();
    if (instructions < 1) return invalid;
    const referenced: number[] = [];
    for (let index = 0; index < instructions; index++) {
      const programIndex = readByte();
      if (programIndex >= accounts) return invalid;
      referenced.push(...take(readLength()));
      take(readLength());
    }
    let loaded = 0;
    if (version === "v0") {
      const tables = readLength();
      for (let index = 0; index < tables; index++) {
        take(32);
        const writable = readLength(); take(writable);
        const readonly = readLength(); take(readonly);
        loaded += writable + readonly;
      }
    }
    if (accounts + loaded > 256 || referenced.some(index => index >= accounts + loaded) || at !== bytes.length) return invalid;
    return { valid: true, version, byteLength: bytes.length };
  } catch { return invalid; }
}

function decodeTransactionBytes(encoded: string): Buffer | null {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padding);
  const bytes = Buffer.from(padded, "base64");
  if (bytes.length === 0) return null;
  if (Buffer.from(bytes).toString("base64").replace(/=+$/, "") !== padded.replace(/=+$/, "")) return null;
  return bytes;
}

export async function fetchPreparedTransaction(
  input: { inputMint: string; outputMint: string; amount: bigint; userPublicKey: string },
  options: DflowClientOptions,
): Promise<{ prepared: false } | { prepared: true; version: "legacy" | "v0"; byteLength: number; quote: DflowQuote }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    amount: input.amount.toString(),
    slippageBps: String(options.slippageBps ?? 50),
    userPublicKey: input.userPublicKey,
  });
  if (input.inputMint === "So11111111111111111111111111111111111111112") {
    params.set("wrapAndUnwrapSol", "true");
  }
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.apiKey) headers["x-api-key"] = options.apiKey;
  const response = await fetchImpl(`${options.baseUrl.replace(/\/$/, "")}/order?${params.toString()}`, {
    headers,
    signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
  });
  const text = await response.text();
  const payload = text ? safeJson(text) : null;
  if (!response.ok || !payload || typeof payload !== "object") return { prepared: false };
  const record = payload as Record<string, unknown>;
  const quote = parseDflowOrder(payload);
  if (quote.inputMint !== input.inputMint || quote.outputMint !== input.outputMint || quote.inAmount !== input.amount) {
    return { prepared: false };
  }
  const encoded = typeof record.transaction === "string" ? record.transaction : "";
  const summary = solanaTransactionSummary(encoded);
  if (!summary.valid || !summary.version) return { prepared: false };
  return { prepared: true, version: summary.version, byteLength: summary.byteLength, quote };
}

export function parseDflowOrder(payload: unknown): DflowQuote {
  if (!payload || typeof payload !== "object") {
    throw new Error("DFlow returned an unreadable quote.");
  }
  const record = payload as Record<string, unknown>;
  const inputMint = requiredString(record.inputMint, "inputMint");
  const outputMint = requiredString(record.outputMint, "outputMint");
  const inAmount = requiredBaseUnits(record.inAmount, "inAmount");
  const outAmount = requiredBaseUnits(record.outAmount, "outAmount");
  const minOutAmount = requiredBaseUnits(record.minOutAmount ?? record.otherAmountThreshold, "minOutAmount");
  if (outAmount < 0n || inAmount <= 0n || minOutAmount < 0n) {
    throw new Error("DFlow quote amounts are not usable.");
  }
  if (minOutAmount > outAmount) {
    throw new Error("DFlow minimum output is above the expected output.");
  }
  return {
    inputMint,
    outputMint,
    inAmount,
    outAmount,
    minOutAmount,
    slippageBps: typeof record.slippageBps === "number" ? record.slippageBps : null,
    priceImpactPct: typeof record.priceImpactPct === "string" ? record.priceImpactPct : null,
    platformFeeText: platformFeeLabel(record.platformFee),
    ...readPlatformFee(record.platformFee),
    prioritizationFeeLamports: readLamports(record.prioritizationFeeLamports),
    contextSlot: typeof record.contextSlot === "number" ? record.contextSlot : null,
    lastValidBlockHeight: typeof record.lastValidBlockHeight === "number" ? record.lastValidBlockHeight : null,
    executionMode: typeof record.executionMode === "string" ? record.executionMode : null,
    transactionPresent: typeof record.transaction === "string" && record.transaction.length > 0,
  };
}

export function priceImpactPercentLabel(raw: string | null): string | null {
  if (raw == null) return null;
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  const value = BigInt(digits || "0");
  const shift = fraction.length;
  let text: string;
  if (shift <= 2) {
    text = (value * 10n ** BigInt(2 - shift)).toString();
  } else {
    const divisor = 10n ** BigInt(shift - 2);
    const wholeOut = value / divisor;
    const remainder = (value % divisor).toString().padStart(shift - 2, "0").replace(/0+$/, "");
    text = remainder ? `${wholeOut}.${remainder}` : wholeOut.toString();
  }
  return `${negative ? "-" : ""}${text}%`;
}

export async function fetchDflowOrder(
  input: { inputMint: string; outputMint: string; amount: bigint; userPublicKey?: string },
  options: DflowClientOptions,
): Promise<DflowQuote> {
  if (input.amount <= 0n) throw new Error("Quote amount must be positive.");
  const fetchImpl = options.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    amount: input.amount.toString(),
    slippageBps: String(options.slippageBps ?? 50),
  });
  if (input.inputMint === "So11111111111111111111111111111111111111112") {
    params.set("wrapAndUnwrapSol", "true");
  }
  if (input.userPublicKey) params.set("userPublicKey", input.userPublicKey);
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.apiKey) headers["x-api-key"] = options.apiKey;
  const response = await fetchImpl(`${options.baseUrl.replace(/\/$/, "")}/order?${params.toString()}`, {
    headers,
    signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
  });
  const text = await response.text();
  const payload = text ? safeJson(text) : null;
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "msg" in payload
      ? String((payload as { msg?: unknown }).msg ?? "")
      : "";
    if (response.status === 400 || /route|liquidity/i.test(message)) {
      throw new DflowRouteError(message || undefined);
    }
    throw new Error(`DFlow quote failed (${response.status}).`);
  }
  const quote = parseDflowOrder(payload);
  if (quote.inputMint !== input.inputMint || quote.outputMint !== input.outputMint) {
    throw new Error("DFlow quote mints did not match the request.");
  }
  if (quote.inAmount !== input.amount) {
    throw new Error("DFlow quote input amount did not match the request.");
  }
  return quote;
}

export async function quoteInputForTargetOutput(input: {
  inputMint: string;
  outputMint?: string;
  inputDecimals: number;
  spendable: bigint;
  targetOut: bigint;
  options: DflowClientOptions;
}): Promise<{ status: "quoted" | "insufficient" | "no_route"; quote?: DflowQuote }> {
  if (input.spendable <= 0n || input.targetOut <= 0n) return { status: "insufficient" };
  const outputMint = input.outputMint ?? USDC_MINT;
  const request = (amount: bigint) => fetchDflowOrder(
    { inputMint: input.inputMint, outputMint, amount },
    input.options,
  );
  try {
    const probe = probeAmount(input.inputDecimals, input.spendable);
    let quote = await request(probe);
    if (quote.outAmount <= 0n) return { status: "no_route" };
    const estimate = buffered(ceilDiv(input.targetOut * quote.inAmount, quote.outAmount));
    if (estimate > input.spendable) {
      if (quote.outAmount >= input.targetOut) return { status: "quoted", quote };
      quote = await request(input.spendable);
      return quote.outAmount >= input.targetOut
        ? { status: "quoted", quote }
        : { status: "insufficient", quote };
    }
    if (estimate !== quote.inAmount) quote = await request(estimate);
    if (quote.outAmount >= input.targetOut && quote.inAmount <= input.spendable) {
      return { status: "quoted", quote };
    }
    if (quote.outAmount > 0n) {
      const bumped = minBigint(input.spendable, buffered(ceilDiv(input.targetOut * quote.inAmount, quote.outAmount)));
      if (bumped !== quote.inAmount) {
        const again = await request(bumped);
        if (again.outAmount >= input.targetOut && again.inAmount <= input.spendable) {
          return { status: "quoted", quote: again };
        }
      }
    }
    return { status: "insufficient", quote };
  } catch (error) {
    if (error instanceof DflowRouteError) return { status: "no_route" };
    throw error;
  }
}

export function bindQuote(input: {
  quote: DflowQuote;
  payableMinor: bigint;
  fundingMint: string;
  inputDecimals: number;
  outputDecimals: number;
  nowMs: number;
}): import("./funding-planner").BoundQuote {
  return {
    quoteId: `${input.quote.contextSlot ?? "quote"}-${input.quote.inAmount.toString()}`,
    inputMint: input.quote.inputMint,
    outputMint: input.quote.outputMint,
    inAmount: input.quote.inAmount,
    outAmount: input.quote.outAmount,
    minOutAmount: input.quote.minOutAmount,
    inputDecimals: input.inputDecimals,
    outputDecimals: input.outputDecimals,
    priceImpactPct: input.quote.priceImpactPct,
    slippageBps: input.quote.slippageBps,
    platformFeeText: input.quote.platformFeeText,
    contextSlot: input.quote.contextSlot,
    expiresAtMs: input.nowMs + QUOTE_FRESHNESS_MS,
    receivedAtMs: input.nowMs,
    boundPayableMinor: input.payableMinor,
    boundFundingMint: input.fundingMint,
    execution: "quote_only",
  };
}

function probeAmount(decimals: number, spendable: bigint): bigint {
  const unit = 10n ** BigInt(decimals);
  const probe = decimals >= 9 ? unit / 100n : unit;
  return probe > 0n && probe < spendable ? probe : spendable;
}

function buffered(amount: bigint): bigint {
  const withBuffer = amount + amount / 50n;
  return withBuffer < 1n ? 1n : withBuffer;
}

function minBigint(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`DFlow quote is missing ${name}.`);
  return value;
}

function requiredBaseUnits(value: unknown, name: string): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(`DFlow quote is missing ${name}.`);
  }
  return BigInt(value);
}

function readPlatformFee(value: unknown): {
  platformFeeAmount: bigint | null;
  platformFeeBps: number | null;
  platformFeeMode: string | null;
} {
  if (!value || typeof value !== "object") {
    return { platformFeeAmount: null, platformFeeBps: null, platformFeeMode: null };
  }
  const record = value as Record<string, unknown>;
  const amount = typeof record.amount === "string" && /^\d+$/.test(record.amount) ? BigInt(record.amount) : null;
  const feeBps = typeof record.feeBps === "number" && Number.isInteger(record.feeBps) ? record.feeBps : null;
  const mode = typeof record.mode === "string" ? record.mode : null;
  return { platformFeeAmount: amount, platformFeeBps: feeBps, platformFeeMode: mode };
}

function readLamports(value: unknown): bigint | null {
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  return null;
}

export interface ConversionOrder {
  quote: DflowQuote;
  transactionBase64: string | null;
  lookupTables: unknown;
}

/** One DFlow order. A public key asks for an unsigned transaction and does not sign or send it. */
export async function fetchConversionOrder(
  input: { inputMint: string; outputMint: string; amount: bigint; userPublicKey?: string; wrapAndUnwrapSol?: boolean },
  options: DflowClientOptions,
): Promise<ConversionOrder> {
  if (input.amount <= 0n) throw new Error("Quote amount must be positive.");
  const fetchImpl = options.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    amount: input.amount.toString(),
    slippageBps: String(options.slippageBps ?? 50),
  });
  if (input.wrapAndUnwrapSol) params.set("wrapAndUnwrapSol", "true");
  if (input.userPublicKey) {
    params.set("userPublicKey", input.userPublicKey);
    params.set("includeAddressLookupTables", "true");
  }
  if (options.syncOnly) {
    params.set("allowSyncExec", "true");
    params.set("allowAsyncExec", "false");
  }
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.apiKey) headers["x-api-key"] = options.apiKey;
  const response = await fetchImpl(`${options.baseUrl.replace(/\/$/, "")}/order?${params.toString()}`, {
    headers,
    signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
  });
  const text = await response.text();
  const payload = text ? safeJson(text) : null;
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "msg" in payload
      ? String((payload as { msg?: unknown }).msg ?? "")
      : "";
    if (response.status === 400 || /route|liquidity/i.test(message)) {
      throw new DflowRouteError(message || undefined);
    }
    throw new Error(`DFlow quote failed (${response.status}).`);
  }
  const quote = parseDflowOrder(payload);
  if (quote.inputMint !== input.inputMint || quote.outputMint !== input.outputMint) {
    throw new Error("DFlow quote mints did not match the request.");
  }
  if (quote.inAmount !== input.amount) {
    throw new Error("DFlow quote input amount did not match the request.");
  }
  const record = payload as Record<string, unknown>;
  return {
    quote,
    transactionBase64: typeof record.transaction === "string" && record.transaction.length > 0 ? record.transaction : null,
    lookupTables: record.addressLookupTables ?? null,
  };
}

function platformFeeLabel(value: unknown): string | null {
  if (value == null) return "No platform fee was reported.";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.amount === "string") return `Platform fee ${record.amount} base units.`;
  }
  return "A platform fee was reported.";
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
