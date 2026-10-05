import { readConfig } from "@/lib/config";
import { DigitalPurchaseError } from "@/lib/digital-purchase";
import { prepareBitcoinAnchorPurchase } from "@/lib/digital-purchase-service";
import { sameOriginRequest } from "@/lib/request-origin";
import { localPurchaseJournal } from "@/lib/purchase-journal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "cache-control": "no-store" };
  try {
    if (!sameOriginRequest(request)) {
      return Response.json({ error: "Use the prepared purchase from SuperTab." }, { status: 403, headers });
    }
    const body = await request.json() as { walletAddress?: unknown; walletSource?: unknown };
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress : undefined;
    const walletSource = body.walletSource === "connected" ? "connected" : "read_only";
    const review = await prepareBitcoinAnchorPurchase({ walletAddress, walletSource }, { config: readConfig() });
    // This client declaration is review identity, not authenticated spending authority.
    // No payment authorization is created, and no executable journal is returned.
    if (walletSource === "connected" && review.wallet.address && review.recovery.idempotencyKey) {
      const id = review.recovery.idempotencyKey;
      const journal = localPurchaseJournal(id);
      const stored = journal.read();
      if (!stored) journal.prepare({
        id, wallet: review.wallet.address, idempotencyKey: id,
        requestUrl: review.terms.resourceUrl, requestBody: "",
        reviewedTerms: JSON.stringify({ terms: review.terms, conversion: review.conversion, spend: review.spend }),
        createdAt: new Date().toISOString(),
      });
      else if (stored.wallet !== review.wallet.address || stored.requestUrl !== review.terms.resourceUrl || stored.state !== "prepared") {
        throw new DigitalPurchaseError("An existing purchase attempt needs recovery. No new payment was prepared.");
      }
    }
    return Response.json(review, { headers });
  } catch (error) {
    const message = error instanceof DigitalPurchaseError
      ? error.message
      : "The merchant quote could not be prepared.";
    return Response.json({ error: message }, { status: error instanceof DigitalPurchaseError ? 400 : 502, headers });
  }
}
