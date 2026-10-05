import { proxyPrepareRefund } from "@/lib/devnet-merchant-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json() as { orderId?: unknown };
  if (typeof body.orderId !== "string" || body.orderId.length < 8 || body.orderId.length > 80) {
    return Response.json({ error: "A merchant order id is required before preparing a refund." }, { status: 400 });
  }
  return proxyPrepareRefund(body.orderId);
}
