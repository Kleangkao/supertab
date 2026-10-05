import { proxySubmitRefund } from "@/lib/devnet-merchant-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json() as { orderId?: unknown; signedTransaction?: unknown };
  if (typeof body.orderId !== "string" || typeof body.signedTransaction !== "string") {
    return Response.json({ error: "Sign the devnet refund before sending it." }, { status: 400 });
  }
  return proxySubmitRefund(body.orderId, body.signedTransaction);
}
