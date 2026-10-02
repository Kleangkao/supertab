import { describe, expect, it } from "vitest";
import { fetchDflowOrder } from "../../src/lib/dflow";
import { USDC_MINT, WSOL_MINT } from "../../src/lib/tokens";

const live = process.env.SUPERTAB_LIVE === "1";

describe.skipIf(!live)("live read-only providers", () => {
  it("gets a real DFlow SOL to USDC quote and does not receive a transaction", async () => {
    const quote = await fetchDflowOrder({
      inputMint: WSOL_MINT,
      outputMint: USDC_MINT,
      amount: 10_000_000n,
    }, {
      baseUrl: process.env.DFLOW_QUOTE_BASE_URL || "https://dev-quote-api.dflow.net",
      apiKey: process.env.DFLOW_API_KEY,
    });
    expect(quote.outputMint).toBe(USDC_MINT);
    expect(quote.outAmount).toBeGreaterThan(0n);
    expect(quote.transactionPresent).toBe(false);
  });
});
