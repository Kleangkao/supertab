import { describe, expect, it } from "vitest";
import { readConfig } from "../../src/lib/config";
import { requestConversionQuote } from "../../src/lib/conversion-service";
import { fetchDflowOrder, fetchPreparedTransaction } from "../../src/lib/dflow";
import { NATIVE_SOL_MINT, USDC_MINT, WSOL_MINT } from "../../src/lib/tokens";

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

  it("reviews a real mainnet SOL to USDC quote and checks the unsigned transaction without sending it", async () => {
    const userPublicKey = process.env.SUPERTAB_PUBLIC_ADDRESS || "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg";
    const review = await requestConversionQuote({
      network: "solana:mainnet-beta",
      inputMint: NATIVE_SOL_MINT,
      amountText: "0.01",
      assetKind: "native",
      walletAddress: userPublicKey,
    }, {
      config: readConfig(),
      fetchImpl: fetch,
    });
    if (!("validation" in review)) throw new Error("expected a mainnet quote");
    expect(review.outputMint).toBe(USDC_MINT);
    expect(review.inputMint).toBe(WSOL_MINT);
    expect(review.completed).toBe(false);
    expect(review.signing).toBe("unavailable");
    expect(review.broadcast).toBe("unavailable");
    expect(review.walletUsdcIncludesQuote).toBe(false);
    expect(BigInt(review.estimatedOutputBase)).toBeGreaterThan(0n);
    expect(BigInt(review.minimumOutputBase)).toBeLessThanOrEqual(BigInt(review.estimatedOutputBase));
    expect(review.validation.status, review.validation.explanation).toBe("checked");
    expect(JSON.stringify(review)).not.toMatch(/[A-Za-z0-9+/]{80}/);
  });
});
