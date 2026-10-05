import { DigitalPurchaseError } from "@/lib/digital-purchase";
import { localPurchaseJournal } from "@/lib/purchase-journal";
import { sameOriginRequest } from "@/lib/request-origin";
import {
  acceptApproval,
  boundTermsFromStoredReview,
  createReview,
  publicWorkflow,
  readBoundTerms,
} from "@/lib/purchase-workflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "cache-control": "no-store" };
  try {
    if (!sameOriginRequest(request)) {
      return Response.json({ error: "Use the prepared purchase from SuperTab." }, { status: 403, headers });
    }
    const body = await request.json() as { attemptId?: unknown; terms?: unknown };
    const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
    const posted = readBoundTerms(body.terms);
    if (!attemptId || !posted) throw new DigitalPurchaseError("Approval needs the exact reviewed terms.");
    const journal = localPurchaseJournal(attemptId);
    const record = journal.read();
    if (!record || record.wallet !== posted.wallet) throw new DigitalPurchaseError("No stored attempt matches this wallet.");
    const stored = boundTermsFromStoredReview(record.reviewedTerms, record.wallet);
    if (!stored) throw new DigitalPurchaseError("The stored review cannot be approved.");
    const current = record.workflow ?? createReview(record.id, new Date().toISOString());
    const decision = acceptApproval(current, `approval-${posted.merchantExpiresAt}`, stored, new Date().toISOString(), Date.now());
    if (decision.workflow.state !== "approved_terms" || decision.workflow.mismatch) {
      throw new DigitalPurchaseError(decision.workflow.mismatch ?? "These terms were not approved.");
    }
    const mismatch = decision.workflow.terms && (
      decision.workflow.terms.wallet !== posted.wallet
      || decision.workflow.terms.digest !== posted.digest
      || decision.workflow.terms.amountAtomic !== posted.amountAtomic
      || decision.workflow.terms.recipient !== posted.recipient
      || decision.workflow.terms.sponsor !== posted.sponsor
      || decision.workflow.terms.solCapLamports !== posted.solCapLamports
      || decision.workflow.terms.conversionInputLamports !== posted.conversionInputLamports
      || decision.workflow.terms.minimumOutputAtomic !== posted.minimumOutputAtomic
      || decision.workflow.terms.slippageBps !== posted.slippageBps
    );
    if (mismatch) throw new DigitalPurchaseError("The posted terms do not match the stored review.");
    journal.saveWorkflow(attemptId, decision.workflow);
    return Response.json({ workflow: publicWorkflow(decision.workflow) }, { headers });
  } catch (error) {
    const message = error instanceof DigitalPurchaseError ? error.message : "The terms could not be recorded.";
    return Response.json({ error: message, executionReady: false, retrySwap: false, retryPayment: false }, { status: error instanceof DigitalPurchaseError ? 400 : 500, headers });
  }
}
