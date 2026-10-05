import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readConfig } from "../../src/lib/config";
import { prepareBitcoinAnchorPurchase } from "../../src/lib/digital-purchase-service";
import { USDC_MINT } from "../../src/lib/tokens";

const live = process.env.SUPERTAB_LIVE === "1";

function authorizedAddress(): string {
  const src = readFileSync(new URL("../../src/components/shop-app.tsx", import.meta.url), "utf8");
  const address = src.match(/const DEMO_ADDRESS = "([1-9A-HJ-NP-Za-km-z]+)"/)?.[1];
  if (!address) throw new Error("The authorized demo address is missing.");
  return address;
}

describe.skipIf(!live)("live unpaid digital purchase", () => {
  it("reads a merchant quote and an unsigned conversion without paying", async () => {
    const walletAddress = authorizedAddress();
    const review = await prepareBitcoinAnchorPurchase({ walletAddress }, { config: readConfig() });
    const serialized = JSON.stringify(review);
    expect(serialized).not.toContain(walletAddress);
    expect(review.execution).toBe("disabled");
    expect(review.signing).toBe("unavailable");
    expect(review.broadcast).toBe("unavailable");
    expect(review.orderCreated).toBe(false);
    expect(review.terms.mint).toBe(USDC_MINT);
    expect(review.terms.network).toBe("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
    expect(BigInt(review.terms.amountAtomic)).toBeLessThanOrEqual(2_000_000n);
    expect(review.terms.shopperPaysNetworkFee).toBe(false);
    if (review.conversion.inputLamports && review.wallet.solLamports) {
      expect(BigInt(review.conversion.inputLamports)).toBeLessThan(BigInt(review.wallet.solLamports));
    }
    if (review.conversion.status === "quoted" && review.wallet.usdcAtomic) {
      const gap = BigInt(review.terms.amountAtomic) - BigInt(review.wallet.usdcAtomic);
      expect(BigInt(review.conversion.minimumUsdcAtomic ?? "0")).toBeGreaterThanOrEqual(gap);
    }
  }, 60_000);
});
