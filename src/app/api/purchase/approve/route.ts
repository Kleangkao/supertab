import { getShoppingService } from "@/lib/shopping";
import { executeSwap } from "@/lib/execution";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { sessionId?: unknown; execute?: unknown };
    if (body.execute === true) {
      executeSwap();
    }
    if (typeof body.sessionId !== "string") {
      return Response.json({ error: "Missing shopping session." }, { status: 400 });
    }
    const view = await getShoppingService().approve(body.sessionId);
    return Response.json(view);
  } catch (error) {
    const status = error instanceof Error && error.name === "FinancialExecutionDisabled" ? 403 : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Approval failed." }, { status });
  }
}
