import { buildHealth } from "@/lib/health";
import { readConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const health = await buildHealth(readConfig());
  return Response.json(health);
}
