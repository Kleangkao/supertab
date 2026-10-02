import { createHmac } from "node:crypto";
import { clearWalletReview } from "../src/lib/wallet-review";
import { describe, expect, it } from "vitest";
import { mapBridgeCardEvent, verifyIssuingWebhook } from "../src/lib/bridge-events";
import { BridgeCardRail, describeSolanaFundingBinding } from "../src/lib/bridge-rail";
import { emptyConstraints, mergeConstraints, resolveConstraints } from "../src/lib/constraints";
import { fetchDflowOrder, parseDflowOrder, priceImpactPercentLabel, QUOTE_FRESHNESS_MS, solanaTransactionSummary } from "../src/lib/dflow";
import { normalizeEbaySummaries, searchEbay } from "../src/lib/ebay";
import { broadcastTransaction, executeCardPayment, executeSwap } from "../src/lib/execution";
import { classifyOffers } from "../src/lib/filter-offers";
import { planFunding, quoteIsUsable, type BoundQuote } from "../src/lib/funding-planner";
import { formatMinor, usdMinorToUsdcBase } from "../src/lib/money";
import { payableFromOffer, type NormalizedOffer } from "../src/lib/offers";
import { transitionPurchase } from "../src/lib/purchase";
import { assertPaymentCanStart, UnavailablePaymentRail } from "../src/lib/card-rail";
import { capturedPaymentIsNotAnOrder } from "../src/lib/payment-lifecycle";
import { assertPurchasePayable, createPurchaseIntent } from "../src/lib/purchase-intent";
import { paymentDoesNotProveOrder } from "../src/lib/order-evidence";
import { normalizeShopifyProducts, searchShopify } from "../src/lib/shopify";
import { toOfferView } from "../src/lib/serialize";
import { buildHealth } from "../src/lib/health";
import { readConfig } from "../src/lib/config";
import { createReadOnlyWallet, isPlausibleAddress, parseTokenAccounts } from "../src/lib/wallet";
import { connectStandardWallet, discoverStandardWallets } from "../src/lib/wallet-standard";
import { JUP_MINT, USDC_MINT, WSOL_MINT, sampleSpendingAssets } from "../src/lib/tokens";
import { extractConstraintPatch, extractOutputText } from "../src/lib/gemini";
import { configStamp, ShoppingService } from "../src/lib/shopping";
import type { AppConfig } from "../src/lib/config";

const NOW = "2026-04-02T00:00:00.000Z";

describe("shopping constraints", () => {
  it("keeps a polo and a budget when a later message only adds navy", () => {
    const first = mergeConstraints(emptyConstraints(), "Find me a black polo under $50.");
    const next = mergeConstraints(first, "Navy is fine too.");
    expect(next.productQuery).toContain("polo");
    expect(next.colors).toEqual(["black", "navy"]);
    expect(next.maxPriceCents).toBe(5000n);
    expect(next.requiredTerms).toContain("polo");
  });

  it("replaces the product on a new search", () => {
    const first = mergeConstraints(emptyConstraints(), "Find me a black polo under $50.");
    const next = mergeConstraints(first, "Find me black running shoes, size 42, under $120.");
    expect(next.productQuery).toBe("running shoes");
    expect(next.colors).toEqual(["black"]);
    expect(next.sizes).toEqual(["42"]);
    expect(next.maxPriceCents).toBe(12000n);
    expect(next.requiredTerms).not.toContain("polo");
  });

  it("does not let a model drop a hard budget or invent a color", () => {
    const current = mergeConstraints(emptyConstraints(), "Find me a black polo under $50.");
    const resolved = resolveConstraints(current, "Navy is fine too.", {
      isNewSearch: false,
      productQuery: "hat",
      addColors: ["red"],
      clearMaxPrice: true,
      maxPriceCents: 100n,
    });
    expect(resolved.productQuery).toContain("polo");
    expect(resolved.colors).toEqual(["black", "navy"]);
    expect(resolved.maxPriceCents).toBe(5000n);
  });
});

