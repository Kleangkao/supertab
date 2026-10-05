import { FinancialExecutionDisabled } from "@/lib/execution";
import { sameOriginRequest } from "@/lib/request-origin";
import { beginExecution, mainnetExecutionGate } from "@/lib/purchase-workflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "cache-control": "no-store" };
  if (!sameOriginRequest(request)) {
    return Response.json({ error: "Use the prepared purchase from SuperTab." }, { status: 403, headers });
  }
  await request.json().catch(() => null);
  const gate = mainnetExecutionGate();
  try {
    beginExecution(gate);
  } catch (error) {
    if (error instanceof FinancialExecutionDisabled) {
      return Response.json({
        executionGate: "off",
        executionReady: false,
        retrySwap: false,
        retryPayment: false,
        error: error.message,
      }, { status: 403, headers });
    }
    throw error;
  }
  return Response.json({
    executionGate: gate,
    executionReady: false,
    retrySwap: false,
    retryPayment: false,
    error: "No execution adapter is configured. Nothing was signed or sent.",
  }, { status: 403, headers });
}
