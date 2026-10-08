import { describe, expect, it } from "vitest";
import { readConfig } from "../src/lib/config";
import { CHECKOUT_FRESHNESS_MS, classifyCreatedCheckout, merchantDestination, prepareMerchantCheckout, readMerchantCheckout, verifyCheckout } from "../src/lib/merchant-checkout";
import { normalizeShopifyProducts } from "../src/lib/shopify";
import { ShoppingService } from "../src/lib/shopping";
import { USDC_MINT } from "../src/lib/tokens";
import { toOfferView } from "../src/lib/serialize";

const NOW = Date.parse("2026-10-03T00:00:00Z");
const checkoutId = "gid://shopify/Checkout/fixture?key=TEST_ONLY_CAPABILITY";
const product = { id: "polo", title: "Black polo", variants: [{
  id: "gid://shopify/ProductVariant/1", title: "Black polo", price: { amount: 1000, currency: "USD" },
  availability: { available: true }, seller: { name: "Fixture merchant" },
  checkout_url: "https://merchant.test/cart/1:1", options: [{ name: "Size", label: "S" }],
}] };
const [offer] = normalizeShopifyProducts([product], new Date(NOW).toISOString());
const BUYER_IP = "8.8.8.8"; // Fixture only; no request reaches a real merchant.
const context = { offer: offer!, quantity: 1, checkoutId, merchantOrigin: "https://merchant.test", nowMs: NOW, buyerIp: BUYER_IP };
const config = readConfig({ SHOPIFY_CHECKOUT_ACCESS_TOKEN: "TEST_ONLY_TOKEN", SHOPIFY_CHECKOUT_ALLOWED_ORIGINS: "https://merchant.test" });
function checkout() {
  return { id: checkoutId, status: "ready_for_complete", currency: "USD", expires_at: new Date(NOW + 3_600_000).toISOString(),
    buyer: { email: "DO_NOT_SERIALIZE_BUYER" }, payment: { instruments: ["DO_NOT_SERIALIZE_PAYMENT"] },
    line_items: [{ item: { id: offer!.sourceItemId, price: 1200 }, quantity: 1,
      totals: [{ type: "subtotal", amount: 1200 }, { type: "total", amount: 1100 }, { type: "items_discount", amount: -100 }] }],
    totals: [{ type: "subtotal", amount: 1200 }, { type: "items_discount", amount: -100 },
      { type: "fulfillment", amount: 500 }, { type: "tax", amount: 100 }, { type: "fee", amount: 50 }, { type: "total", amount: 1750 }],
    messages: [],
  };
}

