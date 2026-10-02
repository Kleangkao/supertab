import { getShoppingService } from "@/lib/shopping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let sessionId: string | null = null;
  try {
    const body = await request.json() as { sessionId?: unknown; termsId?: unknown; checkoutId?: unknown };
    if (typeof body.sessionId !== "string" || typeof body.termsId !== "string" || typeof body.checkoutId !== "string") {
      return Response.json({ error: "Select a product and provide its merchant checkout ID." }, { status: 400 });
    }
    sessionId = body.sessionId;
    return Response.json(await getShoppingService().verifyMerchantTotal(body.sessionId, body.termsId, body.checkoutId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    // Provider bodies may contain buyer information or capability keys. The
    // adapter supplies only controlled messages; never log raw request data.
    let session;
    try { if (sessionId) session = getShoppingService().getSession(sessionId); } catch { /* Session may have expired. */ }
    return Response.json({ error: error instanceof Error ? error.message : "Checkout verification failed.", session }, {
      status: 400, headers: { "Cache-Control": "no-store" },
    });
  }
}
