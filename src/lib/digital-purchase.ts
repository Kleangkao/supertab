import { createHash } from "node:crypto";
import { associatedTokenAddress } from "../../merchant/ata";
import { ceilDiv, formatFixedMinor } from "./money";
import { DEFAULT_SOL_RESERVE_LAMPORTS, USDC_DECIMALS, USDC_MINT } from "./tokens";
import { isPlausibleAddress } from "./wallet";

/** Public bytes this purchase would anchor. Not a secret and not a buyer identity. */
export const BITCOIN_ANCHOR_PREIMAGE = "SuperTab purchase probe 2026-10-05 bitcoin_anchor";

export const BITCOIN_ANCHOR_PRODUCT = {
  merchant: "SCVD General Store",
  operator: "Record Creative Co. LLC",
  listingUrl: "https://scvd.store/menu/bitcoin_anchor",
  productId: "bitcoin_anchor",
  productName: "A Bitcoin Anchor",
  quantity: 1,
} as const;

export const SOLANA_MAINNET_CAIP = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
/** Product price cap from the owner. A quote above this is not this purchase. */
export const PRODUCT_PRICE_CAP_ATOMIC = 2_000_000n;
/** One signature on a checked Solana transaction. Not a priority fee. */
export const SOL_BASE_FEE_LAMPORTS = 5_000n;
/** This review is for the $1 listing, not any cheaper or dearer quote. */
export const EXPECTED_AMOUNT_ATOMIC = 1_000_000n;
/** Last reviewed merchant recipient. A different account is a different payment. */
export const REVIEWED_MERCHANT_RECIPIENT = "DGxcPrAHL9YM3hW7iXuHFJmr87Zr6AMA4jCYHBpuvMgE";
/** Last reviewed sponsor. The shopper does not pay this network fee while this account is the fee payer. */
export const REVIEWED_FEE_PAYER = "Hc3sdEAsCGQcpgfivywog9uwtk8gUBUZgsxdME1EJy88";
/** Browser comparison from 2026-10-05T14:39:47Z. Not a spending authorization. */
export const PREVIOUS_SOL_CAP_LAMPORTS = 8_585_479n;
export const MAINNET_WALLET_CHAIN = "solana:mainnet";

export class DigitalPurchaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DigitalPurchaseError";
  }
}

export function bitcoinAnchorDigest(preimage = BITCOIN_ANCHOR_PREIMAGE): string {
  return createHash("sha256").update(preimage, "utf8").digest("hex");
}

export function bitcoinAnchorBuyUrl(digest = bitcoinAnchorDigest()): string {
  const url = new URL("https://scvd.store/api/buy/bitcoin_anchor");
  url.searchParams.set("digest", digest);
  return url.toString();
}

export interface SolanaExactTerms {
  merchant: typeof BITCOIN_ANCHOR_PRODUCT.merchant;
  operator: typeof BITCOIN_ANCHOR_PRODUCT.operator;
  productId: typeof BITCOIN_ANCHOR_PRODUCT.productId;
  productName: typeof BITCOIN_ANCHOR_PRODUCT.productName;
  quantity: 1;
  preimage: typeof BITCOIN_ANCHOR_PREIMAGE;
  digest: string;
  resourceUrl: string;
  scheme: "exact";
  network: typeof SOLANA_MAINNET_CAIP;
  mint: typeof USDC_MINT;
  amountAtomic: string;
  amountDisplay: string;
  payTo: string;
  feePayer: string;
  memo?: string;
  shopperPaysNetworkFee: false;
  quotedAt: string;
  expiresAt: string;
  maxTimeoutSeconds: number;
  execution: "disabled";
  signing: "unavailable";
  broadcast: "unavailable";
}