describe("commerce normalization", () => {
  it("keeps Polo branded fragrance out of a polo clothing shortlist", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me a black polo under $50.");
    const classified = classifyOffers([
      offer({ title: "Polo Black by Ralph Lauren 4.2 oz EDT Cologne for Men", amount: 3600n }),
      offer({ title: "Black Torrey Polo", amount: 2700n, id: "shirt" }),
    ], constraints);
    expect(classified.exact.map(item => item.id)).toEqual(["shirt"]);
    expect(classified.excluded[0]?.reasons.join(" ")).toMatch(/clothing|fragrance/i);
  });
  it("normalizes a Shopify catalog variant without inventing shipping or tax", () => {
    const [offer] = normalizeShopifyProducts([shopifyProduct()], NOW);
    expect(offer?.source).toBe("shopify");
    expect(offer?.merchant).toBe("Start Fitness");
    expect(offer?.price?.amountMinor).toBe(10850n);
    expect(offer?.price?.basis).toBe("catalog");
    expect(offer?.availability).toBe("in_stock");
    expect(offer?.variantLabel).toBe("42");
    expect(offer?.shipping).toBeNull();
    expect(offer?.checkout.kind).toBe("merchant_cart_link");
    expect(payableFromOffer(offer!, 1).merchantTotalKnown).toBe(false);
    expect(toOfferView(offer!).priceDisplay).toBe("$108.50");
    const euro = { ...offer!, price: { ...offer!.price!, currency: "EUR" } };
    expect(toOfferView(euro).priceDisplay).toBe("108.50 EUR");
  });

  it("normalizes an eBay listing and keeps purchase unavailable", () => {
    const [free, priced, unknown] = normalizeEbaySummaries([
      ebayItem({ shippingOptions: [{ shippingCostType: "FREE" }] }),
      ebayItem({ itemId: "v1|2", shippingOptions: [{ shippingCost: { value: "8.50", currency: "USD" } }] }),
      ebayItem({ itemId: "v1|3", shippingOptions: undefined }),
    ], NOW);
    expect(free?.price?.amountMinor).toBe(2499n);
    expect(free?.shipping?.costMinor).toBe(0n);
    expect(priced?.shipping?.costMinor).toBe(850n);
    expect(unknown?.shipping).toBeNull();
    expect(free?.checkout).toEqual({
      kind: "unavailable",
      reason: "eBay listing search does not include permission to purchase or place an order.",
    });
  });

  it("filters hard constraints and explains misses", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me black running shoes, size 42, under $120.");
    const offers = [
      offer({ title: "Black running shoes", variantLabel: "42", amount: 10850n }),
      offer({ title: "Black running shoes", variantLabel: "41", amount: 9000n, id: "shopify:b" }),
      offer({ title: "Black running shoes", variantLabel: "42", amount: 14000n, id: "shopify:c" }),
    ];
    const classified = classifyOffers(offers, constraints);
    expect(classified.exact.map((item) => item.id)).toEqual(["shopify:a"]);
    expect(classified.excluded.map((item) => item.reasons.join(" ")).join(" ")).toContain("Size");
    expect(classified.excluded.map((item) => item.reasons.join(" ")).join(" ")).toContain("budget");
  });

  it("keeps a real title when it matches one required product word", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me black running shoes under $120.");
    const classified = classifyOffers([
      offer({ title: "Hoka Clifton 10 Black Running", amount: 9000n }),
    ], constraints);
    expect(classified.exact).toHaveLength(1);
    expect(classified.excluded).toHaveLength(0);
  });

  it("reports eBay as not configured and Shopify timeouts without throwing", async () => {
    const missing = await searchEbay({ query: "shoes", maxPriceCents: null, limit: 5 }, {
      clientId: null,
      clientSecret: null,
    });
    expect(missing.status).toBe("not_configured");
    const timedOut = await searchShopify({ query: "shoes", maxPriceCents: null, shipToCountry: "US", limit: 5 }, {
      enabled: true,
      fetchImpl: () => Promise.reject(Object.assign(new Error("timed out"), { name: "TimeoutError" })),
    });
    expect(timedOut.status).toBe("timeout");
    expect(timedOut.offers).toEqual([]);
  });
});

describe("wallet and funding", () => {
  it("uses chain decimals and detects canonical USDC only", () => {
    const parsed = parseTokenAccounts([
      tokenAccount(USDC_MINT, "42000000", 6),
      tokenAccount("FakeMint1111111111111111111111111111111111", "1000000000", 9),
      tokenAccount("NotUsdc11111111111111111111111111111111111", "5000000", 6),
    ]);
    const usdc = parsed.find((item) => item.isUsdc);
    const fake = parsed.find((item) => item.mint.startsWith("Fake"));
    expect(usdc?.amount).toBe(42_000_000n);
    expect(formatMinor(usdc!.amount, usdc!.decimals)).toBe("42");
    expect(fake?.isUsdc).toBe(false);
    expect(fake?.decimals).toBe(9);
    expect(fake?.routeKnown).toBe(false);
    expect(parsed.find((item) => item.mint.startsWith("NotUsdc"))?.symbol).toBeNull();
  });

  it("calculates a USDC deficit and keeps a SOL reserve", () => {
    const snapshot = payableFromOffer(offer({ amount: 18900n }), 1);
    const plan = planFunding({
      snapshot,
      balances: [
        { ...sampleSpendingAssets()[0]!, amount: 110_000_000n },
        { ...sampleSpendingAssets()[1]!, amount: 400_000_000n },
        sampleSpendingAssets()[2]!,
      ],
      selectedFundingMint: null,
      quote: quote({ outAmount: 80_000_000n, inAmount: 50_000_000n }),
      nowMs: 1_000,
    });
    expect(plan.existingUsdcBase).toBe(110_000_000n);
    expect(plan.deficitUsdcBase).toBe(79_000_000n);
    expect(usdMinorToUsdcBase(18900n)).toBe(189_000_000n);
    expect(plan.networkReserveLamports).toBe(10_000_000n);
    expect(plan.candidateSpendableBase).toBe(390_000_000n);
    expect(plan.fundable).toBe(true);
    expect(plan.readiness).toBe("needs_conversion");
    expect(plan.merchantTotalKnown).toBe(false);
  });

  it("invalidates a quote when the amount, asset, or time changes", () => {
    const bound = quote({ outAmount: 80_000_000n, inAmount: 50_000_000n });
    expect(quoteIsUsable(bound, 18900n, WSOL_MINT, 1_000)).toBe("live");
    expect(quoteIsUsable(bound, 19000n, WSOL_MINT, 1_000)).toBe("mismatched");
    expect(quoteIsUsable(bound, 18900n, JUP_MINT, 1_000)).toBe("mismatched");
    expect(quoteIsUsable(bound, 18900n, WSOL_MINT, bound.expiresAtMs + 1)).toBe("stale");
    expect(quoteIsUsable(bound, 18900n, WSOL_MINT, bound.expiresAtMs)).toBe("stale");
  });
  it("requires the minimum received to cover the gap after slippage", () => {
    const plan = planFunding({ snapshot: payableFromOffer(offer({ amount: 18900n }), 1),
      balances: [{ ...sampleSpendingAssets()[0]!, amount: 110_000_000n }, sampleSpendingAssets()[1]!],
      selectedFundingMint: null,
      quote: { ...quote({ outAmount: 80_000_000n, inAmount: 50_000_000n }), minOutAmount: 78_000_000n }, nowMs: 1000 });
    expect(plan.quoteFreshness).toBe("live");
    expect(plan.fundable).toBe(false);
    expect(plan.readiness).toBe("not_fundable");
  });

  it("does not spend the SOL reserve or an unsupported token automatically", () => {
    const snapshot = payableFromOffer(offer({ amount: 5000n }), 1);
    const plan = planFunding({
      snapshot,
      balances: [
        { ...sampleSpendingAssets()[0]!, amount: 0n },
        { ...sampleSpendingAssets()[1]!, amount: 5_000_000n },
        { mint: "Unsupported111111111111111111111111111111", symbol: null, name: null, decimals: 6, amount: 1_000_000_000n, kind: "spl", isUsdc: false, routeKnown: false, observed: true },
      ],
      selectedFundingMint: null,
      quote: null,
      nowMs: 1_000,
    });
    expect(plan.candidateMint).toBeNull();
    expect(plan.readiness).toBe("not_fundable");
  });
});

