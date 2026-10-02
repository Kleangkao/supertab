import { describe, expect, it } from "vitest";
import { emptyConstraints, mergeConstraints, resolveConstraints } from "../src/lib/constraints";
import { parseDflowOrder, priceImpactPercentLabel, QUOTE_FRESHNESS_MS } from "../src/lib/dflow";
import { normalizeEbaySummaries, searchEbay } from "../src/lib/ebay";
import { broadcastTransaction, executeCardPayment, executeSwap } from "../src/lib/execution";
import { classifyOffers } from "../src/lib/filter-offers";
import { planFunding, quoteIsUsable, type BoundQuote } from "../src/lib/funding-planner";
import { formatMinor, usdMinorToUsdcBase } from "../src/lib/money";
import { payableFromOffer, type NormalizedOffer } from "../src/lib/offers";
import { transitionPurchase } from "../src/lib/purchase";
import { assertPaymentCanStart, UnavailablePaymentRail } from "../src/lib/card-rail";
import { paymentDoesNotProveOrder } from "../src/lib/order-evidence";
import { normalizeShopifyProducts, searchShopify } from "../src/lib/shopify";
import { toOfferView } from "../src/lib/serialize";
import { buildHealth } from "../src/lib/health";
import { readConfig } from "../src/lib/config";
import { parseTokenAccounts } from "../src/lib/wallet";
import { JUP_MINT, USDC_MINT, WSOL_MINT, sampleSpendingAssets } from "../src/lib/tokens";
import { extractOutputText } from "../src/lib/gemini";
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
    const health = await buildHealth(config, async () => Response.json({ result: "ok" }));
    expect(health.gemini).toBe("configured");
    expect(health.ebay).toBe("not_configured");
    expect(health.shopify).toBe("configured");
    expect(health.cardRail).toBe("not_connected");
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
    expect(reviewed.purchase?.cardRail.availability).toBe("not_connected");
    expect(JSON.stringify(reviewed)).not.toContain("transaction");
    const approved = await service.approve(reviewed.sessionId);
    expect(approved.purchase?.state).toBe("AWAITING_SWAP_APPROVAL");
    expect(approved.purchase?.swapApproval?.executed).toBe(false);
    expect(approved.purchase?.orderStatus).toBe("not_created");
    expect(approved.purchase?.paymentStatus).toBe("not_authorized");
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