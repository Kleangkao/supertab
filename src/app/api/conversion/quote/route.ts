import { readConfig } from "@/lib/config";
import { conversionFailureStatus, readConversionWallet, requestConversionQuote } from "@/lib/conversion-service";
import { sameOriginRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "cache-control": "no-store" };
  try {
    if (!sameOriginRequest(request)) {
      return Response.json({ error: "Use asset conversion from SuperTab." }, { status: 403, headers });
    }
    const body = await request.json() as Record<string, unknown>;
    const config = readConfig();
    if (body.action === "balances") {
      if (typeof body.address !== "string") {
        return Response.json({ error: "Enter a Solana address to read mainnet balances." }, { status: 400, headers });
      }
      return Response.json(await readConversionWallet(body.address, { config }), { headers });
    }
    const review = await requestConversionQuote({
      network: typeof body.network === "string" ? body.network : undefined,
      inputMint: typeof body.inputMint === "string" ? body.inputMint : undefined,
      amountText: typeof body.amountText === "string" ? body.amountText : undefined,
      assetKind: typeof body.assetKind === "string" ? body.assetKind : undefined,
      walletAddress: typeof body.walletAddress === "string" ? body.walletAddress : undefined,
    }, { config });
    return Response.json(review, { headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The conversion quote failed." },
      { status: conversionFailureStatus(error), headers },
    );
  }
}
