import { expect, it } from "vitest";
import { readConfig } from "../src/lib/config";
import { ShoppingService } from "../src/lib/shopping";

it("cannot restore old wallet balances after a newer clear-wallet review", async () => {
  let release!: () => void;
  let entered!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const service = new ShoppingService({
    config: readConfig({ SOLANA_RPC_URL: "https://rpc.test", SHOPIFY_CATALOG_ENABLED: "true" }),
    fetchImpl: async (input, init) => {
      if (String(input).includes("rpc.test")) {
        const request = JSON.parse(String(init?.body));
        if (request.method === "getGenesisHash") return Response.json({ result: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d" });
        if (request.method === "getBalance") {
          entered(); await pending;
          return Response.json({ result: { value: 5_000_000 } });
        }
        return Response.json({ result: { value: [] } });
      }
      return Response.json({ result: { structuredContent: { products: [{
        id: "polo", title: "Black polo", variants: [{
          id: "gid://shopify/ProductVariant/1", title: "Black polo",
          price: { amount: 1000, currency: "USD" }, availability: { available: true },
          seller: { name: "Test merchant" }, checkout_url: "https://merchant.test/cart/1:1",
        }],
      }] } } });
    },
  });
  const search = await service.converse(null, "Find me a black polo under $50");
  const selection = { sessionId: search.sessionId, offerId: search.exact[0]!.id };
  const old = service.review({ ...selection, walletMode: "address", address: "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg" });
  await started;
  await service.review({ ...selection, walletMode: "none" });
  release(); await old;
  expect(service.getSession(search.sessionId).purchase).toMatchObject({
    walletMode: "none", walletAddress: null, balanceSource: "none", assets: [],
    unsignedTransaction: "not_requested", swapApproval: null,
  });
});
