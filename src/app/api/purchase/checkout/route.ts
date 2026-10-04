import { getShoppingService } from "@/lib/shopping";
import { buyerIpForRequest } from "@/lib/buyer-context";
import { readConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let sessionId: string | null = null;
  try {
    const body = await request.json() as { sessionId?: unknown; termsId?: unknown; checkoutId?: unknown; destination?: unknown };
    if (typeof body.sessionId !== "string" || typeof body.termsId !== "string") {
      return Response.json({ error: "Select a product before asking the merchant to price it." }, { status: 400 });
    }
    sessionId = body.sessionId;
    const buyerIp = buyerIpForRequest(request, readConfig());
    const session = body.destination != null
      ? await getShoppingService().calculateMerchantTotal(body.sessionId, body.termsId, body.destination, buyerIp)
      : typeof body.checkoutId === "string"
        ? await getShoppingService().verifyMerchantTotal(body.sessionId, body.termsId, body.checkoutId, buyerIp)
        : null;
    if (!session) return Response.json({ error: "Provide delivery details or an existing merchant checkout reference." }, { status: 400 });
    return Response.json(session, { headers: { "Cache-Control": "no-store" } });
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