describe("dflow quotes", () => {
  it("rejects a truncated transaction with a plausible version marker", () => {
    const truncated = Buffer.concat([Buffer.from([1]), Buffer.alloc(64), Buffer.from([0x80, 0, 0])]).toString("base64");
    expect(solanaTransactionSummary(truncated).valid).toBe(false);
  });
  it("parses a real quote shape and treats the documented price impact scale", () => {
    const parsed = parseDflowOrder({
      inputMint: WSOL_MINT,
      inAmount: "10000000",
      outputMint: USDC_MINT,
      outAmount: "1220191",
      minOutAmount: "1214091",
      slippageBps: 50,
      platformFee: null,
      priceImpactPct: "0.01",
      contextSlot: 452552361,
      executionMode: "sync",
    });
    expect(parsed.outAmount).toBe(1_220_191n);
    expect(parsed.transactionPresent).toBe(false);
    expect(priceImpactPercentLabel(parsed.priceImpactPct)).toBe("1%");
    expect(priceImpactPercentLabel("0")).toBe("0%");
    expect(QUOTE_FRESHNESS_MS).toBe(45_000);
  });
});

describe("payment and order separation", () => {
  it("keeps the card rail unavailable and blocks payment and swap execution", () => {
    const rail = new UnavailablePaymentRail();
    expect(rail.status().availability).toBe("not_connected");
    expect(() => assertPaymentCanStart(rail)).toThrow(/cannot start/i);
    expect(() => transitionPurchase("FUNDS_READY", "PAYMENT_READY", { railReady: false })).toThrow(/unavailable/i);
    expect(() => transitionPurchase("AWAITING_SWAP_APPROVAL", "SWAP_PENDING")).toThrow(/disabled/i);
    expect(() => executeSwap()).toThrow(/disabled/i);
    expect(() => executeCardPayment()).toThrow(/disabled/i);
    expect(() => broadcastTransaction()).toThrow(/disabled/i);
  });

  it("does not treat a payment confirmation as an order", () => {
    expect(() => transitionPurchase("PAYMENT_CONFIRMED", "ORDER_CONFIRMED", {
      executionPermitted: true,
      paymentEvidence: { providerId: "rail", providerReference: "pay_1", confirmedAt: NOW },
    })).toThrow(/Cannot move a purchase from PAYMENT_CONFIRMED to ORDER_CONFIRMED/);
    expect(() => transitionPurchase("ORDER_PENDING", "ORDER_CONFIRMED", {
      paymentEvidence: { providerId: "rail", providerReference: "pay_1", confirmedAt: NOW },
    })).toThrow(/merchant order evidence/i);
    const ordered = transitionPurchase("ORDER_PENDING", "ORDER_CONFIRMED", {
      merchantOrderEvidence: {
        kind: "merchant_order_api",
        reference: "order-1",
        verifiedAt: NOW,
      },
    });
    expect(ordered).toBe("ORDER_CONFIRMED");
    const confirmed = transitionPurchase("PAYMENT_PENDING", "PAYMENT_CONFIRMED", {
      executionPermitted: true,
      paymentEvidence: { providerId: "rail", providerReference: "pay_1", confirmedAt: NOW },
    });
    expect(confirmed).toBe("PAYMENT_CONFIRMED");
    expect(paymentDoesNotProveOrder(
      { providerId: "rail", providerReference: "pay_1", confirmedAt: NOW },
      null,
    )).toBe(true);
  });
});

describe("configuration reporting", () => {
  it("reports capability state without secret values", async () => {
    const secret = "super-secret-gemini-key";
    const config = readConfig({
      GEMINI_API_KEY: secret,
      EBAY_CLIENT_ID: "",
      SOLANA_RPC_URL: "https://rpc.example.test/?api-key=rpc-secret-value",
      DFLOW_API_KEY: "dflow-secret-value",
    });
    const health = await buildHealth(config, async (input) => {
      const url = String(input);
      if (url.includes("/order")) return Response.json({ inAmount: "1000000", outAmount: "1000" });
      return Response.json({ result: "ok" });
    });
    expect(health.gemini).toBe("configured");
    expect(health.geminiModel).toBe("gemini-3.5-flash-lite");
    expect(health.dflow).toBe("live_quote");
    expect(health.ebay).toBe("not_configured");
    expect(health.shopify).toBe("configured");
    expect(health.cardRail).toBe("sandbox_blocked");
    expect(health.financialExecution).toBe("disabled");
    const text = JSON.stringify(health);
    expect(text).not.toContain(secret);
    expect(text).not.toContain("rpc-secret-value");
    expect(text).not.toContain("dflow-secret-value");
  });
});

