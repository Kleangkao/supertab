import type { ShoppingConstraints } from "./constraints";
import { matchOffer, type MatchEvidence } from "./match-evidence";
import type { NormalizedOffer } from "./offers";

export interface OfferDecision {
  offer: NormalizedOffer;
  reasons: string[];
  evidence: MatchEvidence[];
}

export interface ClassifiedOffers {
  exact: NormalizedOffer[];
  uncertain: OfferDecision[];
  excluded: OfferDecision[];
}

export function classifyOffers(offers: NormalizedOffer[], constraints: ShoppingConstraints): ClassifiedOffers {
  const exact: NormalizedOffer[] = [];
  const uncertain: OfferDecision[] = [];
  const excluded: OfferDecision[] = [];
  for (const offer of offers) {
    const assessment = matchOffer(offer, constraints);
    if (assessment.decision === "exact") exact.push(offer);
    else if (assessment.decision === "uncertain") uncertain.push({ offer, reasons: assessment.reasons, evidence: assessment.evidence });
    else excluded.push({ offer, reasons: assessment.reasons, evidence: assessment.evidence });
  }
  exact.sort(byPrice);
  uncertain.sort((left, right) => byPrice(left.offer, right.offer));
  return { exact, uncertain, excluded };
}

export function constraintViolations(offer: NormalizedOffer, constraints: ShoppingConstraints): string[] {
  const assessment = matchOffer(offer, constraints);
  return assessment.decision === "exact" ? [] : assessment.reasons;
}

function byPrice(a: NormalizedOffer, b: NormalizedOffer): number {
  if (!a.price && !b.price) return 0;
  if (!a.price) return 1;
  if (!b.price) return -1;
  if (a.price.currency !== b.price.currency) {
    if (a.price.currency === "USD") return -1;
    if (b.price.currency === "USD") return 1;
    return a.price.currency < b.price.currency ? -1 : 1;
  }
  if (a.price.amountMinor === b.price.amountMinor) return 0;
  return a.price.amountMinor < b.price.amountMinor ? -1 : 1;
}
