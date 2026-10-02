import { formatMinor, formatUsdFromMinor, usdMinorToUsdcBase } from "./money";
import type { PayableSnapshot } from "./offers";
import {
  DEFAULT_SOL_RESERVE_LAMPORTS,
  USDC_DECIMALS,
  type AssetBalance,
  dflowInputMint,
  isUsdcMint,
  spendableNativeLamports,
} from "./tokens";

export type QuoteFreshness = "live" | "stale" | "mismatched" | "missing";

export interface BoundQuote {
  quoteId: string;
  inputMint: string;
  outputMint: string;
  inAmount: bigint;
  outAmount: bigint;
  minOutAmount: bigint;
  inputDecimals: number;
  outputDecimals: number;
  priceImpactPct: string | null;
  slippageBps: number | null;
  platformFeeText: string | null;
  contextSlot: number | null;
  expiresAtMs: number;
  receivedAtMs: number;
  boundPayableMinor: bigint;
  boundFundingMint: string;
  execution: "quote_only";
}

export interface FundingPlan {
  payableKnown: boolean;
  planningBasis: "catalog_price" | "listing_price" | "merchant_checkout_total" | "unknown";
  merchantTotalKnown: boolean;
  planningMinor: bigint | null;
  planningCurrency: string | null;
  existingUsdcBase: bigint;
  usdcUsedBase: bigint;
  deficitUsdcBase: bigint;
  networkReserveLamports: bigint;
  candidateMint: string | null;
  candidateSymbol: string | null;
  candidateDecimals: number | null;
  candidateSpendableBase: bigint | null;
  requiredInputBase: bigint | null;
  expectedOutputBase: bigint | null;
  minimumOutputBase: bigint | null;
  priceImpactPct: string | null;
  slippageBps: number | null;
  platformFeeText: string | null;
  quoteFreshness: QuoteFreshness;
  quoteExpiresAtMs: number | null;
  fundable: boolean;
  readiness: "amount_unknown" | "covered_by_usdc" | "needs_conversion" | "not_fundable";
  notes: string[];
}

export function quoteIsUsable(
  quote: BoundQuote | null,
  payableMinor: bigint | null,
  fundingMint: string | null,
  nowMs: number,
): QuoteFreshness {
  if (!quote || payableMinor == null || !fundingMint) return "missing";
  if (quote.boundPayableMinor !== payableMinor || quote.boundFundingMint !== fundingMint) return "mismatched";
  if (nowMs > quote.expiresAtMs) return "stale";
  return "live";
}

export function planFunding(input: {
  snapshot: PayableSnapshot;
  balances: AssetBalance[];
  selectedFundingMint: string | null;
  quote: BoundQuote | null;
  nowMs: number;
  solReserveLamports?: bigint;
}): FundingPlan {
  const reserve = input.solReserveLamports ?? DEFAULT_SOL_RESERVE_LAMPORTS;
  const notes: string[] = [];
  const usdc = input.balances.find((balance) => balance.isUsdc && isUsdcMint(balance.mint));
  const existingUsdcBase = usdc && usdc.decimals === USDC_DECIMALS ? usdc.amount : 0n;
  if (usdc && usdc.decimals !== USDC_DECIMALS) {
    notes.push("The USDC account uses unexpected decimals, so it was not counted as spendable.");
  }
  const basis = input.snapshot.merchantTotalKnown
    ? "merchant_checkout_total"
    : input.snapshot.itemBasis === "catalog"
      ? "catalog_price"
      : input.snapshot.itemBasis === "listing"
        ? "listing_price"
        : "unknown";

  if (!input.snapshot.merchantTotalKnown) {
    notes.push(input.snapshot.note);
  }

  const planningMinor = knownPlanningMinor(input.snapshot);
  if (planningMinor == null || input.snapshot.currency !== "USD") {
    notes.push("There is no dollar amount yet that can be planned against.");
    return blankPlan({
      existingUsdcBase,
      reserve,
      notes,
      basis,
      merchantTotalKnown: input.snapshot.merchantTotalKnown,
    });
  }

  const requiredUsdc = usdMinorToUsdcBase(planningMinor, input.snapshot.itemExponent, USDC_DECIMALS);
  const usdcUsed = existingUsdcBase < requiredUsdc ? existingUsdcBase : requiredUsdc;
  const deficit = requiredUsdc - usdcUsed;
  notes.push("Only existing USDC is counted. Other tokens are not treated as spendable until a conversion quote exists.");
  notes.push(`About ${formatMinor(reserve, 9)} SOL stays untouched for network fees.`);

  if (deficit === 0n) {
    notes.push("Existing USDC covers this planning amount.");
    return {
      ...basePlan(basis, input.snapshot.merchantTotalKnown, planningMinor, existingUsdcBase, usdcUsed, 0n, reserve, notes),
      fundable: true,
      readiness: "covered_by_usdc",
      quoteFreshness: "missing",
    };
  }

  const candidate = chooseCandidate(input.balances, input.selectedFundingMint, reserve);
  if (!candidate) {
    notes.push("Additional USDC is required, and no spendable funding asset is selected.");
    return {
      ...basePlan(basis, input.snapshot.merchantTotalKnown, planningMinor, existingUsdcBase, usdcUsed, deficit, reserve, notes),
      fundable: false,
      readiness: "not_fundable",
      quoteFreshness: "missing",
    };
  }

  const spendable = candidate.kind === "native"
    ? spendableNativeLamports(candidate, reserve)
    : candidate.amount;
  const fundingMint = dflowInputMint(candidate);
  const freshness = quoteIsUsable(input.quote, planningMinor, fundingMint, input.nowMs);
  if (freshness === "stale") notes.push("The conversion quote expired. Request a new one before approving anything.");
  if (freshness === "mismatched") notes.push("The previous quote does not match this amount or funding asset.");

  const live = freshness === "live" ? input.quote : null;
  if (live && live.outAmount < deficit) {
    notes.push("The latest quote does not cover the USDC still needed.");
  }
  if (!live) {
    notes.push("No live conversion quote is attached. Nothing has been swapped.");
  } else {
    notes.push("This is a live quote, not a completed conversion.");
  }

  const covers = live != null && live.outAmount >= deficit && live.inAmount <= spendable;
  if (live && live.inAmount > spendable) {
    notes.push("The quote asks for more of the funding asset than can be used while keeping the network reserve.");
  }
  const waitingForQuote = live == null;
  if (waitingForQuote) {
    notes.push(`${candidate.symbol ?? "The selected asset"} can be quoted. No swap has been requested.`);
  }

  return {
    ...basePlan(basis, input.snapshot.merchantTotalKnown, planningMinor, existingUsdcBase, usdcUsed, deficit, reserve, notes),
    candidateMint: candidate.mint,
    candidateSymbol: candidate.symbol,
    candidateDecimals: candidate.decimals,
    candidateSpendableBase: spendable,
    requiredInputBase: live?.inAmount ?? null,
    expectedOutputBase: live?.outAmount ?? null,
    minimumOutputBase: live?.minOutAmount ?? null,
    priceImpactPct: live?.priceImpactPct ?? null,
    slippageBps: live?.slippageBps ?? null,
    platformFeeText: live?.platformFeeText ?? null,
    quoteFreshness: live ? "live" : freshness,
    quoteExpiresAtMs: live?.expiresAtMs ?? null,
    fundable: covers,
    readiness: covers || waitingForQuote ? "needs_conversion" : "not_fundable",
  };
}