describe("Gemini interactions", () => {
  it("reads the current steps reply instead of the removed outputs field", () => {
    const text = extractOutputText({
      steps: [
        { type: "thought", content: [{ type: "text", text: "ignore this" }] },
        {
          type: "model_output",
          content: [{ type: "text", text: "{\"isNewSearch\":false}" }],
        },
      ],
    });
    expect(text).toBe("{\"isNewSearch\":false}");
  });

  it("uses a model patch for a follow-up and keeps the shopper's budget", async () => {
    const service = new ShoppingService({
      config: readConfig({
        SHOPIFY_CATALOG_ENABLED: "true",
        GEMINI_API_KEY: "test-gemini-key",
        EBAY_CLIENT_ID: "",
        EBAY_CLIENT_SECRET: "",
        DFLOW_QUOTE_BASE_URL: "https://dflow.test",
      }),
      fetchImpl: (input, init) => {
        const url = String(input);
        if (url.includes("generativelanguage.googleapis.com")) {
          const sent = JSON.parse(String(init?.body)) as { store?: boolean };
          expect(sent.store).toBe(false);
          return Promise.resolve(Response.json({
            steps: [{
              type: "model_output",
              content: [{
                type: "text",
                text: JSON.stringify({
                  isNewSearch: false,
                  productQuery: "hat",
                  addColors: ["navy"],
                  clearMaxPrice: true,
                  maxPriceCents: 100,
                }),
              }],
            }],
          }));
        }
        return mockFetch(input);
      },
    });
    const first = await service.converse(null, "Find me a black polo under $50.");
    const second = await service.converse(first.sessionId, "Navy is fine too.");
    expect(second.gemini).toBe("used");
    expect(second.constraintsLabel).toContain("polo");
    expect(second.constraintsLabel).toContain("navy");
    expect(second.constraintsLabel).toContain("$50.00");
    expect(second.constraintsLabel).not.toContain("hat");
  });

  it("sends the configured model and retries one short rate limit", async () => {
    let calls = 0;
    const patch = await extractConstraintPatch({
      apiKey: "test-gemini-key",
      model: "gemini-3.5-flash-lite",
      message: "Navy is fine too",
      current: emptyConstraints(),
      history: [],
      sleep: async () => undefined,
      fetchImpl: async (_input, init) => {
        const sent = JSON.parse(String(init?.body)) as { model?: string };
        expect(sent.model).toBe("gemini-3.5-flash-lite");
        calls += 1;
        if (calls === 1) return new Response("RESOURCE_EXHAUSTED", { status: 429, headers: { "retry-after": "0" } });
        return Response.json({
          steps: [{
            type: "model_output",
            content: [{ type: "text", text: JSON.stringify({ isNewSearch: false, addColors: ["navy"] }) }],
          }],
        });
      },
    });
    expect(calls).toBe(2);
    expect(patch?.addColors).toEqual(["navy"]);
  });

  it("keeps the shopper's constraints when Gemini stays rate limited", async () => {
    let calls = 0;
    const service = new ShoppingService({
      config: readConfig({
        GEMINI_API_KEY: "test-gemini-key",
        GEMINI_MODEL: "gemini-3.5-flash-lite",
        EBAY_CLIENT_ID: "",
        EBAY_CLIENT_SECRET: "",
        SHOPIFY_CATALOG_ENABLED: "false",
      }),
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }), {
          status: 429,
          headers: { "retry-after": "30" },
        });
      },
    });
    const view = await service.converse(null, "Find me a black polo under $50");
    expect(calls).toBe(1);
    expect(view.gemini).toBe("busy");
    expect(view.constraintsLabel).toContain("polo");
    expect(view.constraintsLabel).toContain("black");
    expect(view.constraintsLabel).toContain("$50.00");
    expect(view.assistantMessage).toContain("briefly busy");
  });

  it("waits for the active turn before starting another Gemini call", async () => {
    let active = 0;
    let maxActive = 0;
    const service = new ShoppingService({
      config: readConfig({
        GEMINI_API_KEY: "test-gemini-key",
        EBAY_CLIENT_ID: "",
        EBAY_CLIENT_SECRET: "",
        SHOPIFY_CATALOG_ENABLED: "false",
      }),
      fetchImpl: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active -= 1;
        return Response.json({
          steps: [{
            type: "model_output",
            content: [{ type: "text", text: JSON.stringify({ isNewSearch: false }) }],
          }],
        });
      },
    });
    await Promise.all([
      service.converse("session-overlap-test", "Find me a black polo under $50"),
      service.converse("session-overlap-test", "Navy is fine too"),
    ]);
    expect(maxActive).toBe(1);
  });
});

describe("shopping service config", () => {
  it("rebuilds when eBay credentials appear", () => {
    const empty = configStamp(readConfig({ EBAY_CLIENT_ID: "", EBAY_CLIENT_SECRET: "" }));
    const ready = configStamp(readConfig({ EBAY_CLIENT_ID: "app", EBAY_CLIENT_SECRET: "cert" }));
    expect(ready).not.toBe(empty);
    expect(ready).not.toContain("cert");
    expect(ready).not.toContain("app");
  });
});

