import { proxyConfirm } from "@/lib/devnet-merchant-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json() as { checkoutId?: unknown; signature?: unknown };
  if (typeof body.checkoutId !== "string" || typeof body.signature !== "string") {
    return Response.json({ error: "The merchant needs a checkout and a payment signature." }, { status: 400 });
  }
  return proxyConfirm(body.checkoutId, body.signature);
}
