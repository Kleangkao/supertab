"use client";

import { journeyEvidenceLabel, purchaseJourneyStages } from "@/lib/purchase-journey";
import type { PurchaseView } from "@/lib/view";

export function PurchaseJourneyMap({
  hasSelectedOffer,
  purchase,
  rehearsalActive = false,
}: {
  hasSelectedOffer: boolean;
  purchase: PurchaseView | null;
  rehearsalActive?: boolean;
}) {
  const stages = purchaseJourneyStages({ hasSelectedOffer, purchase, rehearsalActive });
  return <section className="purchase-journey" aria-label="Purchase journey">
    <p className="eyebrow">ORIGINAL GOAL</p>
    <h3>AI shopping that uses Solana assets to complete purchases.</h3>
    <p className="journey-limit" role="note">Prototype limit: retail payment and merchant order completion are currently unavailable. Search, funding review, and a labeled local rehearsal still work.</p>
    <p>Badges describe capability or a current read—not that this shopper finished that purchase stage. Live quotes are not completed conversions. Historical devnet evidence is not payment for the selected retailer.</p>
    <ol className="journey-stages">
      {stages.map((stage) => <li key={stage.id} data-evidence={stage.evidence}>
        <div className="journey-stage-head">
          <strong>{stage.title}</strong>
          <span className={`journey-badge evidence-${stage.evidence}`}>{journeyEvidenceLabel(stage.evidence)}</span>
        </div>
        <p>{stage.detail}</p>
        {stage.nextAction && <p className="journey-next">Next: {stage.nextAction}</p>}
      </li>)}
    </ol>
    <p className="section-copy">A completed retail purchase requires one continuous path through payment and merchant order evidence. Component proofs below do not add up to that purchase by themselves.</p>
  </section>;
}
