import { describe, expect, it } from "vitest";
import { merchantHandoffLinks, merchantReviewUrl } from "../src/lib/offers";
import { normalizeShopifyProducts } from "../src/lib/shopify";
import { toOfferView } from "../src/lib/serialize";

it("only exposes HTTPS provider links without embedded credentials", () => {
  expect(merchantReviewUrl("https://merchant.example/cart/42:1")).toBe("https://merchant.example/cart/42:1");
  for (const url of [null, "javascript:alert(1)", "data:text/html,hello", "http://merchant.example", "https://user:secret@merchant.example", "not a URL"]) {
    expect(merchantReviewUrl(url)).toBeNull();
  }
});

describe("merchant handoff wording", () => {
  it("keeps a product page and a Shopify cart permalink as separate actions", () => {
    const [offer] = normalizeShopifyProducts([{
      id: "polo",
      title: "Black polo",
      url: "https://merchant.test/products/black-polo",
      variants: [{
        id: "gid://shopify/ProductVariant/1",
        title: "S",
        url: "https://merchant.test/products/black-polo?variant=1",
        price: { amount: 1000, currency: "USD" },
        checkout_url: "https://merchant.test/cart/1:1",
        availability: { available: true },
      }],
    }], "2026-10-08T00:00:00.000Z");
    const view = toOfferView(offer!, 2);
    expect(view.productUrl).toBe("https://merchant.test/products/black-polo?variant=1");
    expect(view.merchantCartUrl).toBe("https://merchant.test/cart/1:2");
    expect(merchantHandoffLinks({ productUrl: view.productUrl, cartUrl: view.merchantCartUrl }).map((link) => link.label)).toEqual([
      "Open product page. This does not pay or place an order.",
      "Continue to merchant cart. This does not pay or place an order.",
    ]);
  });

  it("does not call a cart permalink or an unrecognized checkout URL a product page", () => {
    expect(merchantHandoffLinks({ otherUrl: "https://merchant.test/cart/1:1" }).map((link) => [link.kind, link.label])).toEqual([
      ["cart", "Continue to merchant cart. This does not pay or place an order."],
    ]);
    expect(merchantHandoffLinks({ cartUrl: "https://merchant.test/checkout/abc" }).map((link) => link.kind)).toEqual(["unknown"]);
    expect(merchantHandoffLinks({ productUrl: "https://merchant.test/checkout/abc" }).map((link) => link.kind)).toEqual(["unknown"]);
    expect(merchantHandoffLinks({ productUrl: "http://merchant.test/products/polo" })).toEqual([]);
  });
});
