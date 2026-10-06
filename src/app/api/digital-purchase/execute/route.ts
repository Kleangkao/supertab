import { executeDigitalPurchase } from "@/lib/purchase-execution";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return executeDigitalPurchase(request);
}
