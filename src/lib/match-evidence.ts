import { COLORS, type ShoppingConstraints } from "./constraints";
import type { NormalizedOffer } from "./offers";

export type EvidenceStatus = "confirmed" | "conflict" | "unknown";

export interface MatchEvidence {
  attribute: "product" | "color" | "size" | "condition" | "budget" | "availability" | "merchant";
  status: EvidenceStatus;
  /** Unknown availability is shown, but it does not by itself remove an otherwise exact match. */
  blocksExact: boolean;
  detail: string;
}

export interface MatchAssessment {
  decision: "exact" | "uncertain" | "excluded";
  reasons: string[];
  evidence: MatchEvidence[];
}

export function matchOffer(offer: NormalizedOffer, constraints: ShoppingConstraints): MatchAssessment {
  const evidence = [
    productEvidence(offer, constraints),
    colorEvidence(offer, constraints),
    sizeEvidence(offer, constraints),
    conditionEvidence(offer, constraints),
    budgetEvidence(offer, constraints),
    availabilityEvidence(offer),
    merchantEvidence(offer, constraints),
  ].filter((item): item is MatchEvidence => item != null);
  const conflicts = evidence.filter((item) => item.status === "conflict");
  const unknown = evidence.filter((item) => item.status === "unknown" && item.blocksExact);
  const decision = conflicts.length > 0 ? "excluded" : unknown.length > 0 ? "uncertain" : "exact";
  const reasons = (conflicts.length > 0 ? conflicts : unknown).map((item) => item.detail);
  return { decision, reasons, evidence };
}

function productEvidence(offer: NormalizedOffer, constraints: ShoppingConstraints): MatchEvidence | null {
  const fragrance = /\b(cologne|perfume|fragrance|edt|edp|eau de (?:toilette|parfum))\b/i;
  if (/\bpolo\b/i.test(constraints.productQuery) && !fragrance.test(constraints.productQuery) && fragrance.test(offer.title)) {
    return row("product", "conflict", "This is a fragrance, not polo clothing.");
  }
  if (constraints.requiredTerms.length === 0) return null;
  const title = offer.title;
  const head = constraints.requiredTerms[constraints.requiredTerms.length - 1] ?? "";
  if (poloBrandOnAnotherGarment(constraints, title)) {
    return row("product", "conflict", "The title names a different garment. The word Polo is not enough to confirm a polo shirt.");
  }
  if (!hasToken(title, head)) {
    const described = constraints.requiredTerms.some((term) => hasToken(offer.descriptionSummary ?? "", term));
    return row("product", "unknown", described
      ? "The description mentions the request, but the title does not confirm it."
      : `The title does not confirm ${constraints.productQuery || head}.`);
  }
  const found = constraints.requiredTerms.filter((term) => hasToken(title, term));
  return row("product", "confirmed", `Title includes ${found.join(", ")}.`);
}

function poloBrandOnAnotherGarment(constraints: ShoppingConstraints, title: string): boolean {
  if (!constraints.requiredTerms.includes("polo") || !/\bpolo\b/i.test(title)) return false;
  if (/\bpolo\s+(shirts?|tops?)\b/i.test(title)) return false;
  return /\b(t-?shirts?|tees?|crewneck)\b/i.test(title);
}

function colorEvidence(offer: NormalizedOffer, constraints: ShoppingConstraints): MatchEvidence | null {
  if (constraints.colors.length === 0) return null;
  const option = optionValue(offer, /colou?r/i);
  const wanted = constraints.colors.join(" or ");
  if (option) {
    const present = [...new Set(COLORS.filter((color) => hasToken(option, color)).map((color) => color === "grey" ? "gray" : color))];
    const hit = constraints.colors.filter((color) => present.includes(color));
    const extra = present.filter((color) => !constraints.colors.includes(color));
    if (hit.length > 0 && extra.length === 0) return row("color", "confirmed", `Color ${option} confirmed from the variant option.`);
    if (hit.length > 0 && extra.length > 0) return row("color", "unknown", `Color option is ${option}, so ${wanted} alone is not confirmed.`);
    if (present.length > 0 || !constraints.colors.some((color) => hasToken(option, color))) {
      return row("color", "conflict", `Variant color is ${option}, not ${wanted}.`);
    }
  }
  const identity = `${offer.title} ${offer.variantLabel ?? ""}`;
  if (constraints.colors.some((color) => hasToken(identity, color))) {
    return row("color", "confirmed", `Color confirmed from the title or variant label.`);
  }
  if (constraints.colors.some((color) => hasToken(offer.descriptionSummary ?? "", color))) {
    return row("color", "unknown", "A description mentions the color, but this variant's color was not returned.");
  }
  return row("color", "unknown", `Color ${wanted} was not returned for this variant.`);
}

function sizeEvidence(offer: NormalizedOffer, constraints: ShoppingConstraints): MatchEvidence | null {
  if (constraints.sizes.length === 0) return null;
  const wanted = constraints.sizes.join(" or ");
  const option = optionValue(offer, /size/i);
  if (option) {
    if (constraints.sizes.some((size) => sizeToken(option, size))) {
      return row("size", "confirmed", `Size ${option} confirmed from the variant option.`);
    }
    return row("size", "conflict", `Size is ${option}, not ${wanted}.`);
  }
  const label = offer.variantLabel?.trim() ?? "";
  if (label && constraints.sizes.some((size) => sizeToken(label, size))) {
    return row("size", "confirmed", `Size confirmed from the variant label.`);
  }
  if (label && looksLikeSize(label) && !constraints.sizes.some((size) => sizeToken(label, size))) {
    return row("size", "conflict", `Size is ${label}, not ${wanted}.`);
  }
  return row("size", "unknown", `Size ${wanted} was not returned for this variant.`);
}

