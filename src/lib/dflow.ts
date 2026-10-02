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
        : { status: "insufficient" };
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
    return { status: "insufficient" };
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