export function parseSolanaExactTerms(
  paymentRequired: unknown,
  nowMs: number,
  digest = bitcoinAnchorDigest(),
): SolanaExactTerms {
  if (!paymentRequired || typeof paymentRequired !== "object") {
    throw new DigitalPurchaseError("The merchant payment requirements were not readable.");
  }
  const body = paymentRequired as Record<string, unknown>;
  if (body.x402Version !== 2) {
    throw new DigitalPurchaseError("The merchant did not return an x402 version 2 quote.");
  }
  const resource = body.resource;
  if (!resource || typeof resource !== "object") {
    throw new DigitalPurchaseError("The merchant quote did not name the product URL.");
  }
  const resourceUrl = (resource as { url?: unknown }).url;
  if (typeof resourceUrl !== "string" || resourceUrl !== bitcoinAnchorBuyUrl(digest)) {
    throw new DigitalPurchaseError("The merchant quote is for a different product or digest.");
  }
  if (!Array.isArray(body.accepts)) {
    throw new DigitalPurchaseError("The merchant quote did not list a payment option.");
  }
  const solana = body.accepts.filter((entry) => {
    return !!entry && typeof entry === "object" && (entry as { network?: unknown }).network === SOLANA_MAINNET_CAIP;
  });
  if (solana.length !== 1) {
    throw new DigitalPurchaseError("The merchant quote did not offer exactly one Solana mainnet payment.");
  }
  const accept = solana[0] as Record<string, unknown>;
  if (accept.scheme !== "exact") {
    throw new DigitalPurchaseError("The Solana option is not an exact-amount payment.");
  }
  if (accept.asset !== USDC_MINT) {
    throw new DigitalPurchaseError("The Solana option is not mainnet USDC.");
  }
  if (typeof accept.amount !== "string" || !/^[1-9]\d*$/.test(accept.amount)) {
    throw new DigitalPurchaseError("The merchant amount is not a positive whole number of USDC base units.");
  }
  const amount = BigInt(accept.amount);
  if (amount > PRODUCT_PRICE_CAP_ATOMIC) {
    throw new DigitalPurchaseError("The merchant price is above the 2 USDC product cap.");
  }
  if (typeof accept.payTo !== "string" || !isPlausibleAddress(accept.payTo)) {
    throw new DigitalPurchaseError("The merchant recipient is not a Solana address.");
  }
  const extra = accept.extra;
  if (!extra || typeof extra !== "object") {
    throw new DigitalPurchaseError("The Solana quote did not name a fee payer.");
  }
  const feePayer = (extra as { feePayer?: unknown }).feePayer;
  const quotedAt = (extra as { quotedAt?: unknown }).quotedAt;
  const memo = (extra as { memo?: unknown }).memo;
  if (memo !== undefined && (typeof memo !== "string" || !memo.length || new TextEncoder().encode(memo).length > 256)) {
    throw new DigitalPurchaseError("The merchant payment memo is invalid.");
  }
  if (typeof feePayer !== "string" || !isPlausibleAddress(feePayer)) {
    throw new DigitalPurchaseError("The Solana fee payer is not a Solana address.");
  }
  if (typeof quotedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(quotedAt)) {
    throw new DigitalPurchaseError("The merchant quote did not include a timestamp.");
  }
  const quotedAtMs = Date.parse(quotedAt);
  if (!Number.isFinite(quotedAtMs)) {
    throw new DigitalPurchaseError("The merchant quote timestamp could not be read.");
  }
  if (quotedAtMs > nowMs + 60_000) {
    throw new DigitalPurchaseError("The merchant quote is timestamped in the future.");
  }
  if (typeof accept.maxTimeoutSeconds !== "number" || !Number.isInteger(accept.maxTimeoutSeconds)
    || accept.maxTimeoutSeconds < 1 || accept.maxTimeoutSeconds > 600) {
    throw new DigitalPurchaseError("The merchant quote lifetime is not a usable number of seconds.");
  }
  return {
    ...BITCOIN_ANCHOR_PRODUCT,
    preimage: BITCOIN_ANCHOR_PREIMAGE,
    digest,
    resourceUrl,
    scheme: "exact",
    network: SOLANA_MAINNET_CAIP,
    mint: USDC_MINT,
    amountAtomic: amount.toString(),
    amountDisplay: `${formatFixedMinor(amount, USDC_DECIMALS)} USDC`,
    payTo: accept.payTo,
    feePayer,
    ...(typeof memo === "string" ? { memo } : {}),
    shopperPaysNetworkFee: false,
    quotedAt,
    expiresAt: new Date(quotedAtMs + accept.maxTimeoutSeconds * 1000).toISOString(),
    maxTimeoutSeconds: accept.maxTimeoutSeconds,
    execution: "disabled",
    signing: "unavailable",
    broadcast: "unavailable",
  };
}