describe("shopping flow", () => {
  it("keeps Shopify results when eBay fails", async () => {
    const service = new ShoppingService({ config: { ...testConfig(), ebayClientId: "test", ebayClientSecret: "test" },
      fetchImpl: input => String(input).includes("ebay.com") ? Promise.resolve(new Response("unavailable", { status: 503 })) : mockFetch(input) });
    const result = await service.converse(null, "Find me black running shoes, size 42, under $120.");
    expect(result.exact).toHaveLength(1);
    expect(result.exact[0]?.source).toBe("shopify");
    expect(result.providers.find(provider => provider.provider === "ebay")?.status).toBe("unavailable");
  });
  it("rejects approval after the quote expires even without another review", async () => {
    let clock = new Date(NOW);
    const service = new ShoppingService({ config: testConfig(), fetchImpl: mockFetch as typeof fetch, now: () => clock });
    const search = await service.converse(null, "Find me black running shoes, size 42, under $120.");
    await service.review({ sessionId: search.sessionId, offerId: search.exact[0]!.id, walletMode: "sample" });
    clock = new Date(clock.getTime() + QUOTE_FRESHNESS_MS + 1);
    await expect(service.approve(search.sessionId)).rejects.toThrow(/expired|fresh/i);
    const restored = service.getSession(search.sessionId);
    expect(restored.purchase?.funding?.quoteFreshness).toBe("stale");
    expect(restored.purchase?.state).toBe("FUNDING_ANALYZED");
    const refreshed = await service.review({ sessionId: search.sessionId, offerId: search.exact[0]!.id, walletMode: "sample" });
    expect(refreshed.selectedOfferId).toBe(search.exact[0]!.id);
    expect(refreshed.purchase?.funding?.quoteFreshness).toBe("live");
  });
  it("shows an insufficient live quote without claiming readiness", async () => {
    const service = new ShoppingService({ config: testConfig(), now: () => new Date(NOW), fetchImpl: input => {
      if (String(input).includes("dflow.test")) {
        const amount = new URL(String(input)).searchParams.get("amount")!;
        return Promise.resolve(Response.json({ inputMint: WSOL_MINT, outputMint: USDC_MINT, inAmount: amount,
          outAmount: (BigInt(amount) / 1000n).toString(), minOutAmount: (BigInt(amount) / 1000n).toString() }));
      }
      return mockFetch(input);
    } });
    const search = await service.converse(null, "Find me black running shoes, size 42, under $120.");
    const review = await service.review({ sessionId: search.sessionId, offerId: search.exact[0]!.id, walletMode: "sample" });
    expect(review.purchase?.funding?.quoteFreshness).toBe("live");
    expect(review.purchase?.funding?.fundable).toBe(false);
    expect(review.purchase?.state).toBe("FUNDING_ANALYZED");
    expect(review.purchase?.unsignedTransaction).toBe("not_requested");
  });
  it("selects a real-shaped offer and attaches a mocked DFlow quote to the deficit", async () => {
    const service = new ShoppingService({
      config: testConfig(),
      now: () => new Date("2026-04-02T00:00:00.000Z"),
      fetchImpl: mockFetch,
    });
    const session = await service.converse(null, "Find me black running shoes, size 42, under $120.");
    expect(session.exact).toHaveLength(1);
    expect(session.exact[0]?.priceDisplay).toBe("$108.50");
    expect(session.excluded.length).toBeGreaterThan(0);
    expect(session.assistantMessage).toContain("1 listing that matches");
    const reviewed = await service.review({
      sessionId: session.sessionId,
      offerId: session.exact[0]!.id,
      walletMode: "sample",
    });
    expect(reviewed.purchase?.checkout.merchantTotalDisplay).toBeNull();
    expect(reviewed.purchase?.funding?.existingUsdc).toBe("42 USDC");
    expect(reviewed.purchase?.funding?.deficit).toBe("66.5 USDC");
    expect(reviewed.purchase?.funding?.quoteFreshness).toBe("live");
    expect(reviewed.purchase?.funding?.fundable).toBe(true);
    expect(reviewed.purchase?.state).toBe("SWAP_QUOTE_READY");
    expect(reviewed.purchase?.cardRail.access).toBe("sandbox_blocked");
    expect(reviewed.purchase?.unsignedTransaction).toBe("not_requested");
    const approved = await service.approve(reviewed.sessionId);
    expect(approved.purchase?.state).toBe("AWAITING_SWAP_APPROVAL");
    expect(approved.purchase?.swapApproval?.executed).toBe(false);
    expect(approved.purchase?.orderStatus).toBe("ORDER_NOT_CREATED");
    expect(approved.purchase?.paymentStatus).toBe("PAYMENT_NOT_READY");
    expect(approved.purchase?.unsignedTransaction).toBe("not_requested");
    expect(approved.purchase?.finalTotal).toBe("unknown");
  });

  it("keeps purchase review available when DFlow fails", async () => {
    const service = new ShoppingService({
      config: testConfig(),
      now: () => new Date("2026-04-02T00:00:00.000Z"),
      fetchImpl: (input) => {
        const url = String(input);
        if (url.includes("dflow.test")) return Promise.resolve(new Response("upstream", { status: 500 }));
        return mockFetch(input);
      },
    });
    const session = await service.converse(null, "Find me black running shoes, size 42, under $120.");
    const reviewed = await service.review({
      sessionId: session.sessionId,
      offerId: session.exact[0]!.id,
      walletMode: "sample",
    });
    expect(reviewed.purchase?.funding?.deficit).toBe("66.5 USDC");
    expect(reviewed.purchase?.funding?.quoteFreshness).toBe("missing");
    expect(reviewed.purchase?.cardRail.access).toBe("sandbox_blocked");
    expect(reviewed.purchase?.financialExecution).toBe("disabled");
  });
});

