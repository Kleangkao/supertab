import { proxyCheckout } from "@/lib/devnet-merchant-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json() as { buyer?: unknown };
  if (typeof body.buyer !== "string") return Response.json({ error: "Connect a Solana wallet before reviewing the checkout." }, { status: 400 });
  return proxyCheckout(body.buyer);
}
