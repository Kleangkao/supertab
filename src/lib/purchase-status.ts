/** Public progress labels. No keys, signatures, or payment bytes. */

export const EXECUTION_GATE_LABEL = "Mainnet execution gate is off. Signing and sending stay unavailable.";

export const WORKFLOW_STAGES = [
  "review",
  "approved_terms",
  "swap_prepared",
  "swap_signed",
  "swap_submitted_uncertain",
  "swap_confirmed",
  "funding_rechecked",
  "payment_prepared",
  "payment_signed",
  "merchant_submission_uncertain",
  "certificate_verified",
  "timestamp_proof_pending",
  "bitcoin_anchor_verified",
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number]
  | "payment_confirmed_certificate_missing"
  | "certificate_verification_unavailable";

export const WORKFLOW_STAGE_LABELS: Record<WorkflowStage, string> = {
  review: "Review",
  approved_terms: "Approved terms",
  swap_prepared: "Swap prepared",
  swap_signed: "Swap signed",
  swap_submitted_uncertain: "Swap submitted, outcome unknown",
  swap_confirmed: "Swap confirmed",
  funding_rechecked: "Funding rechecked",
  payment_prepared: "Payment prepared",
  payment_signed: "Payment signed",
  merchant_submission_uncertain: "Merchant submission, outcome unknown",
  payment_confirmed_certificate_missing: "Payment confirmed, certificate missing",
  certificate_verification_unavailable: "Certificate returned, verification unavailable",
  certificate_verified: "Certificate verified",
  timestamp_proof_pending: "Timestamp proof pending",
  bitcoin_anchor_verified: "Bitcoin anchor verified",
};

export function isUnresolvedWorkflow(stage: WorkflowStage): boolean {
  return stage === "swap_submitted_uncertain"
    || stage === "swap_signed"
    || stage === "swap_confirmed"
    || stage === "funding_rechecked"
    || stage === "payment_prepared"
    || stage === "payment_signed"
    || stage === "merchant_submission_uncertain"
    || stage === "payment_confirmed_certificate_missing"
    || stage === "certificate_verification_unavailable"
    || stage === "certificate_verified"
    || stage === "timestamp_proof_pending"
    || stage === "bitcoin_anchor_verified";
}
