import { getShoppingService } from "@/lib/shopping";
import { sameOriginRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "cache-control": "no-store" };
  try {
    const origin = sameOriginRequest(request);
    if (!origin) return Response.json({ error: "Use the wallet check from SuperTab." }, { status: 403, headers });
    const body = await request.json() as Record<string, unknown>;
    const service = getShoppingService();
    if (body.action === "start" && typeof body.address === "string") {
      const started = service.beginWalletControl(body.address, origin);
      console.info("wallet-control start");
      return Response.json(started, { headers });
    }
    if (typeof body.sessionId !== "string" || typeof body.termsId !== "string") throw new Error("Review a product first.");
    if (body.action === "challenge") {
      const challenge = service.requestWalletCheck(body.sessionId, body.termsId, origin);
      console.info("wallet-control challenge");
      return Response.json(challenge, { headers });
    }
    if (body.action !== "verify" || typeof body.challengeId !== "string" || typeof body.signature !== "string") throw new Error("Invalid wallet check.");
    const confirmed = service.confirmWalletCheck(body.sessionId, body.termsId, body.challengeId, body.signature);
    console.info("wallet-control verify");
    return Response.json(confirmed, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The wallet check failed." }, { status: 400, headers });
  }
}
