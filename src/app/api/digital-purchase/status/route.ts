import { executionStatus } from "@/lib/purchase-execution";
import { localPurchaseJournal } from "@/lib/purchase-journal";
import { sameOriginRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST supplies Origin for the existing same-origin guard; this only reads the journal.
export async function POST(request: Request) {
  const headers = { "cache-control": "no-store" };
  if (!sameOriginRequest(request)) {
    return Response.json({ error: "Use the prepared purchase from SuperTab." }, { status: 403, headers });
  }
  const attemptId = new URL(request.url).searchParams.get("attemptId") ?? "";
  if (!attemptId) return Response.json({ error: "The attempt is missing." }, { status: 400, headers });
  try {
    return Response.json(executionStatus(localPurchaseJournal(attemptId)), { headers });
  } catch {
    return Response.json({
      error: "The stored attempt cannot be read. Do not start another payment.",
      executionReady: false,
      retrySwap: false,
      retryPayment: false,
    }, { status: 409, headers });
  }
}