describe("purchase approval and Bridge card events", () => {
  it("does not approve a catalog planning amount as a final merchant purchase", async () => {
    const service = new ShoppingService({ config: testConfig(), fetchImpl: mockFetch });
    const search = await service.converse(null, "Black running shoes size 42 under $120");
    const review = await service.review({ sessionId: search.sessionId, offerId: search.exact[0]!.id, walletMode: "none" });
    expect(review.purchase?.finalTotal).toBe("unknown");
    await expect(service.approvePurchase(search.sessionId)).rejects.toThrow(/final.*checkout total/i);
    expect(service.getSession(search.sessionId).purchase?.purchaseApproval).toBe("required");
  });

  it("requires an explicit purchase approval and rejects an expired or larger amount", () => {
    expect(() => createPurchaseIntent({
      explicitApproval: false,
      purchaseId: "purchase-1",
      merchant: "Shop",
      merchantReference: null,
      productTitle: "Polo",
      variant: null,
      reviewedAmountMinor: 4800n,
      maximumAuthorizedAmountMinor: 4800n,
      currency: "USD",
      approvedAtMs: 1_000,
      expiresAtMs: 2_000,
      fundingPlanReference: null,
    })).toThrow(/not been approved/i);
    const intent = createPurchaseIntent({
      explicitApproval: true,
      purchaseId: "purchase-1",
      merchant: "Shop",
      merchantReference: "https://shop.example/polo",
      productTitle: "Polo",
      variant: "Navy",
      reviewedAmountMinor: 4800n,
      maximumAuthorizedAmountMinor: 4800n,
      currency: "usd",
      approvedAtMs: 1_000,
      expiresAtMs: 61_000,
      fundingPlanReference: "funding:4800",
    });
    expect(intent.cardRailProvider).toBeNull();
    assertPurchasePayable(intent, 4800n, 2_000);
    expect(() => assertPurchasePayable(null, 4800n, 2_000)).toThrow(/wallet allowance/i);
    expect(() => assertPurchasePayable(intent, 4801n, 2_000)).toThrow(/ceiling/i);
    expect(() => assertPurchasePayable(intent, 4800n, 61_000)).toThrow(/expired/i);
  });

  it("keeps a blocked Bridge rail from executing and separates capture from the merchant order", () => {
    const rail = new BridgeCardRail(readConfig({ BRIDGE_API_KEY: "", BRIDGE_API_BASE_URL: "https://api.bridge.xyz" }));
    expect(rail.status().access).toBe("sandbox_blocked");
    expect(rail.status().message).toMatch(/Production Bridge is disabled/);
    expect(describeSolanaFundingBinding().execution).toBe("disabled");
    expect(() => rail.preparePayment()).toThrow(/disabled/i);
    expect(() => assertPaymentCanStart(rail)).toThrow(/cannot start/i);
    const authorized = mapBridgeCardEvent({
      id: "evt_auth",
      type: "issuing_authorization.updated",
      data: { object: { id: "iauth_1", object: "issuing.authorization", approved: true, status: "closed", amount: 114 } },
    });
    const captured = mapBridgeCardEvent({
      type: "issuing_transaction.created",
      data: { object: { id: "ipi_1", object: "issuing.transaction", type: "capture" } },
    });
    const refunded = mapBridgeCardEvent({
      type: "issuing_transaction.created",
      data: { object: { id: "ipi_2", object: "issuing.transaction", type: "refund" } },
    });
    const reversed = mapBridgeCardEvent({
      object: "issuing.authorization",
      id: "iauth_2",
      status: "reversed",
      approved: true,
    });
    expect(authorized.payment).toBe("PAYMENT_AUTHORIZED");
    expect(captured.payment).toBe("PAYMENT_CAPTURED");
    expect(refunded.payment).toBe("PAYMENT_REFUNDED");
    expect(reversed.payment).toBe("PAYMENT_REVERSED");
    expect(captured.order).toBe("ORDER_NOT_CREATED");
    expect(capturedPaymentIsNotAnOrder(captured.payment, captured.order)).toBe(true);
    const payload = JSON.stringify({ type: "issuing_authorization.created" });
    const secret = "whsec_test_only";
    const timestamp = "1700000000";
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    expect(verifyIssuingWebhook({ payload, signatureHeader: `t=${timestamp},v1=${signature}`, secret, nowSec: 1700000000 })).toBe(true);
    expect(verifyIssuingWebhook({ payload, signatureHeader: `t=${timestamp},v1=deadbeef`, secret, nowSec: 1700000000 })).toBe(false);
    expect(verifyIssuingWebhook({ payload, signatureHeader: null, secret: null })).toBe(false);
    expect(createReadOnlyWallet({ rpcUrl: "https://rpc.example.test", customRpc: false }).requestSignature().status).toBe("disabled");
  });

  it("prepares an unsigned DFlow transaction without returning the payload", async () => {
    const secretPayload = "UNSIGNED_TRANSACTION_PAYLOAD";
    const quote = await fetchDflowOrder({
      inputMint: WSOL_MINT,
      outputMint: USDC_MINT,
      amount: 1000n,
      userPublicKey: "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg",
    }, {
      baseUrl: "https://dflow.test",
      fetchImpl: (input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("userPublicKey")).toBe("vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg");
        return Promise.resolve(Response.json({
          inputMint: WSOL_MINT,
          inAmount: "1000",
          outputMint: USDC_MINT,
          outAmount: "200",
          otherAmountThreshold: "190",
          slippageBps: 50,
          priceImpactPct: "0",
          transaction: secretPayload,
        }));
      },
    });
    expect(quote.transactionPresent).toBe(true);
    expect(Object.values(quote).join(" ")).not.toContain(secretPayload);
  });

  it("connects a standard wallet account without requesting a signature", async () => {
    let signed = false;
    const target = new EventTarget();
    target.addEventListener("wallet-standard:app-ready", ((event: Event) => {
      const register = (event as CustomEvent<{ register: (wallet: unknown) => void }>).detail.register;
      register({
        name: "Test Wallet",
        accounts: [],
        features: {
          "standard:connect": { connect: async () => ({ accounts: [{ address: "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg" }] }) },
          "solana:signTransaction": { signTransaction: () => { signed = true; } },
        },
      });
    }) as EventListener);
    const [wallet] = discoverStandardWallets(target);
    const connected = await connectStandardWallet(wallet!);
    expect(connected.address).toBe("vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg");
    expect(connected.canRequestSignature).toBe(true);
    expect(signed).toBe(false);
  });
});