function conditionEvidence(offer: NormalizedOffer, constraints: ShoppingConstraints): MatchEvidence | null {
  if (constraints.condition === "any") return null;
  const wanted = constraints.condition;
  if (!offer.condition) return row("condition", "unknown", `Condition was not returned, so it is not confirmed as ${wanted}.`);
  const used = /\b(used|pre-?owned|refurbished|renewed|second[\s-]?hand|secondhand|open box|like[\s-]?new)\b/i.test(offer.condition);
  const fresh = /\b(brand[\s-]?new|new with (?:tags|box)|neu mit etikett|new)\b/i.test(offer.condition) && !used;
  if (wanted === "new" && fresh) return row("condition", "confirmed", "Condition confirmed as new.");
  if (wanted === "used" && used) return row("condition", "confirmed", "Condition confirmed as used.");
  if (!used && !fresh) return row("condition", "unknown", `Condition “${offer.condition}” is not a recognized new or used value.`);
  return row("condition", "conflict", `Condition is ${offer.condition}, not ${wanted}.`);
}

function budgetEvidence(offer: NormalizedOffer, constraints: ShoppingConstraints): MatchEvidence | null {
  if (constraints.maxPriceCents == null) return null;
  if (!offer.price) return row("budget", "unknown", "Price was not returned, so the budget cannot be checked.");
  if (offer.price.currency !== "USD" || offer.price.exponent !== 2) {
    return row("budget", "unknown", `Price is in ${offer.price.currency}, so it cannot be compared with the dollar budget.`);
  }
  if (offer.price.amountMinor > constraints.maxPriceCents) return row("budget", "conflict", "Price is over the budget.");
  return row("budget", "confirmed", "Item price is within the dollar budget.");
}

function availabilityEvidence(offer: NormalizedOffer): MatchEvidence | null {
  if (offer.availability === "out_of_stock") return row("availability", "conflict", "Not currently available.");
  if (offer.availability === "unknown") {
    return { attribute: "availability", status: "unknown", blocksExact: false, detail: "Availability was not returned." };
  }
  return row("availability", "confirmed", "Marked in stock.");
}

function merchantEvidence(offer: NormalizedOffer, constraints: ShoppingConstraints): MatchEvidence | null {
  if (constraints.merchantIncludes.length === 0) return null;
  const merchant = offer.merchant?.toLowerCase() ?? "";
  const matched = constraints.merchantIncludes.some((name) => merchant.includes(name.toLowerCase()));
  if (!offer.merchant) return row("merchant", "unknown", "Merchant was not returned.");
  if (!matched) return row("merchant", "conflict", "Merchant does not match the request.");
  return row("merchant", "confirmed", `Merchant confirmed: ${offer.merchant}.`);
}

function row(attribute: MatchEvidence["attribute"], status: EvidenceStatus, detail: string): MatchEvidence {
  return { attribute, status, blocksExact: status !== "confirmed", detail };
}

function optionValue(offer: NormalizedOffer, name: RegExp): string | null {
  const option = offer.options.find((item) => name.test(item.name));
  const value = option?.value?.trim();
  return value || null;
}

function looksLikeSize(value: string): boolean {
  return /^(xxs|xs|s|m|l|xl|xxl|xxxl|small|medium|large|\d{1,2}(?:\.\d)?)$/i.test(value.trim());
}

const SIZE_WORDS: { token: string; pattern: RegExp }[] = [
  { token: "xxxl", pattern: /\bxxxl\b|xxx-?large/i },
  { token: "xxl", pattern: /\bxxl\b|xx-?large|extra extra large/i },
  { token: "xl", pattern: /\bxl\b|extra large/i },
  { token: "xxs", pattern: /\bxxs\b|extra extra small/i },
  { token: "xs", pattern: /\bxs\b|extra small/i },
  { token: "small", pattern: /\bsmall\b|\bs\b/i },
  { token: "medium", pattern: /\bmedium\b|\bm\b/i },
  { token: "large", pattern: /\blarge\b|\bl\b/i },
];

function sizeToken(haystack: string, size: string): boolean {
  if (/^\d+(?:\.\d)?$/.test(size)) {
    return new RegExp(`(^|[^0-9])${size.replace(".", "\\.")}([^0-9]|$)`).test(haystack);
  }
  const wanted = size === "s" ? "small" : size === "m" ? "medium" : size === "l" ? "large" : size;
  let detected = SIZE_WORDS.filter((item) => item.pattern.test(haystack)).map((item) => item.token);
  if (detected.some((token) => token === "xs" || token === "xxs")) detected = detected.filter((token) => token !== "small");
  if (detected.some((token) => token === "xl" || token === "xxl" || token === "xxxl")) detected = detected.filter((token) => token !== "large");
  if (detected.length > 0) return detected.includes(wanted);
  return hasToken(haystack, wanted);
}

function hasToken(haystack: string, term: string): boolean {
  const lower = term.toLowerCase();
  const aliases = lower === "gray" || lower === "grey" ? ["gray", "grey"] : [lower];
  if (lower.length > 3 && lower.endsWith("s")) aliases.push(lower.slice(0, -1));
  return aliases.some((alias) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(alias)}([^a-z0-9]|$)`, "i").test(haystack));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
