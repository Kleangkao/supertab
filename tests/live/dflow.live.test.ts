import { describe, expect, it } from "vitest";
import { fetchDflowOrder, fetchPreparedTransaction } from "../../src/lib/dflow";
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

  it("prepares an unsigned SOL to USDC transaction and keeps the payload out of the result", async () => {
    const userPublicKey = process.env.SUPERTAB_PUBLIC_ADDRESS || "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg";
    const prepared = await fetchPreparedTransaction({
      inputMint: WSOL_MINT,
      outputMint: USDC_MINT,
      amount: 10_000_000n,
      userPublicKey,
    }, {
      baseUrl: process.env.DFLOW_QUOTE_BASE_URL || "https://dev-quote-api.dflow.net",
      apiKey: process.env.DFLOW_API_KEY,
      timeoutMs: 20_000,
    });
    expect(prepared.prepared).toBe(true);
    if (!prepared.prepared) return;
    expect(["legacy", "v0"]).toContain(prepared.version);
    expect(prepared.byteLength).toBeGreaterThan(64);
    expect(JSON.stringify(prepared, (_key, value) => typeof value === "bigint" ? value.toString() : value)).not.toMatch(/[A-Za-z0-9+/]{80}/);
  });
});