describe("authenticated merchant checkout evidence", () => {
  it("reads a text-only JSON checkout through the same strict verification", async () => {
    const evidence = await readMerchantCheckout({ ...context, config, fetchImpl: async () => Response.json({ result: {
      content: [{ type: "text", text: JSON.stringify(checkout()) }],
    } }) });
    expect(evidence.snapshot.merchantTotalMinor).toBe(1750n);
    expect(Object.keys(evidence)).not.toContain("buyer");
  });

  it("recognizes an incomplete error document without accepting its amount", async () => {
    await expect(readMerchantCheckout({ ...context, config, fetchImpl: async () => Response.json({ result: {
      isError: true, content: [{ type: "text", text: JSON.stringify({ ...checkout(), status: "incomplete" }) }],
    } }) })).rejects.toThrow(/not ready/);
  });

  it("never accepts a ready document from an error result or opaque text", async () => {
    for (const result of [{ isError: true, structuredContent: checkout() },
      { content: [{ type: "text", text: "DO_NOT_EXPOSE_PROVIDER_TEXT" }] },
      { content: [{ type: "text", text: JSON.stringify({ ...checkout(), id: "wrong" }) }] }]) {
      await expect(readMerchantCheckout({ ...context, config, fetchImpl: async () => Response.json({ result }) })).rejects.toThrow();
    }
  });

  it("keeps a single-variant merchant cart link aligned with the selected quantity", () => {
    expect(toOfferView(offer!, 2).merchantCartUrl).toBe("https://merchant.test/cart/1:2");
    expect(toOfferView(offer!, 1).merchantCartUrl).toBe("https://merchant.test/cart/1:1");
    expect(toOfferView(offer!, 1).productUrl).toBeNull();
  });
  it("uses the merchant price and reconciled final total, while sanitizing buyer/payment data", () => {
    const evidence = verifyCheckout(checkout(), context);
    expect(evidence.snapshot).toMatchObject({ itemMinor: 1200n, merchantTotalMinor: 1750n,
      discountMinor: 100n, shippingMinor: 500n, taxMinor: 100n, feeMinor: 50n, merchantTotalKnown: true });
    expect(evidence.expiresAtMs).toBe(NOW + CHECKOUT_FRESHNESS_MS);
    expect(Object.keys(evidence)).toEqual(["merchantOrigin", "verifiedAtMs", "expiresAtMs", "authority", "statement", "snapshot"]);
    expect(evidence.authority).toBe("merchant_ready");
    expect(Object.keys(evidence.snapshot)).not.toContain("buyer");
    expect(Object.keys(evidence.snapshot)).not.toContain("payment");
  });

  it.each(["incomplete", "requires_escalation", "complete_in_progress", "completed", "canceled"])("rejects %s as a payable checkout", status => {
    expect(() => verifyCheckout({ ...checkout(), status }, context)).toThrow(/not ready/);
  });

  it("rejects mismatched variants, quantities, currencies, references and extra cart items", () => {
    const differentVariant = checkout(); differentVariant.line_items[0]!.item.id = "other-variant";
    const differentQuantity = checkout(); differentQuantity.line_items[0]!.quantity = 2;
    const extra = checkout(); extra.line_items.push(extra.line_items[0]!);
    for (const payload of [differentVariant, differentQuantity, extra, { ...checkout(), currency: "EUR" }, { ...checkout(), id: "different" }]) {
      expect(() => verifyCheckout(payload, context)).toThrow();
    }
  });

  it("rejects expired evidence, buyer-review requirements and inconsistent money", () => {
    const badTotal = checkout(); badTotal.totals.at(-1)!.amount = 1751;
    const duplicate = checkout(); duplicate.totals.push({ type: "total", amount: 1750 });
    const wrongSign = checkout(); wrongSign.totals[1]!.amount = 100;
    const fractional = checkout(); fractional.line_items[0]!.item.price = 12.5;
    for (const payload of [badTotal, duplicate, wrongSign, fractional,
      { ...checkout(), expires_at: new Date(NOW).toISOString() },
      { ...checkout(), messages: [{ type: "warning", severity: "requires_buyer_review" }] }]) {
      expect(() => verifyCheckout(payload, context)).toThrow();
    }
  });

  it("only sends credentials to an allowed merchant and invokes get_checkout", async () => {
    const calls: string[] = [];
    let forwardedBuyerIp: string | null = null;
    const evidence = await readMerchantCheckout({ ...context, config, fetchImpl: async (url, init) => {
      calls.push(String(url));
      expect(init?.redirect).toBe("error"); expect(init?.cache).toBe("no-store");
      forwardedBuyerIp = new Headers(init?.headers).get("shopify-buyer-ip");
      const request = JSON.parse(String(init?.body));
      expect(request.params.name).toBe("get_checkout");
      expect(request.params.arguments.id).toBe(checkoutId);
      return Response.json({ result: { structuredContent: checkout() } });
    } });
    expect(evidence.snapshot.merchantTotalKnown).toBe(true);
    expect(forwardedBuyerIp).toBe(BUYER_IP);
    expect(calls).toEqual(["https://merchant.test/api/ucp/mcp"]);
    let fetched = false;
    await expect(readMerchantCheckout({ ...context, config: { ...config, shopifyCheckoutOrigins: [] },
      fetchImpl: async () => { fetched = true; return Response.json({}); } })).rejects.toThrow(/access/);
    expect(fetched).toBe(false);
  });

  it("authenticates with existing Catalog credentials without returning the token", async () => {
    const calls: string[] = [];
    const evidence = await readMerchantCheckout({ ...context,
      config: { ...config, shopifyCheckoutToken: null, shopifyClientId: "TEST_ONLY_CLIENT", shopifyClientSecret: "TEST_ONLY_SECRET" },
      fetchImpl: async (url, init) => {
        calls.push(String(url));
        if (String(url).includes("api.shopify.com")) return Response.json({ access_token: "TEST_ONLY_DERIVED_TOKEN" });
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer TEST_ONLY_DERIVED_TOKEN");
        return Response.json({ result: { structuredContent: checkout() } });
      },
    });
    expect(calls).toEqual(["https://api.shopify.com/auth/access_token", "https://merchant.test/api/ucp/mcp"]);
    expect(Object.keys(evidence)).not.toContain("access_token");
  });

  it("refuses missing or invalid buyer context before any credential request", async () => {
    let calls = 0;
    for (const buyerIp of [null, "127.0.0.1", "8.8.8.8, 1.1.1.1", "8.8.8.8\r\nInjected: x"]) {
      await expect(readMerchantCheckout({ ...context, buyerIp, config, fetchImpl: async () => { calls++; return Response.json({}); } })).rejects.toThrow(/buyer network context/);
    }
    expect(calls).toBe(0);
  });
});

