import type { PurchaseView } from "./view";

/** Classification for one stage of the original SuperTab purchase goal. */
export type JourneyEvidence =
  | "live"
  | "implemented"
  | "simulated"
  | "blocked"
  | "planned"
  | "historical";

export interface JourneyStage {
  id: string;
  title: string;
  evidence: JourneyEvidence;
  detail: string;
  nextAction: string | null;
}

export function journeyEvidenceLabel(evidence: JourneyEvidence): string {
  switch (evidence) {
    case "live": return "Live";
    case "implemented": return "Implemented";
    case "simulated": return "Simulated";
    case "blocked": return "Provider-blocked";
    case "planned": return "Planned";
    case "historical": return "Historical";
  }
}

/**
 * Map the original end-to-end goal onto the current purchase review.
 * Separate proofs stay separate: a live quote is not a payment, and simulation is not a retailer order.
 */
export function purchaseJourneyStages(input: {
  hasSelectedOffer: boolean;
  purchase: PurchaseView | null;
  rehearsalActive?: boolean;
}): JourneyStage[] {
  const purchase = input.purchase;
  const verified = purchase?.finalTotal === "verified";
  const approved = purchase?.purchaseApproval === "approved";
  const walletLoaded = !!purchase && purchase.walletKind !== "none" && purchase.balanceSource !== "none" && purchase.balanceSource !== "error";
  const quoteLive = purchase?.funding?.quoteFreshness === "fresh";
  const conversionPrepared = purchase?.unsignedTransaction === "prepared";
  const railBlocked = !purchase || purchase.cardRail.availability !== "ready";
  const rehearsal = !!input.rehearsalActive;

  return [
    {
      id: "describe",
      title: "Describe the product",
      evidence: "live",
      detail: "Gemini or the deterministic parser keeps constraints in application code.",
      nextAction: null,
    },
    {
      id: "compare",
      title: "Find and compare real offers",
      evidence: input.hasSelectedOffer ? "live" : "live",
      detail: input.hasSelectedOffer
        ? "A real Shopify or eBay offer is selected for review."
        : "Search Shopify and eBay, shortlist, and open a purchase review.",
      nextAction: input.hasSelectedOffer ? null : "Select a confirmed match.",
    },
    {
      id: "funding",
      title: "Check Solana wallet funding",
      evidence: walletLoaded ? "live" : "implemented",
      detail: walletLoaded
        ? (quoteLive
          ? "Balances and a live DFlow quote are on screen. No conversion is signed."
          : "Balances are loaded. Refresh the funding quote if conversion is needed.")
        : "Connect a wallet or use a read-only address to load balances.",
      nextAction: walletLoaded ? null : "Load a wallet or demo address.",
    },
    {
      id: "terms",
      title: "Review final purchase terms",
      evidence: verified ? "implemented" : purchase?.checkoutVerification.status === "calculated" ? "implemented" : "blocked",
      detail: verified
        ? "A merchant checkout total is verified for these exact product terms."
        : purchase?.checkoutVerification.readAvailable
          ? "Catalog/listing price is planning only. Ask the merchant to calculate shipping and tax, or verify a ready checkout."
          : "This merchant origin is not configured for authenticated checkout pricing.",
      nextAction: verified ? null : "Obtain a ready_for_complete merchant total, or open the merchant cart without paying.",
    },
    {
      id: "approval",
      title: "Obtain explicit purchase approval",
      evidence: approved ? "implemented" : "implemented",
      detail: approved
        ? "Purchase terms are approved for the verified total. Wallet connection and conversion remain separate."
        : "Approval stays closed until a verified final merchant total exists for this product and amount.",
      nextAction: approved || !verified ? null : "Approve the exact verified total.",
    },
    {
      id: "convert",
      title: "Convert assets when needed",
      evidence: conversionPrepared ? "implemented" : quoteLive ? "live" : "implemented",
      detail: conversionPrepared
        ? "An unsigned conversion is prepared and format-checked. Production signing stays disabled."
        : "DFlow can quote the funding gap. Execution of a swap is refused while the financial gate is off.",
      nextAction: null,
    },
    {
      id: "pay",
      title: "Pay the merchant",
      evidence: rehearsal ? "simulated" : railBlocked ? "blocked" : "planned",
      detail: rehearsal
        ? "A labeled local simulation can rehearse authorize/capture. It makes no provider calls and moves no funds."
        : "Card rail access is blocked. No retail payment attempt is started.",
      nextAction: railBlocked ? "Owner Bridge/Stripe sandbox access, then a ready rail." : null,
    },
    {
      id: "order",
      title: "Receive verified order evidence",
      evidence: rehearsal ? "simulated" : "blocked",
      detail: rehearsal
        ? "Simulated capture still leaves the order uncreated until separate fixture evidence is added."
        : "Retail order evidence needs agent complete_checkout permission, which this build does not call.",
      nextAction: "Shopify order-complete access, or keep using merchant handoff.",
    },
    {
      id: "recover",
      title: "Track or recover the outcome",
      evidence: "implemented",
      detail: "Pending payment and missing order stay distinct. Unresolved attempts refuse a second start. Devnet refund history is a separate product.",
      nextAction: null,
    },
  ];
}
