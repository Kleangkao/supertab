import { expect, it } from "vitest";
import { merchantReviewUrl } from "../src/lib/offers";

it("only exposes HTTPS provider links without embedded credentials", () => {
  expect(merchantReviewUrl("https://merchant.example/cart/42:1")).toBe("https://merchant.example/cart/42:1");
  for (const url of [null, "javascript:alert(1)", "data:text/html,hello", "http://merchant.example", "https://user:secret@merchant.example", "not a URL"]) {
    expect(merchantReviewUrl(url)).toBeNull();
  }
});
