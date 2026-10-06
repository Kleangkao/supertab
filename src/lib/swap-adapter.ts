/** DFlow submission. Sync confirms on Solana. Async also requires /order-status closed. */
import { encodeBase58 } from "./base58";
import { validateConversionTransaction, type DisclosedLookupTable } from "./conversion-review";
import { EXPECTED_AMOUNT_ATOMIC, SOL_BASE_FEE_LAMPORTS } from "./digital-purchase";
import { USDC_MINT, WSOL_MINT } from "./tokens";
import { assertSignedMessage, type BoundTerms } from "./purchase-workflow";
import type { SwapContext } from "./purchase-journal";

export class SwapSubmissionLost extends Error {
  constructor() {
    super("The swap response was lost. The original transaction was not replaced.");
    this.name = "SwapSubmissionLost";
  }
}

export class SwapAlreadyProcessed extends Error {
  constructor() {
    super("The swap was already processed. The original transaction was not replaced.");
    this.name = "SwapAlreadyProcessed";
  }
}

export function transactionSignature(bytes: Uint8Array, slot = 0): string {
  const count = bytes[0];
  if (count == null || count < 1 || count > 8) throw new Error("The transaction signature list is not usable.");
  const signature = bytes.subarray(1 + slot * 64, 1 + (slot + 1) * 64);
  if (signature.length !== 64 || signature.every((byte) => byte === 0)) throw new Error("The transaction signature slot is empty.");
  return encodeBase58(signature);
}

export function messageOf(transaction: Uint8Array): Uint8Array {
  const count = transaction[0];
  if (count == null || count < 1 || count > 8) throw new Error("The transaction signature list is not usable.");
  return transaction.subarray(1 + count * 64);
}

export function transactionBlockhash(transaction: Uint8Array): string {
  const message = messageOf(transaction);
  const marker = message[0] ?? 0;
  const versioned = (marker & 128) !== 0;
  let offset = versioned ? 4 : 3;
  const accounts = readCompact(message, offset);
  offset = accounts.next + accounts.value * 32;
  return encodeBase58(message.subarray(offset, offset + 32));
}

function readCompact(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let value = 0;
  let shift = 0;
  while (offset < bytes.length) {
    const part = bytes[offset++]!;
    value |= (part & 127) << shift;
    if ((part & 128) === 0) return { value, next: offset };
    shift += 7;
  }
  throw new Error("The transaction account list is truncated.");
}

export function revalidateSignedSwap(input: {
  signed: Uint8Array;
  retainedMessage: Uint8Array;
  shopper: string;
  context: SwapContext;
  approved: BoundTerms;
}): void {
  if (input.context.executionMode !== "sync") {
    throw new Error("An async swap is not signed for this purchase.");
  }
  if (input.context.inputMint !== WSOL_MINT || input.context.outputMint !== USDC_MINT) {
    throw new Error("The swap mints do not match the approval.");
  }
  if (!sameFinancialSwap(input.context, input.approved)) {
    throw new Error("The swap terms do not match the approval.");
  }
  assertSignedMessage({
    signedTransaction: input.signed,
    retainedMessage: input.retainedMessage,
    shopper: input.shopper,
    shopperSlot: 0,
    sponsorMustBeAbsent: false,
  });
  const unsigned = new Uint8Array(input.signed);
  unsigned.fill(0, 1, 1 + unsigned[0]! * 64);
  const tables: DisclosedLookupTable[] = input.context.lookupTables;
  const checked = validateConversionTransaction({
    transaction: unsigned,
    payer: input.shopper,
    inputMint: input.context.inputMint,
    outputMint: input.context.outputMint,
    inAmount: BigInt(input.context.inAmount),
    outAmount: BigInt(input.context.outAmount),
    minOutAmount: BigInt(input.context.minOutAmount),
    lookupTables: tables,
    prioritizationFeeLamports: BigInt(input.context.prioritizationFeeLamports),
    executionMode: input.context.executionMode,
    allowAsync: false,
  });
  if (checked.status !== "checked") throw new Error(checked.explanation);
}

export function conversionFitsAuthorization(order: {
  inAmount: string;
  minOutAmount: string;
  slippageBps: number;
  prioritizationFeeLamports: string;
  inputMint: string;
  outputMint: string;
}, approved: BoundTerms, ceilingLamports: bigint): string | null {
  if (order.inputMint !== WSOL_MINT || order.outputMint !== USDC_MINT) return "The conversion mints changed.";
  if (approved.slippageBps == null || order.slippageBps > approved.slippageBps) return "The conversion slippage is above the approved slippage.";
  if (!/^\d+$/.test(order.minOutAmount) || BigInt(order.minOutAmount) < EXPECTED_AMOUNT_ATOMIC) {
    return "The minimum USDC does not cover 1.000000 USDC.";
  }
  if (!/^\d+$/.test(order.inAmount) || !/^\d+$/.test(order.prioritizationFeeLamports) || BigInt(order.inAmount) <= 0n) {
    return "The conversion amounts are not usable.";
  }
  const total = BigInt(order.inAmount) + BigInt(order.prioritizationFeeLamports) + SOL_BASE_FEE_LAMPORTS;
  if (total > ceilingLamports) return "The conversion costs more SOL than the authorized limit.";
  return null;
}

export function sameFinancialSwap(context: SwapContext, approved: BoundTerms): boolean {
  if (!approved.minimumOutputAtomic || !/^\d+$/.test(context.minOutAmount)
    || !/^\d+$/.test(context.prioritizationFeeLamports)) return false;
  return context.inAmount === approved.conversionInputLamports
    && BigInt(context.minOutAmount) >= BigInt(approved.minimumOutputAtomic)
    && context.slippageBps === approved.slippageBps
    && BigInt(context.prioritizationFeeLamports) <= BigInt(approved.prioritizationFeeLamports)
    && BigInt(context.inAmount) + BigInt(context.prioritizationFeeLamports) + 5_000n <= BigInt(approved.solCapLamports)
    && context.inputMint === WSOL_MINT
    && context.outputMint === USDC_MINT;
}
