import { proxyBroadcast } from "@/lib/devnet-merchant-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json() as { signedTransaction?: unknown };
  if (typeof body.signedTransaction !== "string") {
    return Response.json({ error: "Sign the devnet payment before sending it." }, { status: 400 });
  }
  return proxyBroadcast(body.signedTransaction);
}
