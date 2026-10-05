import { proxyRecover } from "@/lib/devnet-merchant-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  return proxyRecover();
}
