import { formatFixedMinor, formatMinor, formatUsdFromMinor } from "./money";
import type { NormalizedOffer } from "./offers";
import { merchantReviewUrl } from "./offers";
import type { AssetBalance } from "./tokens";
import type { FundingPlan } from "./funding-planner";
import { displayUsdc } from "./funding-planner";
import { priceImpactPercentLabel } from "./dflow";
import type { PayableSnapshot } from "./offers";
import type { AssetView, CheckoutView, FundingView, OfferView } from "./view";

export function toOfferView(offer: NormalizedOffer): OfferView {
  const shippingDisplay = offer.shipping?.costMinor == null
    ? null
    : formatPrice(offer.shipping.costMinor, 2, offer.shipping.currency ?? offer.price?.currency ?? "USD");
  return {
    id: offer.id,
    source: offer.source,
    sourceItemId: offer.sourceItemId,
    merchant: offer.merchant,
    title: offer.title,
    descriptionSummary: offer.descriptionSummary,
    imageUrl: offer.imageUrl,
    priceDisplay: offer.price ? formatPrice(offer.price.amountMinor, offer.price.exponent, offer.price.currency) : null,
    priceMinor: offer.price ? offer.price.amountMinor.toString() : null,
    currency: offer.price?.currency ?? null,
    priceKind: offer.price?.basis ?? null,
    availability: offer.availability,
    variantLabel: offer.variantLabel,
    condition: offer.condition,
    shippingSummary: offer.shipping?.summary ?? null,
    shippingDisplay,
    productUrl: offer.productUrl,
    merchantReviewUrl: merchantReviewUrl(offer.checkout.kind === "merchant_cart_link" ? offer.checkout.url : offer.productUrl),
    checkoutLabel: offer.checkout.kind === "merchant_cart_link"
      ? offer.checkout.nativeCheckout
        ? "Merchant checkout link"
        : "Merchant cart link"
      : "Checkout not available",
    verifiedAt: offer.verifiedAt,
  };
}

export function toAssetView(asset: AssetBalance): AssetView {
  const symbol = asset.symbol ?? "Token";
  return {
    mint: asset.mint,
    symbol: asset.symbol,
    name: asset.name,
    amountDisplay: `${formatMinor(asset.amount, asset.decimals)} ${symbol}`,
    amountBase: asset.amount.toString(),
    decimals: asset.decimals,
    kind: asset.kind,
    isUsdc: asset.isUsdc,
    routeKnown: asset.routeKnown,
  };
}

export function toCheckoutView(snapshot: PayableSnapshot): CheckoutView {
  return {
    itemDisplay: snapshot.itemMinor == null ? null : formatUsdFromMinor(snapshot.lineMinor ?? snapshot.itemMinor, snapshot.itemExponent),
    itemKind: snapshot.itemBasis,
    quantity: snapshot.quantity,
    shippingDisplay: snapshot.shippingMinor == null ? null : formatUsdFromMinor(snapshot.shippingMinor, 2),
    taxDisplay: snapshot.taxMinor == null ? null : formatUsdFromMinor(snapshot.taxMinor, 2),
    discountDisplay: snapshot.discountMinor == null ? null : formatUsdFromMinor(snapshot.discountMinor, 2),
    merchantTotalDisplay: snapshot.merchantTotalKnown && snapshot.merchantTotalMinor != null
      ? formatUsdFromMinor(snapshot.merchantTotalMinor, snapshot.itemExponent)
      : null,
    currency: snapshot.currency,
    note: snapshot.note,
  };
}

export function toFundingView(plan: FundingPlan): FundingView {
  return {
    payableKnown: plan.payableKnown,
    planningBasis: plan.planningBasis,
    merchantTotalKnown: plan.merchantTotalKnown,
    planningDisplay: plan.planningMinor == null ? null : formatUsdFromMinor(plan.planningMinor, 2),
    existingUsdc: displayUsdc(plan.existingUsdcBase),
    usdcUsed: displayUsdc(plan.usdcUsedBase),
    deficit: displayUsdc(plan.deficitUsdcBase),
    reserve: `${formatMinor(plan.networkReserveLamports, 9)} SOL`,
    candidateSymbol: plan.candidateSymbol,
    candidateMint: plan.candidateMint,
    requiredInput: plan.requiredInputBase == null || !plan.candidateSymbol || plan.candidateDecimals == null
      ? null
      : `${formatMinor(plan.requiredInputBase, plan.candidateDecimals)} ${plan.candidateSymbol}`,
    expectedOutput: plan.expectedOutputBase == null ? null : displayUsdc(plan.expectedOutputBase),
    minimumOutput: plan.minimumOutputBase == null ? null : displayUsdc(plan.minimumOutputBase),
    priceImpact: priceImpactPercentLabel(plan.priceImpactPct),
    slippageBps: plan.slippageBps,
    platformFee: plan.platformFeeText,
    quoteFreshness: plan.quoteFreshness,
    quoteExpiresAt: plan.quoteExpiresAtMs == null ? null : new Date(plan.quoteExpiresAtMs).toISOString(),
    fundable: plan.fundable,
    readiness: plan.readiness,
    notes: plan.notes,
  };
}

function formatPrice(amount: bigint, exponent: number, currency: string): string {
  if (currency === "USD") return formatUsdFromMinor(amount, exponent);
  return `${formatFixedMinor(amount, exponent)} ${currency}`;
}
