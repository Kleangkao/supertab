import { describe, expect, it } from "vitest";
import { emptyConstraints, mergeConstraints, requirementMessage } from "../src/lib/constraints";
import { classifyOffers } from "../src/lib/filter-offers";
import { matchOffer } from "../src/lib/match-evidence";
import type { NormalizedOffer } from "../src/lib/offers";

function sample(overrides: Partial<NormalizedOffer> = {}): NormalizedOffer {
  return {
    id: "shopify:a", source: "shopify", sourceItemId: "a", merchant: "Shop",
    title: "Torrey polo", descriptionSummary: null, imageUrl: null,
    price: { amountMinor: 2700n, currency: "USD", exponent: 2, basis: "catalog" },
    availability: "in_stock", variantLabel: "S", options: [{ name: "Color", value: "Black" }, { name: "Size", value: "S" }],
    condition: "new", shipping: null, productUrl: "https://merchant.example/p",
    checkout: { kind: "unavailable", reason: "fixture" }, providerMetadata: {}, verifiedAt: "2026-10-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("variant match evidence", () => {
  it("does not treat a description color as the variant color", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me a black polo under $50.");
    const described = sample({
      id: "white", title: "White court polo",
      descriptionSummary: "Inspired by a black and navy story.",
      options: [{ name: "Color", value: "White" }, { name: "Size", value: "S" }],
    });
    const classified = classifyOffers([sample(), described], constraints);
    expect(classified.exact.map((item) => item.id)).toEqual(["shopify:a"]);
    expect(classified.excluded[0]?.reasons.join(" ")).toMatch(/Variant color is White/);
    expect(matchOffer(described, constraints).evidence.find((item) => item.attribute === "color")?.status).toBe("conflict");
  });

  it("leaves a missing color unconfirmed instead of calling it a contradiction", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me a black polo under $50.");
    const offer = sample({ options: [{ name: "Size", value: "S" }], descriptionSummary: "The copy mentions black fabric." });
    const assessment = matchOffer(offer, constraints);
    expect(assessment.decision).toBe("uncertain");
    expect(assessment.evidence.find((item) => item.attribute === "color")).toMatchObject({ status: "unknown" });
  });

  it("does not treat a short size label as part of an unrelated word", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me a polo size s under $50.");
    const classic = sample({
      id: "classic", title: "Classic polo", variantLabel: null, options: [{ name: "Color", value: "Black" }],
    });
    const sized = sample({ id: "sized", title: "Black polo", options: [{ name: "Size", value: "S" }, { name: "Color", value: "Black" }] });
    const classified = classifyOffers([classic, sized], constraints);
    expect(classified.exact.map((item) => item.id)).toEqual(["sized"]);
    expect(classified.uncertain.map((item) => item.offer.id)).toEqual(["classic"]);
  });

  it("rejects a product type that appears only in the description", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me running shoes under $120.");
    const jacket = sample({ title: "Trail jacket", descriptionSummary: "Wear it with your running shoes.", options: [], variantLabel: null });
    expect(matchOffer(jacket, constraints).decision).toBe("uncertain");
    expect(matchOffer(jacket, constraints).evidence.find((item) => item.attribute === "product")?.detail).toMatch(/description/i);
  });

  it("does not rank a smaller foreign minor unit ahead of a dollar price", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me a black polo.");
    const usd = sample({ id: "usd", price: { amountMinor: 5000n, currency: "USD", exponent: 2, basis: "catalog" } });
    const euro = sample({ id: "eur", price: { amountMinor: 100n, currency: "EUR", exponent: 2, basis: "catalog" } });
    expect(classifyOffers([euro, usd], constraints).exact.map((item) => item.id)).toEqual(["usd", "eur"]);
  });

  it("keeps a non-dollar price out of a dollar budget instead of calling it over budget", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me a black polo under $50.");
    const euro = sample({ price: { amountMinor: 100n, currency: "EUR", exponent: 2, basis: "catalog" } });
    expect(matchOffer(euro, constraints).decision).toBe("uncertain");
    expect(matchOffer(euro, constraints).reasons.join(" ")).toMatch(/EUR/);
  });

  it("does not confirm a polo shirt from a Polo brand on a T-shirt", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me a black polo under $50.");
    const shirt = sample({
      id: "tee",
      title: "Polo Ralph Lauren Men's Custom Slim Fit Crewneck T-Shirt Black",
      options: [],
      variantLabel: null,
    });
    expect(matchOffer(shirt, constraints).decision).toBe("excluded");
    expect(matchOffer(shirt, constraints).evidence.find((item) => item.attribute === "product")?.status).toBe("conflict");
  });

  it("does not treat a shoe-size option as proof the product is shoes", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me running shoes size 42.");
    const named = sample({
      id: "named",
      title: "Men's adidas Adizero Evo SL",
      options: [{ name: "Shoe size", value: "42" }],
      variantLabel: "42",
    });
    const real = sample({
      id: "real",
      title: "Men's Energen Lux Running Shoes",
      options: [{ name: "Shoe size", value: "42" }, { name: "Color", value: "Black" }],
      variantLabel: "42",
    });
    expect(matchOffer(named, constraints).decision).not.toBe("exact");
    expect(matchOffer(named, constraints).evidence.find((item) => item.attribute === "product")?.status).toBe("unknown");
    expect(matchOffer(real, constraints).evidence.find((item) => item.attribute === "size")?.status).toBe("confirmed");
  });

  it("does not confirm a mixed color option as a single color", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me a black polo.");
    const mixed = sample({ title: "Solid pique polo shirt", options: [{ name: "Color", value: "Black/White" }, { name: "Size", value: "S" }] });
    expect(matchOffer(mixed, constraints).evidence.find((item) => item.attribute === "color")?.status).toBe("unknown");
  });

  it("does not read renewed or an unrecognized condition as new", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me a brand new polo.");
    expect(matchOffer(sample({ condition: "Renewed" }), constraints).evidence.find((item) => item.attribute === "condition")?.status).toBe("conflict");
    expect(matchOffer(sample({ condition: "Collector grade" }), constraints).evidence.find((item) => item.attribute === "condition")?.status).toBe("unknown");
    expect(matchOffer(sample({ condition: "Neu mit Etikett" }), constraints).evidence.find((item) => item.attribute === "condition")?.status).toBe("confirmed");
  });

  it("accepts a medium size alias without treating extra small as small", () => {
    const medium = mergeConstraints(emptyConstraints(), "Find me a polo size m.");
    const small = mergeConstraints(emptyConstraints(), "Find me a polo size s.");
    expect(matchOffer(sample({ options: [{ name: "Size", value: "Medium" }, { name: "Color", value: "Black" }] }), medium).evidence.find((item) => item.attribute === "size")?.status).toBe("confirmed");
    expect(matchOffer(sample({ options: [{ name: "Size", value: "Extra small" }, { name: "Color", value: "Black" }] }), small).evidence.find((item) => item.attribute === "size")?.status).toBe("conflict");
  });
});