export function termsAreCurrent(terms: SolanaExactTerms, nowMs: number): boolean {
  return nowMs < Date.parse(terms.expiresAt);
}

export function usdcGap(balanceAtomic: bigint, priceAtomic: bigint): bigint {
  if (balanceAtomic >= priceAtomic) return 0n;
  return priceAtomic - balanceAtomic;
}

/**
 * Next exact-in amount. Coverage uses minimum received, never the estimated output.
 * The returned amount stays below the full wallet and within the SOL kept back for fees.
 */
export function conversionInputForMinimum(input: {
  gapAtomic: bigint;
  inAmount: bigint;
  minOutAmount: bigint;
  spendableLamports: bigint;
  walletLamports: bigint;
}): { status: "accept" } | { status: "quote"; amount: bigint } | { status: "uncovered" } {
  if (input.gapAtomic <= 0n) return { status: "accept" };
  if (input.minOutAmount <= 0n || input.inAmount <= 0n) return { status: "uncovered" };
  const fits = input.inAmount < input.walletLamports && input.inAmount <= input.spendableLamports;
  const scaled = ceilBuffer(ceilDiv(input.gapAtomic * input.inAmount, input.minOutAmount));
  const scaledFits = scaled > 0n && scaled < input.walletLamports && scaled <= input.spendableLamports && scaled !== input.inAmount;
  if (input.minOutAmount >= input.gapAtomic) {
    if (scaledFits && scaled < input.inAmount) return { status: "quote", amount: scaled };
    return fits ? { status: "accept" } : { status: "uncovered" };
  }
  if (!scaledFits || scaled < input.inAmount) return { status: "uncovered" };
  return { status: "quote", amount: scaled };
}

export function solSpendCap(input: {
  conversionLamports: bigint;
  prioritizationFeeLamports: bigint;
  walletLamports: bigint;
}): { status: "bounded"; lamports: bigint; reserveLamports: bigint } | { status: "unbounded" } {
  if (input.conversionLamports <= 0n || input.prioritizationFeeLamports < 0n) return { status: "unbounded" };
  const fees = input.prioritizationFeeLamports + SOL_BASE_FEE_LAMPORTS;
  if (fees > DEFAULT_SOL_RESERVE_LAMPORTS) return { status: "unbounded" };
  const total = input.conversionLamports + fees;
  const spendable = input.walletLamports > DEFAULT_SOL_RESERVE_LAMPORTS
    ? input.walletLamports - DEFAULT_SOL_RESERVE_LAMPORTS
    : 0n;
  if (input.conversionLamports > spendable || total >= input.walletLamports) return { status: "unbounded" };
  return { status: "bounded", lamports: total, reserveLamports: DEFAULT_SOL_RESERVE_LAMPORTS };
}

export function merchantUsdcAccount(owner: string): string {
  return associatedTokenAddress(owner, USDC_MINT);
}

function ceilBuffer(amount: bigint): bigint {
  return amount + amount / 50n;
}

export function reviewStillBound(input: {
  reviewAddress: string | null;
  reviewNetwork: string | null;
  currentAddress: string;
  currentNetwork: string;
}): boolean {
  return !!input.reviewAddress
    && input.reviewAddress === input.currentAddress
    && input.reviewNetwork === input.currentNetwork
    && input.currentNetwork === MAINNET_WALLET_CHAIN;
}

export function compareSolCap(currentLamports: bigint): {
  previousLamports: string;
  currentLamports: string;
  exceedsPrevious: boolean;
  deltaLamports: string;
} {
  const delta = currentLamports - PREVIOUS_SOL_CAP_LAMPORTS;
  return {
    previousLamports: PREVIOUS_SOL_CAP_LAMPORTS.toString(),
    currentLamports: currentLamports.toString(),
    exceedsPrevious: delta > 0n,
    deltaLamports: delta.toString(),
  };
}

/** Stable for one wallet and digest. A later quote time does not mint a second key. */
export function attemptIdempotencyKey(input: { wallet: string; digest: string }): string {
  const digest = createHash("sha256").update(`bitcoin_anchor\n${input.wallet}\n${input.digest}`, "utf8").digest("hex");
  return `st-anchor-${digest.slice(0, 32)}`;
}