const destination = { email: "buyer@example.com", firstName: "Ada", lastName: "Lovelace", streetAddress: "1 Market", city: "Bangkok", region: "Bangkok", postalCode: "10110", country: "th", discountCode: "WELCOME10" };

describe("merchant-calculated checkout before payment", () => {
  it("rejects invented or incomplete destinations before any merchant call", async () => {
    let calls = 0;
    await expect(prepareMerchantCheckout({ ...context, destination: { ...destination, email: "not-an-email" }, config, fetchImpl: async () => { calls++; return Response.json({}); } })).rejects.toThrow(/email/);
    expect(() => merchantDestination({ ...destination, country: "Thailand" })).toThrow(/country/);
    expect(calls).toBe(0);
  });

  it("creates a checkout, never completes it, and keeps buyer data out of the evidence", async () => {
    const calls: string[] = [];
    const priced = { ...checkout(), status: "incomplete", id: "gid://shopify/Checkout/priced?key=SECRET_CAPABILITY" };
    const evidence = await prepareMerchantCheckout({ ...context, destination, config, fetchImpl: async (url, init) => {
      calls.push(String(url));
      const request = JSON.parse(String(init?.body));
      expect(request.params.name).toBe("create_checkout");
      expect(JSON.stringify(request)).not.toContain("complete_checkout");
      expect(request.params.arguments.checkout.discounts.codes).toEqual(["WELCOME10"]);
      expect(request.params.arguments.checkout.fulfillment.methods[0].destinations[0].address_country).toBe("TH");
      expect(request.params.arguments.checkout.payment).toBeUndefined();
      return Response.json({ result: { structuredContent: priced } });
    } });
    expect(calls).toEqual(["https://merchant.test/api/ucp/mcp"]);
    expect(evidence.authority).toBe("merchant_calculated");
    expect(evidence.snapshot.merchantTotalKnown).toBe(false);
    expect(evidence.snapshot.merchantTotalMinor).toBe(1750n);
    expect(evidence.snapshot.payableAuthority).toBe("merchant_calculated");
    const serialized = JSON.stringify(evidence, (_key, value) => typeof value === "bigint" ? value.toString() : value);
    for (const secret of ["buyer@example.com", "1 Market", "SECRET_CAPABILITY", "WELCOME10", "TEST_ONLY_TOKEN"]) expect(serialized).not.toContain(secret);
  });

  it("does not treat a subtotal-only checkout as a payable amount", () => {
    const bare = checkout();
    bare.totals = [{ type: "subtotal", amount: 1200 }, { type: "total", amount: 1200 }];
    bare.line_items[0]!.totals = [{ type: "subtotal", amount: 1200 }, { type: "total", amount: 1200 }];
    bare.line_items[0]!.item.price = 1200;
    let caught = "";
    try { classifyCreatedCheckout({ ...bare, status: "incomplete", messages: [{ code: "delivery_address_required", content: "buyer@example.com" }] }, context); }
    catch (error) { caught = error instanceof Error ? error.message : ""; }
    expect(caught).toMatch(/Merchant reported: delivery_address_required/);
    expect(caught).not.toContain("buyer@example.com");
  });

  it("keeps a provisional discount unapprovable even when the merchant says ready", () => {
    const ready = { ...checkout(), discounts: { applied: [{ title: "Student", amount: 100, provisional: true }] } };
    expect(() => verifyCheckout(ready, context)).toThrow(/provisional/);
    expect(classifyCreatedCheckout(ready, context).authority).toBe("merchant_calculated");
  });

  it("keeps an unreconciled non-USD merchant statement out of the USD funding amount", () => {
    const stated = { ...checkout(), status: "requires_escalation", currency: "THB",
      line_items: [{ item: { id: offer!.sourceItemId, price: 175000 }, quantity: 1, totals: [{ type: "subtotal", amount: 175000 }, { type: "total", amount: 175000 }] }],
      totals: [{ type: "subtotal", amount: 175000 }, { type: "fulfillment", amount: 50653 }, { type: "tax", amount: 22282 }, { type: "duty", amount: 70431 }, { type: "total", amount: 327484 }],
      fulfillment: { methods: [{ type: "shipping", groups: [{ id: "group", selected_option_id: "air", options: [{ id: "air", title: "Express Courier (Air)" }] }] }] },
      messages: [{ code: "buyer_identity_contact_method_required", type: "error" }, { code: "delivery_first_name_required", type: "error" }, { code: "delivery_last_name_required", type: "error" }],
    };
    const evidence = classifyCreatedCheckout(stated, context);
    expect(evidence.authority).toBe("merchant_stated");
    expect(evidence.snapshot.merchantTotalKnown).toBe(false);
    expect(evidence.snapshot.currency).toBe("USD");
    expect(evidence.statement).toMatchObject({ currency: "THB", subtotalMinor: 175000n, shippingMinor: 50653n, taxMinor: 22282n, dutyMinor: 70431n, statedTotalMinor: 327484n, gapMinor: 9118n, reconciled: false, deliveryMethod: "Express Courier (Air)" });
    expect(evidence.statement?.missingCodes).toEqual(["buyer_identity_contact_method_required", "delivery_first_name_required", "delivery_last_name_required"]);
  });

  it("still refuses funding after contact details when the duty line does not reconcile", () => {
    const stated = { ...checkout(), status: "requires_escalation", currency: "THB",
      line_items: [{ item: { id: offer!.sourceItemId, price: 175000 }, quantity: 1, totals: [{ type: "subtotal", amount: 175000 }, { type: "total", amount: 175000 }] }],
      totals: [{ type: "subtotal", amount: 175000 }, { type: "fulfillment", amount: 50653 }, { type: "tax", amount: 22282 }, { type: "duty", amount: 70431 }, { type: "total", amount: 327484 }],
      fulfillment: { methods: [{ type: "shipping", groups: [{ id: "group", selected_option_id: "air", options: [{ id: "air", title: "Express Courier (Air)" }] }] }] },
      messages: [{ code: "extension_interaction_required", type: "error" }],
    };
    const evidence = classifyCreatedCheckout(stated, context);
    expect(evidence.authority).toBe("merchant_stated");
    expect(evidence.snapshot.merchantTotalKnown).toBe(false);
    expect(evidence.snapshot.currency).toBe("USD");
    expect(evidence.statement).toMatchObject({ gapMinor: 9118n, reconciled: false });
    expect(evidence.statement?.missingCodes).toEqual(["extension_interaction_required"]);
    expect(evidence.snapshot.note).toMatch(/not using it as a funding amount/);
  });

  it("plans with the merchant total but still refuses purchase approval", async () => {
    const searchConfig = config;
    const service = new ShoppingService({ config: searchConfig, now: () => new Date(NOW), fetchImpl: async (url, init) => {
      if (String(url).includes("merchant.test")) {
        const request = JSON.parse(String(init?.body));
        expect(request.params.name).toBe("create_checkout");
        return Response.json({ result: { structuredContent: { ...checkout(), status: "requires_escalation", id: "gid://shopify/Checkout/priced?key=SECRET_CAPABILITY" } } });
      }
      return Response.json({ result: { structuredContent: { products: [product] } } });
    } });
    const search = await service.converse(null, "Find me a black polo under $50");
    const review = await service.review({ sessionId: search.sessionId, offerId: search.exact[0]!.id, walletMode: "none" });
    const priced = await service.calculateMerchantTotal(search.sessionId, review.purchase!.termsId, destination, BUYER_IP);
    expect(priced.purchase).toMatchObject({ finalTotal: "unknown", amountKind: "merchant_calculated_total",
      checkoutVerification: { status: "calculated" }, checkout: { merchantTotalDisplay: "$17.50", shippingDisplay: "$5.00", taxDisplay: "$1.00" },
      funding: { planningDisplay: "$17.50", planningBasis: "merchant_calculated_total", merchantTotalKnown: false } });
    await expect(service.approvePurchase(search.sessionId, priced.purchase!.termsId)).rejects.toThrow(/final merchant checkout total/);
    const serialized = JSON.stringify(priced);
    for (const secret of ["buyer@example.com", "1 Market", "SECRET_CAPABILITY", "WELCOME10"]) expect(serialized).not.toContain(secret);
  });
});

