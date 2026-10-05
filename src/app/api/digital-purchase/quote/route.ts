import { readConfig } from "@/lib/config";
import { DigitalPurchaseError } from "@/lib/digital-purchase";
import { prepareBitcoinAnchorPurchase } from "@/lib/digital-purchase-service";
import { sameOriginRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "cache-control": "no-store" };
  try {
    if (!sameOriginRequest(request)) {
      return Response.json({ error: "Use the prepared purchase from SuperTab." }, { status: 403, headers });
    }
    const body = await request.json() as { walletAddress?: unknown; walletSource?: unknown };
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress : undefined;
    const walletSource = body.walletSource === "connected" ? "connected" : "read_only";
    const review = await prepareBitcoinAnchorPurchase({ walletAddress, walletSource }, { config: readConfig() });
    return Response.json(review, { headers });
  } catch (error) {
    const message = error instanceof DigitalPurchaseError
      ? error.message
      : "The merchant quote could not be prepared.";
    return Response.json({ error: message }, { status: error instanceof DigitalPurchaseError ? 400 : 502, headers });
  }
}