describe("requirement controls", () => {
  it("adds, replaces, and clears through the same parser as a sentence", () => {
    let constraints = mergeConstraints(emptyConstraints(), "Find me a black polo under $50 size s.");
    constraints = mergeConstraints(constraints, requirementMessage({ kind: "add-color", color: "navy" }));
    expect(constraints.colors).toEqual(["black", "navy"]);
    constraints = mergeConstraints(constraints, requirementMessage({ kind: "replace-color", color: "navy" }));
    expect(constraints.colors).toEqual(["navy"]);
    constraints = mergeConstraints(constraints, requirementMessage({ kind: "clear-colors" }));
    expect(constraints.colors).toEqual([]);
    constraints = mergeConstraints(constraints, requirementMessage({ kind: "clear-budget" }));
    expect(constraints.maxPriceCents).toBeNull();
    constraints = mergeConstraints(constraints, requirementMessage({ kind: "clear-sizes" }));
    expect(constraints.sizes).toEqual([]);
    constraints = mergeConstraints(constraints, "size s is fine too");
    constraints = mergeConstraints(constraints, "size m is fine too");
    constraints = mergeConstraints(constraints, requirementMessage({ kind: "remove-size", size: "s" }));
    expect(constraints.sizes).toEqual(["m"]);
    constraints = mergeConstraints(constraints, "black is fine too");
    constraints = mergeConstraints(constraints, "white is fine too");
    constraints = mergeConstraints(constraints, requirementMessage({ kind: "remove-color", color: "black" }));
    expect(constraints.colors).toEqual(["white"]);
    expect(constraints.productQuery).toContain("polo");
  });
});