describe("checkout, funding and approval integration", () => {
  function setup() {
    let clock = NOW;
    let response = checkout();
    const service = new ShoppingService({ config, now: () => new Date(clock), fetchImpl: async (url, init) => {
      if (String(url).includes("merchant.test")) return Response.json({ result: { structuredContent: response } });
      if (String(url).includes("solana.com")) {
        const request = JSON.parse(String(init?.body));
        if (request.method === "getGenesisHash") return Response.json({ result: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d" });
        if (request.method === "getBalance") return Response.json({ result: { value: 20_000_000 } });
        return Response.json({ result: { value: request.params[1].programId.startsWith("Tokenkeg") ? [{ account: { data: { parsed: { info: {
          mint: USDC_MINT, tokenAmount: { amount: "12000000", decimals: 6 },
        } } } } }] : [] } });
      }
      return Response.json({ result: { structuredContent: { products: [product] } } });
    } });
    return { service, advance: (ms: number) => { clock += ms; }, change: (next: ReturnType<typeof checkout>) => { response = next; } };
  }

  it("plans against the verified total, binds explicit approval, and invalidates it on expiry", async () => {
    const { service, advance } = setup();
    const search = await service.converse(null, "Find me a black polo under $50");
    const review = await service.review({ sessionId: search.sessionId, offerId: search.exact[0]!.id,
      walletMode: "address", address: "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg" });
    expect(review.purchase?.funding?.planningDisplay).toBe("$10.00");
    const verified = await service.verifyMerchantTotal(search.sessionId, review.purchase!.termsId, checkoutId, BUYER_IP);
    expect(verified.purchase).toMatchObject({ finalTotal: "verified", amountKind: "merchant_checkout_total",
      checkout: { merchantTotalDisplay: "$17.50" }, funding: { planningDisplay: "$17.50", merchantTotalKnown: true } });
    await expect(service.approvePurchase(search.sessionId, review.purchase!.termsId)).rejects.toThrow(/terms changed/);
    const approved = await service.approvePurchase(search.sessionId, verified.purchase!.termsId);
    expect(approved.purchase?.purchaseApproval).toBe("approved");
    expect(approved.purchase?.paymentStatus).toBe("PAYMENT_NOT_READY");
    expect(approved.purchase?.orderStatus).toBe("ORDER_NOT_CREATED");
    const serialized = JSON.stringify(approved);
    for (const value of [checkoutId, "TEST_ONLY_TOKEN", "DO_NOT_SERIALIZE_BUYER", "DO_NOT_SERIALIZE_PAYMENT"]) expect(serialized).not.toContain(value);
    advance(CHECKOUT_FRESHNESS_MS);
    const expired = service.getSession(search.sessionId);
    expect(expired.purchase).toMatchObject({ finalTotal: "unknown", purchaseApproval: "required", unsignedTransaction: "not_requested" });
    await expect(service.approvePurchase(search.sessionId, verified.purchase!.termsId)).rejects.toThrow(/final.*checkout total/);
  });

  it("expires wallet funding independently of a still-current merchant total", async () => {
    const { service, advance } = setup();
    const search = await service.converse(null, "Find me a black polo under $50");
    const selection = { sessionId: search.sessionId, offerId: search.exact[0]!.id,
      walletMode: "address" as const, address: "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg" };
    const review = await service.review(selection);
    const verified = await service.verifyMerchantTotal(search.sessionId, review.purchase!.termsId, checkoutId, BUYER_IP);
    await service.approvePurchase(search.sessionId, verified.purchase!.termsId);
    advance(60_000);
    const stale = service.getSession(search.sessionId);
    expect(stale.purchase).toMatchObject({ finalTotal: "verified", balanceSource: "error", assets: [],
      funding: null, purchaseApproval: "required", paymentStatus: "PAYMENT_APPROVAL_REQUIRED", unsignedTransaction: "not_requested" });
    expect(stale.purchase!.termsId).not.toBe(verified.purchase!.termsId);
    const fresh = await service.review(selection);
    expect(fresh.purchase).toMatchObject({ finalTotal: "verified", balanceSource: "chain", purchaseApproval: "required" });
    expect(fresh.purchase!.assets.length).toBeGreaterThan(0);
  });

  it("clears verification and approval if a fresh merchant read fails", async () => {
    const { service, change } = setup();
    const search = await service.converse(null, "Find me a black polo under $50");
    const review = await service.review({ sessionId: search.sessionId, offerId: search.exact[0]!.id, walletMode: "none" });
    const verified = await service.verifyMerchantTotal(search.sessionId, review.purchase!.termsId, checkoutId, BUYER_IP);
    await service.approvePurchase(search.sessionId, verified.purchase!.termsId);
    change({ ...checkout(), status: "incomplete" });
    await expect(service.verifyMerchantTotal(search.sessionId, verified.purchase!.termsId, checkoutId, BUYER_IP)).rejects.toThrow(/not ready/);
    expect(service.getSession(search.sessionId).purchase).toMatchObject({ finalTotal: "unknown", purchaseApproval: "required", swapApproval: null });
  });

  it("preserves final-total evidence across wallet refresh, but invalidates approval and quantity changes", async () => {
    const { service } = setup();
    const search = await service.converse(null, "Find me a black polo under $50");
    const selection = { sessionId: search.sessionId, offerId: search.exact[0]!.id, walletMode: "none" as const };
    const review = await service.review(selection);
    const verified = await service.verifyMerchantTotal(search.sessionId, review.purchase!.termsId, checkoutId, BUYER_IP);
    await service.approvePurchase(search.sessionId, verified.purchase!.termsId);
    const refresh = await service.review(selection);
    expect(refresh.purchase).toMatchObject({ finalTotal: "verified", purchaseApproval: "required" });
    expect(refresh.purchase?.termsId).not.toBe(verified.purchase!.termsId);
    const changed = await service.review({ ...selection, quantity: 2 });
    expect(changed.purchase).toMatchObject({ finalTotal: "unknown", purchaseApproval: "required", checkout: { quantity: 2 } });
  });

  it("drops an approval when a later ready total is different", async () => {
    const { service, change } = setup();
    const search = await service.converse(null, "Find me a black polo under $50");
    const review = await service.review({ sessionId: search.sessionId, offerId: search.exact[0]!.id, walletMode: "none" });
    const verified = await service.verifyMerchantTotal(search.sessionId, review.purchase!.termsId, checkoutId, BUYER_IP);
    await service.approvePurchase(search.sessionId, verified.purchase!.termsId);
    const next = checkout();
    next.totals.find(entry => entry.type === "tax")!.amount = 150;
    next.totals.find(entry => entry.type === "total")!.amount = 1800;
    change(next);
    const repriced = await service.verifyMerchantTotal(search.sessionId, verified.purchase!.termsId, checkoutId, BUYER_IP);
    expect(repriced.purchase).toMatchObject({ purchaseApproval: "required", checkout: { merchantTotalDisplay: "$18.00" }, orderStatus: "ORDER_NOT_CREATED" });
    await expect(service.approvePurchase(search.sessionId, verified.purchase!.termsId)).rejects.toThrow(/terms changed/);
  });
});
