import type { ShoppingConstraints } from "./constraints";
import type { NormalizedOffer } from "./offers";

export interface OfferDecision {
  offer: NormalizedOffer;
  reasons: string[];
}

export interface ClassifiedOffers {
  exact: NormalizedOffer[];
  excluded: OfferDecision[];
}

export function classifyOffers(offers: NormalizedOffer[], constraints: ShoppingConstraints): ClassifiedOffers {
  const exact: NormalizedOffer[] = [];
  const excluded: OfferDecision[] = [];
  for (const offer of offers) {
    const reasons = constraintViolations(offer, constraints);
    if (reasons.length === 0) exact.push(offer);
    else excluded.push({ offer, reasons });
  }
  exact.sort(byPrice);
  return { exact, excluded };
}

export function constraintViolations(offer: NormalizedOffer, constraints: ShoppingConstraints): string[] {
  const reasons: string[] = [];
  const haystack = offerText(offer);
  const fragrance = /\b(cologne|perfume|fragrance|edt|edp|eau de (?:toilette|parfum))\b/i;
  if (/\bpolo\b/i.test(constraints.productQuery) && !fragrance.test(constraints.productQuery) && fragrance.test(offer.title)) {
    reasons.push("This is a fragrance, not polo clothing.");
  }

  const missedTerms = constraints.requiredTerms.filter((term) => !includesTerm(haystack, term));
  if (constraints.requiredTerms.length > 0 && missedTerms.length === constraints.requiredTerms.length) {
    reasons.push(`Does not mention ${constraints.productQuery || constraints.requiredTerms.join(" ")}.`);
  }

  if (constraints.colors.length > 0) {
    const matched = constraints.colors.some((color) => includesTerm(haystack, color));
    if (!matched) reasons.push(`Color is not ${constraints.colors.join(" or ")}.`);
  }

  if (constraints.sizes.length > 0) {
    const matched = constraints.sizes.some((size) => sizeMatches(haystack, size));
    if (!matched) reasons.push(`Size ${constraints.sizes.join(" or ")} is not shown.`);
  }

  if (constraints.maxPriceCents != null) {
    if (!offer.price) reasons.push("Price is unknown, so the budget cannot be checked.");
    else if (offer.price.currency !== "USD" || offer.price.exponent !== 2) {
      reasons.push(`Price is in ${offer.price.currency}, so the dollar budget cannot be checked.`);
    } else if (offer.price.amountMinor > constraints.maxPriceCents) {
      reasons.push("Price is over the budget.");
    }
  }

  if (constraints.condition === "new") {
    if (!offer.condition) reasons.push("Condition was not confirmed as new.");
    else if (!/new/i.test(offer.condition) || /used|pre-?owned|refurbished/i.test(offer.condition)) {
      reasons.push("Condition is not new.");
    }
  }
  if (constraints.condition === "used") {
    if (!offer.condition) reasons.push("Condition was not confirmed as used.");
    else if (!/used|pre-?owned|refurbished|second/i.test(offer.condition)) {
      reasons.push("Condition is not used.");
    }
  }

  if (constraints.merchantIncludes.length > 0) {
    const merchant = offer.merchant?.toLowerCase() ?? "";
    const matched = constraints.merchantIncludes.some((name) => merchant.includes(name.toLowerCase()));
    if (!matched) reasons.push("Merchant does not match the request.");
  }

  if (offer.availability === "out_of_stock") reasons.push("Not currently available.");
  return reasons;
}

function offerText(offer: NormalizedOffer): string {
  return [
    offer.title,
    offer.variantLabel ?? "",
    offer.descriptionSummary ?? "",
    ...offer.options.map((option) => `${option.name} ${option.value}`),
    offer.condition ?? "",
  ].join(" ").toLowerCase();
}

function includesTerm(haystack: string, term: string): boolean {
  const lower = term.toLowerCase();
  const aliases = lower === "gray" || lower === "grey" ? ["gray", "grey"] : [lower];
  return aliases.some((alias) => {
    const needle = alias.replace(/s$/, "");
    return haystack.includes(needle.length < 2 ? alias : needle);
  });
}

function sizeMatches(haystack: string, size: string): boolean {
  if (/^\d+(?:\.\d)?$/.test(size)) {
    const pattern = new RegExp(`(^|[^0-9])${size.replace(".", "\\.")}([^0-9]|$)`);
    return pattern.test(haystack);
  }
  return haystack.includes(size.toLowerCase());
}

function byPrice(a: NormalizedOffer, b: NormalizedOffer): number {
  if (!a.price && !b.price) return 0;
  if (!a.price) return 1;
  if (!b.price) return -1;
  if (a.price.amountMinor === b.price.amountMinor) return 0;
  return a.price.amountMinor < b.price.amountMinor ? -1 : 1;
}
