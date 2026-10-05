import { describe, expect, it } from "vitest";
import { readConfig } from "../src/lib/config";
import {
  bitcoinAnchorBuyUrl,
  bitcoinAnchorDigest,
  conversionInputForMinimum,
  parseSolanaExactTerms,
  PRODUCT_PRICE_CAP_ATOMIC,
  solSpendCap,
} from "../src/lib/digital-purchase";
import { prepareBitcoinAnchorPurchase } from "../src/lib/digital-purchase-service";
import { MAINNET_GENESIS_HASH } from "../src/lib/wallet";
import { generateSolanaKey } from "../merchant/keys";
import { NATIVE_SOL_MINT, USDC_MINT } from "../src/lib/tokens";
import type { AssetBalance } from "../src/lib/tokens";

const PAY_TO = "DGxcPrAHL9YM3hW7iXuHFJmr87Zr6AMA4jCYHBpuvMgE";
const FEE_PAYER = "Hc3sdEAsCGQcpgfivywog9uwtk8gUBUZgsxdME1EJy88";
const NOW = Date.parse("2026-10-05T14:21:10.000Z");

function requirements(overrides: Record<string, unknown> = {}) {
  const solana = {
    scheme: "exact",
    network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    amount: "1000000",
    asset: USDC_MINT,
    payTo: PAY_TO,
    maxTimeoutSeconds: 300,
    extra: { feePayer: FEE_PAYER, quotedAt: "2026-10-05T14:21:09.795Z" },
    ...overrides,
  };
  return {
    x402Version: 2,
    resource: { url: bitcoinAnchorBuyUrl() },
    accepts: [
      { scheme: "exact", network: "eip155:8453", amount: "1000000", asset: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", payTo: "0xDD350976B8cfFc65938C0464d39A2C78BE079bd0" },
      solana,
    ],
  };
}

function balance(partial: Partial<AssetBalance> & Pick<AssetBalance, "mint" | "amount" | "decimals" | "kind">): AssetBalance {
  return {
    symbol: null,
    name: null,
    isUsdc: partial.mint === USDC_MINT,
    routeKnown: false,
    observed: true,
    ...partial,
  };
}

describe("Solana exact quote", () => {
  it("accepts the mainnet USDC option and leaves execution disabled", () => {
    const terms = parseSolanaExactTerms(requirements(), NOW);
    expect(terms.mint).toBe(USDC_MINT);
    expect(terms.amountAtomic).toBe("1000000");
    expect(terms.digest).toBe(bitcoinAnchorDigest());
    expect(terms.execution).toBe("disabled");
    expect(terms.signing).toBe("unavailable");
    expect(terms.shopperPaysNetworkFee).toBe(false);
    expect(terms.expiresAt).toBe("2026-10-05T14:26:09.795Z");
  });

  it("rejects a symbol-sized amount, the wrong mint, and a price above 2 USDC", () => {
    expect(() => parseSolanaExactTerms(requirements({ amount: "1.5" }), NOW)).toThrow(/base units/);
    expect(() => parseSolanaExactTerms(requirements({ asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" }), NOW)).toThrow(/mainnet USDC/);
    expect(() => parseSolanaExactTerms(requirements({ amount: (PRODUCT_PRICE_CAP_ATOMIC + 1n).toString() }), NOW)).toThrow(/2 USDC/);
    const evmOnly = requirements();
    evmOnly.accepts = [evmOnly.accepts[0]!];
    expect(() => parseSolanaExactTerms(evmOnly, NOW)).toThrow(/exactly one Solana/);
  });

  it("sizes conversion from the minimum received and refuses the whole wallet", () => {
    const shrink = conversionInputForMinimum({
      gapAtomic: 1_000_000n,
      inAmount: 10_000_000n,
      minOutAmount: 2_000_000n,
      spendableLamports: 40_000_000n,
      walletLamports: 50_000_000n,
    });
    expect(shrink.status).toBe("quote");
    if (shrink.status === "quote") expect(shrink.amount).toBeLessThan(10_000_000n);

    const estimateWouldCover = conversionInputForMinimum({
      gapAtomic: 1_000_000n,
      inAmount: 10_000_000n,
      minOutAmount: 100n,
      spendableLamports: 40_000_000n,
      walletLamports: 50_000_000n,
    });
    expect(estimateWouldCover).toEqual({ status: "uncovered" });

    expect(solSpendCap({
      conversionLamports: 50_000_000n,
      prioritizationFeeLamports: 1n,
      walletLamports: 50_000_000n,
    }).status).toBe("unbounded");
  });
});

describe("prepared purchase", () => {
  it("prepares a covered quote without a conversion or a payment", async () => {
    const wallet = generateSolanaKey().address;
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("/api/buy/bitcoin_anchor")) {
        expect(init?.method).toBe("GET");
        return new Response("{}", {
          status: 402,
          headers: { "payment-required": Buffer.from(JSON.stringify(requirements())).toString("base64") },
        });
      }
      const body = JSON.parse(String(init?.body)) as { method: string };
      if (body.method === "getGenesisHash") {
        return Response.json({ result: MAINNET_GENESIS_HASH });
      }
      if (body.method === "getAccountInfo") {
        return Response.json({ result: { value: { data: ["", "base64"] } } });
      }
      throw new Error(`Unexpected ${body.method}`);
    };
    const review = await prepareBitcoinAnchorPurchase({ walletAddress: wallet }, {
      config: readConfig({ SOLANA_RPC_URL: "https://rpc.test" }),
      fetchImpl,
      now: () => NOW,
      readBalances: async () => [
        balance({ mint: USDC_MINT, amount: 2_000_000n, decimals: 6, kind: "stablecoin" }),
        balance({ mint: NATIVE_SOL_MINT, amount: 20_000_000n, decimals: 9, kind: "native" }),
      ],
    });
    expect(review.execution).toBe("disabled");
    expect(review.orderCreated).toBe(false);
    expect(review.conversion.status).toBe("skipped");
    expect(review.readyForApproval).toBe(true);
    expect(review.spend.merchantUsdcAtomic).toBe("1000000");
    expect(review.spend.solLamports).toBe("0");
    expect(JSON.stringify(review)).not.toContain(wallet);
    expect(seen.some((url) => url.includes("dflow"))).toBe(false);
  });

  it("keeps the merchant quote when the conversion route is refused", async () => {
    const wallet = generateSolanaKey().address;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("/api/buy/bitcoin_anchor")) {
        return new Response("{}", {
          status: 402,
          headers: { "payment-required": Buffer.from(JSON.stringify(requirements())).toString("base64") },
        });
      }
      if (url.includes("dflow")) {
        return new Response(JSON.stringify({ msg: "Route not found" }), { status: 400 });
      }
      const body = JSON.parse(String(init?.body)) as { method: string };
      if (body.method === "getGenesisHash") return Response.json({ result: MAINNET_GENESIS_HASH });
      if (body.method === "getAccountInfo") return Response.json({ result: { value: { data: ["", "base64"] } } });
      throw new Error(`Unexpected ${body.method}`);
    };
    const review = await prepareBitcoinAnchorPurchase({ walletAddress: wallet }, {
      config: readConfig({ SOLANA_RPC_URL: "https://rpc.test", DFLOW_QUOTE_BASE_URL: "https://quote.dflow.test" }),
      fetchImpl,
      now: () => NOW,
      readBalances: async () => [
        balance({ mint: USDC_MINT, amount: 4n, decimals: 6, kind: "stablecoin" }),
        balance({ mint: NATIVE_SOL_MINT, amount: 20_000_000n, decimals: 9, kind: "native" }),
      ],
    });
    expect(review.orderCreated).toBe(false);
    expect(review.execution).toBe("disabled");
    expect(review.conversion.status).toBe("short");
    expect(review.readyForApproval).toBe(false);
    expect(review.terms.amountAtomic).toBe("1000000");
  });
});
