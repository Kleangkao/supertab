/** DFlow submission. Sync confirms on Solana. Async also requires /order-status closed. */
import { encodeBase58 } from "./base58";
import { validateConversionTransaction, type DisclosedLookupTable } from "./conversion-review";
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
  if (input.context.inAmount !== input.approved.conversionInputLamports
    || input.context.minOutAmount !== input.approved.minimumOutputAtomic
    || input.context.slippageBps !== input.approved.slippageBps
    || input.context.prioritizationFeeLamports !== input.approved.prioritizationFeeLamports) {
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

export function sameFinancialSwap(context: SwapContext, approved: BoundTerms): boolean {
  return context.inAmount === approved.conversionInputLamports
    && context.minOutAmount === approved.minimumOutputAtomic
    && context.slippageBps === approved.slippageBps
    && context.prioritizationFeeLamports === approved.prioritizationFeeLamports
    && context.inputMint === WSOL_MINT
    && context.outputMint === USDC_MINT;
}
