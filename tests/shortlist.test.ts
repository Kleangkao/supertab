import { describe, expect, it } from "vitest";
import { addToShortlist, clearShortlist, itemPriceNote, loadShortlist, removeFromShortlist, type ShortlistItem } from "../src/lib/shortlist";

function memory(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function item(id: string, overrides: Partial<ShortlistItem> = {}): ShortlistItem {
  return {
    id, source: "shopify", sourceItemId: id, merchant: "Fixture", title: `Product ${id}`,
    variantLabel: "S", condition: "new", availability: "in_stock",
    priceDisplay: "$27.00", priceMinor: "2700", currency: "USD",
    shippingDisplay: null, shippingSummary: null, merchantReviewUrl: "https://merchant.test/p",
    verifiedAt: "2026-10-08T00:00:00.000Z", savedAt: "2026-10-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("shortlist", () => {
  it("saves four distinct variants, ignores a duplicate, and survives a second read", () => {
    const storage = memory();
    for (const id of ["a", "b", "c", "d"]) addToShortlist(storage, item(id), "2026-10-08T01:00:00.000Z");
    expect(addToShortlist(storage, item("a"), "2026-10-08T02:00:00.000Z").notice).toMatch(/Already/);
    expect(addToShortlist(storage, item("e"), "2026-10-08T02:00:00.000Z").notice).toMatch(/four/);
    expect(loadShortlist(storage).map((saved) => saved.id)).toEqual(["a", "b", "c", "d"]);
    expect(removeFromShortlist(storage, "b").map((saved) => saved.id)).toEqual(["a", "c", "d"]);
  });

  it("drops a corrupt record and does not keep a payment field", () => {
    const storage = memory();
    storage.setItem("supertab.shortlist.v1", "{");
    expect(loadShortlist(storage)).toEqual([]);
    addToShortlist(storage, item("a", { merchantReviewUrl: "http://insecure.example/p" }), "2026-10-08T01:00:00.000Z");
    const saved = loadShortlist(storage)[0]!;
    expect(saved.merchantReviewUrl).toBeNull();
    expect(JSON.stringify(saved)).not.toMatch(/wallet|approval|transaction/i);
  });

  it("does not call mixed currencies or missing shipping a delivered ranking", () => {
    expect(itemPriceNote([item("a", { currency: "USD" }), item("b", { currency: "EUR", priceMinor: "100" })])).toMatch(/different currencies/);
    expect(itemPriceNote([item("a"), item("b")])).toMatch(/not a delivered total/);
  });

  it("keeps the list when clearing fails and does not invent stock", () => {
    const storage = memory();
    addToShortlist(storage, item("a"), "2026-10-08T01:00:00.000Z");
    storage.setItem = () => { throw new Error("quota"); };
    expect(clearShortlist(storage).map((saved) => saved.id)).toEqual(["a"]);
    const loose = memory();
    loose.setItem("supertab.shortlist.v1", JSON.stringify({ version: 1, items: [{ ...item("b"), availability: "preorder" }] }));
    expect(loadShortlist(loose)[0]?.availability).toBe("unknown");
  });
});
