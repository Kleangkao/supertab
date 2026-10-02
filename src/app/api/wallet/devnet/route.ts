import { getShoppingService } from "@/lib/shopping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "cache-control": "no-store" };
  try {
    const origin = new URL(request.url).origin;
    if (request.headers.get("origin") !== origin) return Response.json({ error: "Use the devnet check from SuperTab." }, { status: 403, headers });
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.sessionId !== "string" || typeof body.termsId !== "string") throw new Error("Review a product first.");
    const service = getShoppingService();
    if (body.action === "prepare") return Response.json(await service.prepareDevnetSigning(body.sessionId, body.termsId, origin), { headers });
    if (body.action !== "verify" || typeof body.checkId !== "string" || typeof body.signedTransaction !== "string") throw new Error("Invalid devnet check.");
    return Response.json(service.confirmDevnetSigning(body.sessionId, body.termsId, body.checkId, body.signedTransaction), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The devnet check failed." }, { status: 400, headers });
  }
}
