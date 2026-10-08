import { formatFixedMinor, formatMinor, formatUsdFromMinor } from "./money";
import { merchantHandoffLinks, merchantReviewUrl, payableAuthorityOf, type NormalizedOffer, type PayableSnapshot } from "./offers";
import type { MerchantStatement } from "./merchant-checkout";
import type { AssetBalance } from "./tokens";
import type { FundingPlan } from "./funding-planner";
import { displayUsdc } from "./funding-planner";
import { priceImpactPercentLabel } from "./dflow";
import type { AssetView, CheckoutView, FundingView, OfferView, PurchaseView } from "./view";

export function toOfferView(offer: NormalizedOffer, quantity = 1): OfferView {
  let cartUrl = offer.checkout.kind === "merchant_cart_link" ? merchantReviewUrl(offer.checkout.url) : null;
  if (cartUrl && offer.source === "shopify" && offer.checkout.kind === "merchant_cart_link") {
    const url = new URL(cartUrl);
    const variant = offer.sourceItemId.match(/^gid:\/\/shopify\/ProductVariant\/(\d+)$/)?.[1];
    if (variant && url.pathname === `/cart/${variant}:1` && Number.isInteger(quantity) && quantity > 0 && quantity <= 20) {
      url.pathname = `/cart/${variant}:${quantity}`;
      cartUrl = url.href;
    }
  }
  const handoff = merchantHandoffLinks({ productUrl: offer.productUrl, cartUrl });
  const productUrl = handoff.find((link) => link.kind === "product")?.href ?? null;
  const merchantCartUrl = handoff.find((link) => link.kind === "cart")?.href ?? null;
  const reviewUrl = handoff.find((link) => link.kind === "unknown")?.href ?? null;
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
    productUrl,
    merchantCartUrl,
    merchantReviewUrl: reviewUrl,
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
  const authority = payableAuthorityOf(snapshot);
  return {
    itemDisplay: snapshot.itemMinor == null ? null : formatUsdFromMinor(snapshot.lineMinor ?? snapshot.itemMinor, snapshot.itemExponent),
    itemKind: authority === "merchant_ready" ? "merchant_checkout" : authority === "merchant_calculated" ? "merchant_calculated" : snapshot.itemBasis,
    quantity: snapshot.quantity,
    shippingDisplay: snapshot.shippingMinor == null ? null : formatUsdFromMinor(snapshot.shippingMinor, 2),
    taxDisplay: snapshot.taxMinor == null ? null : formatUsdFromMinor(snapshot.taxMinor, 2),
    feeDisplay: snapshot.feeMinor == null ? null : formatUsdFromMinor(snapshot.feeMinor, 2),
    discountDisplay: snapshot.discountMinor == null ? null : formatUsdFromMinor(snapshot.discountMinor, 2),
    merchantTotalDisplay: snapshot.merchantTotalMinor != null && authority !== "catalog_or_listing"
      ? formatUsdFromMinor(snapshot.merchantTotalMinor, snapshot.itemExponent)
      : null,
    currency: snapshot.currency,
    note: snapshot.note,
  };
}

export function toStatementView(statement: MerchantStatement): NonNullable<PurchaseView["merchantStatement"]> {
  const exponent = statement.currency === "JPY" ? 0 : 2;
  const format = (amount: bigint | null) => amount == null ? null : `${formatFixedMinor(amount, exponent)} ${statement.currency}`;
  return {
    status: statement.status, currency: statement.currency,
    subtotalDisplay: format(statement.subtotalMinor) ?? "",
    shippingDisplay: format(statement.shippingMinor), taxDisplay: format(statement.taxMinor),
    dutyDisplay: format(statement.dutyMinor), discountDisplay: format(statement.discountMinor),
    totalDisplay: format(statement.statedTotalMinor) ?? "",
    gapDisplay: statement.reconciled ? null : format(statement.gapMinor),
    reconciled: statement.reconciled,
    deliveryMethod: statement.deliveryMethod, missingCodes: statement.missingCodes,
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
