import { expect, it } from "vitest";
import { readSolanaBalances } from "../src/lib/wallet";
import { planFunding } from "../src/lib/funding-planner";
import { USDC_MINT } from "../src/lib/tokens";
import type { PayableSnapshot } from "../src/lib/offers";

it("rejects conflicting decimals rather than combining incompatible balances", async () => {
  await expect(readSolanaBalances("vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg", {
    rpcUrl: "https://rpc.test",
    fetchImpl: async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      if (body.method === "getBalance") return Response.json({ result: { value: 20_000_000 } });
      const decimals = body.params[1].programId.startsWith("Tokenkeg") ? 6 : 9;
      return Response.json({ result: { value: [{ account: { data: { parsed: { info: {
        mint: USDC_MINT, tokenAmount: { amount: "1000000", decimals },
      } } } } }] } });
    },
  })).rejects.toThrow(/inconsistent decimals/);
});

it("counts all canonical USDC accounts in the real wallet funding path", async () => {
  const balances = await readSolanaBalances("vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg", {
    rpcUrl: "https://rpc.test",
    fetchImpl: async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      if (body.method === "getBalance") return Response.json({ result: { value: 20_000_000 } });
      const entries = body.params[1].programId.startsWith("Tokenkeg") ? ["5000000", "7000000"] : [];
      return Response.json({ result: { value: entries.map(amount => ({
        account: { data: { parsed: { info: { mint: USDC_MINT, tokenAmount: { amount, decimals: 6 } } } } },
      })) } });
    },
  });
  const snapshot: PayableSnapshot = {
    itemMinor: 1000n, itemCurrency: "USD", itemExponent: 2, itemBasis: "catalog",
    quantity: 1, lineMinor: 1000n, shippingMinor: null, shippingCurrency: null,
    taxMinor: null, discountMinor: null, merchantTotalMinor: null, merchantTotalKnown: false,
    currency: "USD", note: "Catalog planning amount only.",
  };
  const plan = planFunding({ snapshot, balances, selectedFundingMint: null, quote: null, nowMs: 1000 });
  expect(plan.existingUsdcBase).toBe(12_000_000n);
  expect(plan.deficitUsdcBase).toBe(0n);
  expect(plan.readiness).toBe("covered_by_usdc");
  expect(balances.filter(asset => asset.mint === USDC_MINT)).toHaveLength(1);
});
