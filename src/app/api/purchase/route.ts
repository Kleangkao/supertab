import { getShoppingService } from "@/lib/shopping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      sessionId?: unknown;
      offerId?: unknown;
      quantity?: unknown;
      walletMode?: unknown;
      address?: unknown;
      fundingMint?: unknown;
    };
    if (typeof body.sessionId !== "string" || typeof body.offerId !== "string") {
      return Response.json({ error: "Choose a product from the current search." }, { status: 400 });
    }
    const walletMode = body.walletMode === "sample" || body.walletMode === "address" ? body.walletMode : "none";
    const view = await getShoppingService().review({
      sessionId: body.sessionId,
      offerId: body.offerId,
      quantity: typeof body.quantity === "number" ? body.quantity : 1,
      walletMode,
      address: typeof body.address === "string" ? body.address : undefined,
      fundingMint: typeof body.fundingMint === "string" ? body.fundingMint : null,
    });
    return Response.json(view);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Purchase review failed." }, { status: 400 });
  }
}
