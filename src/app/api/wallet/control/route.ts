import { getShoppingService } from "@/lib/shopping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "cache-control": "no-store" };
  try {
    const origin = new URL(request.url).origin;
    if (request.headers.get("origin") !== origin) return Response.json({ error: "Use the wallet check from SuperTab." }, { status: 403, headers });
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.sessionId !== "string" || typeof body.termsId !== "string") throw new Error("Review a product first.");
    const service = getShoppingService();
    if (body.action === "challenge") return Response.json(service.requestWalletCheck(body.sessionId, body.termsId, origin), { headers });
    if (body.action !== "verify" || typeof body.challengeId !== "string" || typeof body.signature !== "string") throw new Error("Invalid wallet check.");
    return Response.json(service.confirmWalletCheck(body.sessionId, body.termsId, body.challengeId, body.signature), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The wallet check failed." }, { status: 400, headers });
  }
}