export interface SignedCertificateFields {
  item?: unknown;
  digest?: unknown;
  attests?: { digest?: unknown };
  paid_usdc?: unknown;
  paid_atomic?: unknown;
  asset?: unknown;
  network?: unknown;
  payer?: unknown;
  settlement_tx?: unknown;
}

/** A valid certificate for some other purchase does not prove this one. */
export function certificateCorrelates(signed: SignedCertificateFields, expected: {
  digest: string;
  payer: string;
  amountAtomic: string;
  mint: string;
  network: string;
  settlementTx: string | null;
}): { correlates: boolean; gaps: string[] } {
  const gaps: string[] = [];
  const attested = typeof signed.digest === "string" ? signed.digest : signed.attests?.digest;
  if (signed.item !== BITCOIN_ANCHOR_PRODUCT.productId) gaps.push("The signed item is not bitcoin_anchor.");
  if (typeof attested !== "string" || attested.toLowerCase() !== expected.digest.toLowerCase()) {
    gaps.push("The signed bytes do not contain this digest.");
  }
  const paidAtomic = typeof signed.paid_atomic === "string" ? signed.paid_atomic : null;
  const paidUsdc = typeof signed.paid_usdc === "number" || typeof signed.paid_usdc === "string" ? signed.paid_usdc : null;
  const amountMatches = paidAtomic === expected.amountAtomic
    || (paidUsdc != null && String(paidUsdc) === "1" && expected.amountAtomic === EXPECTED_AMOUNT_ATOMIC.toString());
  if (!amountMatches) gaps.push("The signed payment amount is not 1 USDC.");
  if (signed.asset !== expected.mint) gaps.push("The signed asset is not the mainnet USDC mint.");
  if (signed.network !== expected.network) gaps.push("The signed network is not Solana mainnet.");
  if (signed.payer !== expected.payer) gaps.push("The signed payer is not this wallet.");
  if (expected.settlementTx && signed.settlement_tx !== expected.settlementTx) {
    gaps.push("The signed settlement transaction is not this payment.");
  }
  if (!expected.settlementTx && typeof signed.settlement_tx !== "string") {
    gaps.push("The signed certificate has no settlement transaction.");
  }
  return { correlates: gaps.length === 0, gaps };
}

export type UncertainOutcome = "confirmation_delayed" | "response_lost" | "certificate_unverified" | "anchor_pending";

export function recoverUncertainPurchase(record: {
  idempotencyKey: string | null;
  originalPaymentRetained: boolean;
  certId: string | null;
  anchorState: "not_submitted" | "pending" | "bitcoin_confirmed";
}, outcome: UncertainOutcome): {
  retryPayment: false;
  retrySwap: false;
  executionReady: false;
  action: string;
} {
  const stopped = { retryPayment: false as const, retrySwap: false as const, executionReady: false as const };
  if (outcome === "confirmation_delayed") {
    return {
      ...stopped,
      action: record.originalPaymentRetained && record.idempotencyKey
        ? "Wait. The same retained payment and idempotency key can be read again. Do not build another swap or payment."
        : "Confirmation is delayed and the original payment was not retained. Do not submit another payment.",
    };
  }
  if (outcome === "response_lost") {
    return {
      ...stopped,
      action: record.certId
        ? "Read only this retained certificate id. Do not pay again."
        : "The response is gone and no certificate id was retained. Verify-by-id cannot find it, and a wallet-proof claim needs a signature this review will not request. Do not pay again.",
    };
  }
  if (outcome === "certificate_unverified") {
    return {
      ...stopped,
      action: record.certId
        ? "The certificate id is known, but verification did not succeed. Keep it and do not buy a second anchor."
        : "There is no certificate id to verify. Do not treat another valid certificate as this purchase.",
    };
  }
  return {
    ...stopped,
    action: record.anchorState === "bitcoin_confirmed"
      ? "Bitcoin confirmation is recorded. No further payment is needed."
      : "The store can return the certificate while the OpenTimestamps proof is still pending. Pending submission is not a completed Bitcoin anchor. Do not pay again.",
  };
}
