import { readConfig } from "@/lib/config";
import { DigitalPurchaseError } from "@/lib/digital-purchase";
import { prepareBitcoinAnchorPurchase } from "@/lib/digital-purchase-service";
import { sameOriginRequest } from "@/lib/request-origin";
import { localPurchaseJournal } from "@/lib/purchase-journal";
import { buildSponsoredPaymentPreview } from "@/lib/sponsored-payment";

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
      if (stored && (stored.wallet !== review.wallet.address || stored.requestUrl !== review.terms.resourceUrl || stored.state !== "prepared")) {
        throw new DigitalPurchaseError("An existing purchase attempt needs recovery. No new payment was prepared.");
      }
      const rpc = await fetch(readConfig().solanaRpcUrl, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestBlockhash", params: [{ commitment: "confirmed" }] }),
        signal: AbortSignal.timeout(12_000),
      });
      const latest = await rpc.json() as { result?: { value?: { blockhash?: string; lastValidBlockHeight?: number } } };
      const lifetime = latest.result?.value;
      if (!rpc.ok || !lifetime?.blockhash || !Number.isSafeInteger(lifetime.lastValidBlockHeight)) {
        throw new DigitalPurchaseError("Could not prepare a fresh unsigned payment lifetime.");
      }
      const preview = buildSponsoredPaymentPreview({ terms: review.terms, wallet: review.wallet.address,
        attemptId: id, blockhash: lifetime.blockhash, nowMs: Date.now() });
      const unsignedPayment = Buffer.from(preview.transaction).toString("base64");
      const reviewedTerms = JSON.stringify({ terms: review.terms, conversion: review.conversion, spend: review.spend });
      if (!stored) journal.prepare({
        id, wallet: review.wallet.address, idempotencyKey: id,
        requestUrl: review.terms.resourceUrl, requestBody: "",
        reviewedTerms, unsignedPayment,
        createdAt: new Date().toISOString(),
      });
      else journal.refreshUnsignedReview(id, reviewedTerms, unsignedPayment);
      review.paymentPreview = { status: "built_unsigned", version: "v0", signatureSlots: 2, signaturesPresent: 0,
        memo: preview.memo, lastValidBlockHeight: lifetime.lastValidBlockHeight!,
        detail: "Unsigned 1 USDC payment stored privately. Shopper and sponsor signature slots are empty. Not simulated, not sponsor-approved, not signed, and not sent. Conversion must settle before payment funding is checked again." };
    }
    return Response.json(review, { headers });
  } catch (error) {
    const message = error instanceof DigitalPurchaseError
      ? error.message
      : "The merchant quote could not be prepared.";
    return Response.json({ error: message }, { status: error instanceof DigitalPurchaseError ? 400 : 502, headers });
  }
}