export function knownPlanningMinor(snapshot: PayableSnapshot): bigint | null {
  if (snapshot.merchantTotalKnown && snapshot.merchantTotalMinor != null) return snapshot.merchantTotalMinor;
  if (snapshot.lineMinor == null || snapshot.currency !== "USD") return null;
  return snapshot.lineMinor + (snapshot.shippingMinor ?? 0n) - (snapshot.discountMinor ?? 0n);
}

function chooseCandidate(
  balances: AssetBalance[],
  selectedMint: string | null,
  reserve: bigint,
): AssetBalance | null {
  if (selectedMint) {
    const selected = balances.find((balance) => balance.mint === selectedMint && !balance.isUsdc);
    if (!selected) return null;
    const spendable = selected.kind === "native" ? spendableNativeLamports(selected, reserve) : selected.amount;
    return spendable > 0n ? selected : null;
  }
  const sol = balances.find((balance) => balance.kind === "native");
  if (sol && spendableNativeLamports(sol, reserve) > 0n) return sol;
  return null;
}

function basePlan(
  basis: FundingPlan["planningBasis"],
  merchantTotalKnown: boolean,
  planningMinor: bigint,
  existingUsdcBase: bigint,
  usdcUsedBase: bigint,
  deficitUsdcBase: bigint,
  reserve: bigint,
  notes: string[],
): FundingPlan {
  return {
    payableKnown: true,
    planningBasis: basis,
    merchantTotalKnown,
    planningMinor,
    planningCurrency: "USD",
    existingUsdcBase,
    usdcUsedBase,
    deficitUsdcBase,
    networkReserveLamports: reserve,
    candidateMint: null,
    candidateSymbol: null,
    candidateDecimals: null,
    candidateSpendableBase: null,
    requiredInputBase: null,
    expectedOutputBase: null,
    minimumOutputBase: null,
    priceImpactPct: null,
    slippageBps: null,
    platformFeeText: null,
    quoteFreshness: "missing",
    quoteExpiresAtMs: null,
    fundable: false,
    readiness: "not_fundable",
    notes,
  };
}

function blankPlan(input: {
  existingUsdcBase: bigint;
  reserve: bigint;
  notes: string[];
  basis: FundingPlan["planningBasis"];
  merchantTotalKnown: boolean;
}): FundingPlan {
  return {
    payableKnown: false,
    planningBasis: input.basis,
    merchantTotalKnown: input.merchantTotalKnown,
    planningMinor: null,
    planningCurrency: null,
    existingUsdcBase: input.existingUsdcBase,
    usdcUsedBase: 0n,
    deficitUsdcBase: 0n,
    networkReserveLamports: input.reserve,
    candidateMint: null,
    candidateSymbol: null,
    candidateDecimals: null,
    candidateSpendableBase: null,
    requiredInputBase: null,
    expectedOutputBase: null,
    minimumOutputBase: null,
    priceImpactPct: null,
    slippageBps: null,
    platformFeeText: null,
    quoteFreshness: "missing",
    quoteExpiresAtMs: null,
    fundable: false,
    readiness: "amount_unknown",
    notes: input.notes,
  };
}

export function displayUsdc(base: bigint): string {
  return `${formatMinor(base, USDC_DECIMALS)} USDC`;
}

export function displayPlanningUsd(minor: bigint): string {
  return formatUsdFromMinor(minor, 2);
}