describe("wallet modes", () => {
  const publicAddress = "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg";

  it("accepts a 32-byte Solana public key and rejects anything else", () => {
    expect(isPlausibleAddress(publicAddress)).toBe(true);
    expect(isPlausibleAddress("not-a-solana-address")).toBe(false);
    expect(isPlausibleAddress("123")).toBe(false);
    expect(isPlausibleAddress("oooooooooooooooooooooooooooooooooooooooooooo")).toBe(false);
  });

  it("keeps sample, read-only, and connected wallets apart", async () => {
    const tx = Buffer.concat([Buffer.from([1]), Buffer.alloc(64), Buffer.from([0x80, 1, 0, 1, 2]),
      Buffer.alloc(64, 1), Buffer.alloc(32, 2), Buffer.from([1, 1, 1, 0, 1, 0, 0])]).toString("base64");
    expect(solanaTransactionSummary(tx).valid).toBe(true);
    expect(solanaTransactionSummary("not-a-transaction").valid).toBe(false);
    let sawPublicKey = false;
    let preparedRequests = 0;
    const service = new ShoppingService({
      config: testConfig(),
      now: () => new Date("2026-04-02T00:00:00.000Z"),
      fetchImpl: (input, init) => {
        const url = String(input);
        if (url.includes("dflow.test")) {
          const parsed = new URL(url);
          const key = parsed.searchParams.get("userPublicKey");
          if (key) { sawPublicKey = key === publicAddress; preparedRequests++; }
          const amount = parsed.searchParams.get("amount") ?? "1";
          const out = (BigInt(amount) * 1000n).toString();
          return Promise.resolve(Response.json({
            inputMint: WSOL_MINT,
            inAmount: amount,
            outputMint: USDC_MINT,
            outAmount: out,
            otherAmountThreshold: out,
            slippageBps: 50,
            priceImpactPct: "0",
            ...(key ? { transaction: tx } : {}),
          }));
        }
        if (url.includes("mainnet-beta.solana.com")) {
          const body = JSON.parse(String(init?.body)) as { method?: string };
          if (body.method === "getBalance") return Promise.resolve(Response.json({ result: { value: 500_000_000 } }));
          return Promise.resolve(Response.json({ result: { value: [] } }));
        }
        return mockFetch(input);
      },
    });
    const session = await service.converse(null, "Find me black running shoes, size 42, under $120.");
    const sample = await service.review({
      sessionId: session.sessionId,
      offerId: session.exact[0]!.id,
      walletMode: "sample",
    });
    expect(sample.purchase?.walletKind).toBe("sample");
    expect(sample.purchase?.signatureCapability).toBe("disabled");
    expect(sample.purchase?.assets.some((asset) => asset.amountDisplay === "42 USDC")).toBe(true);
    expect(sample.purchase?.unsignedTransaction).toBe("not_requested");

    const invalid = await service.review({
      sessionId: session.sessionId,
      offerId: session.exact[0]!.id,
      walletMode: "address",
      address: "not-a-solana-address",
      signatureAvailable: true,
    });
    expect(invalid.purchase?.walletKind).toBe("read_only");
    expect(invalid.purchase?.balanceError).toMatch(/solana address/i);
    expect(invalid.purchase?.assets).toEqual([]);
    expect(invalid.purchase?.signatureCapability).toBe("disabled");

    const readonly = await service.review({
      sessionId: session.sessionId,
      offerId: session.exact[0]!.id,
      walletMode: "address",
      address: publicAddress,
      signatureAvailable: true,
    });
    expect(readonly.purchase?.walletKind).toBe("read_only");
    expect(readonly.purchase?.signatureCapability).toBe("disabled");
    expect(readonly.purchase?.assets.some((asset) => asset.amountDisplay === "42 USDC")).toBe(false);
    expect(readonly.purchase?.assets.find((asset) => asset.symbol === "SOL")?.amountDisplay).toBe("0.5 SOL");
    expect(readonly.purchase?.unsignedTransaction).toBe("prepared");
    expect(readonly.purchase?.transactionVersion).toBe("v0");
    expect(sawPublicKey).toBe(true);
    expect(JSON.stringify(readonly)).not.toContain(tx);

    const connected = await service.review({
      sessionId: session.sessionId,
      offerId: session.exact[0]!.id,
      walletMode: "connected",
      address: publicAddress,
      signatureAvailable: true,
    });
    expect(connected.purchase?.walletKind).toBe("connected");
    expect(connected.purchase?.signatureCapability).toBe("available");
    expect(connected.purchase?.assets.some((asset) => asset.amountDisplay === "42 USDC")).toBe(false);
    const requestsBeforeApproval = preparedRequests;
    const approved = await service.approve(connected.sessionId);
    expect(preparedRequests).toBe(requestsBeforeApproval);
    expect(approved.purchase?.funding).toEqual(connected.purchase?.funding);
    expect(approved.purchase?.state).toBe("AWAITING_SWAP_APPROVAL");
    expect(approved.purchase?.swapApproval?.executed).toBe(false);
    expect(approved.purchase?.unsignedTransaction).toBe("prepared");
    const cleared = clearWalletReview(approved);
    expect(cleared.selectedOfferId).toBe(approved.selectedOfferId);
    expect(cleared.purchase).toMatchObject({ walletKind: "none", walletAddress: null,
      signatureCapability: "disabled", assets: [], funding: null, swapApproval: null,
      unsignedTransaction: "not_requested", purchaseApproval: "required", paymentStatus: "PAYMENT_NOT_READY" });
    expect(approved.purchase?.unsignedTransaction).toBe("prepared");
    expect(() => executeSwap()).toThrow(/disabled/i);
    expect(createReadOnlyWallet({ rpcUrl: "https://rpc.example.test", customRpc: false }).requestSignature().status).toBe("disabled");
  });
});

