import { proxyOrder } from "@/lib/devnet-merchant-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("id") ?? "";
  if (!orderId) return Response.json({ error: "Enter the merchant order id." }, { status: 400 });
  return proxyOrder(orderId);
}