function testConfig(): AppConfig {
  return readConfig({
    SHOPIFY_CATALOG_ENABLED: "true",
    EBAY_CLIENT_ID: "",
    EBAY_CLIENT_SECRET: "",
    GEMINI_API_KEY: "",
    DFLOW_QUOTE_BASE_URL: "https://dflow.test",
    SOLANA_RPC_URL: "",
  });
}

function mockFetch(input: RequestInfo | URL): Promise<Response> {
  const url = String(input);
  if (url.includes("catalog.shopify.com")) {
    return Promise.resolve(Response.json({
      result: { structuredContent: { products: [shopifyProduct(), overBudgetProduct()] } },
    }));
  }
  if (url.includes("dflow.test")) {
    const amount = new URL(url).searchParams.get("amount") ?? "1";
    const out = (BigInt(amount) / 5n).toString();
    return Promise.resolve(Response.json({
      inputMint: WSOL_MINT,
      inAmount: amount,
      outputMint: USDC_MINT,
      outAmount: out,
      minOutAmount: out,
      slippageBps: 50,
      platformFee: null,
      priceImpactPct: "0",
      contextSlot: 1,
      executionMode: "sync",
    }));
  }
  return Promise.resolve(new Response("missing", { status: 404 }));
}

function shopifyProduct() {
  return {
    id: "gid://shopify/p/shoe",
    title: "Black running shoes",
    description: { plain: "Road running shoes." },
    variants: [{
      id: "gid://shopify/ProductVariant/42",
      title: "Black running shoes",
      price: { amount: 10850, currency: "USD" },
      availability: { available: true },
      options: [{ name: "Size", label: "42" }],
      seller: { name: "Start Fitness", id: "shop" },
      checkout_url: "https://merchant.example/cart/42:1",
      condition: ["new"],
      eligible: { native_checkout: false },
    }],
  };
}

function overBudgetProduct() {
  return {
    ...shopifyProduct(),
    variants: [{
      ...shopifyProduct().variants[0],
      id: "gid://shopify/ProductVariant/99",
      price: { amount: 18000, currency: "USD" },
      options: [{ name: "Size", label: "43" }],
    }],
  };
}

function ebayItem(overrides: Record<string, unknown> = {}) {
  return {
    itemId: "v1|1",
    title: "Black running shoes",
    price: { value: "24.99", currency: "USD" },
    image: { imageUrl: "https://example.test/shoe.jpg" },
    itemWebUrl: "https://www.ebay.com/itm/1",
    condition: "New",
    seller: { username: "runner-shop" },
    shippingOptions: [{ shippingCostType: "CALCULATED" }],
    ...overrides,
  };
}

function offer(input: { title?: string; variantLabel?: string; amount: bigint; id?: string }): NormalizedOffer {
  return {
    id: input.id ?? "shopify:a",
    source: "shopify",
    sourceItemId: input.id ?? "a",
    merchant: "Shop",
    title: input.title ?? "Black running shoes",
    descriptionSummary: null,
    imageUrl: null,
    price: { amountMinor: input.amount, currency: "USD", exponent: 2, basis: "catalog" },
    availability: "in_stock",
    variantLabel: input.variantLabel ?? "42",
    options: [{ name: "Size", value: input.variantLabel ?? "42" }],
    condition: "new",
    shipping: null,
    productUrl: "https://merchant.example/p",
    checkout: { kind: "unavailable", reason: "not in this fixture" },
    providerMetadata: {},
    verifiedAt: NOW,
  };
}

function quote(input: { inAmount: bigint; outAmount: bigint }): BoundQuote {
  return {
    quoteId: "q1",
    inputMint: WSOL_MINT,
    outputMint: USDC_MINT,
    inAmount: input.inAmount,
    outAmount: input.outAmount,
    minOutAmount: input.outAmount,
    inputDecimals: 9,
    outputDecimals: 6,
    priceImpactPct: "0",
    slippageBps: 50,
    platformFeeText: "No platform fee was reported.",
    contextSlot: 1,
    expiresAtMs: 1_000 + QUOTE_FRESHNESS_MS,
    receivedAtMs: 1_000,
    boundPayableMinor: 18900n,
    boundFundingMint: WSOL_MINT,
    execution: "quote_only",
  };
}

function tokenAccount(mint: string, amount: string, decimals: number) {
  return {
    account: {
      data: {
        parsed: {
          info: { mint, tokenAmount: { amount, decimals } },
        },
      },
    },
  };
}
