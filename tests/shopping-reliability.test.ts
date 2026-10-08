import { describe, expect, it } from "vitest";
import { readConfig } from "../src/lib/config";
import { ShoppingService } from "../src/lib/shopping";
import { snapshotWriteAllowed } from "../src/lib/session-snapshot";
import { fixturesEnabled } from "../src/lib/shop-fixtures";

describe("shopping reliability", () => {
  it("drops a turn when the session cannot be saved", async () => {
    let fail = true;
    const service = new ShoppingService({
      config: readConfig({ GEMINI_API_KEY: "", SHOPIFY_CATALOG_ENABLED: "false", EBAY_CLIENT_ID: "", EBAY_CLIENT_SECRET: "" }),
      sessionStore: {
        async load() { return null; },
        async save() { if (fail) throw new Error("Shopping session could not be saved."); },
      },
    });
    await expect(service.converse(null, "Find me a black polo")).rejects.toThrow(/saved/);
    fail = false;
    const view = await service.converse(null, "Find me a black polo");
    expect(view.messages.filter((message) => message.role === "user").map((message) => message.text)).toEqual(["Find me a black polo"]);
  });

  it("refuses a snapshot write from an older revision", () => {
    expect(snapshotWriteAllowed(null, 0)).toBe(true);
    expect(snapshotWriteAllowed(JSON.stringify({ revision: 1 }), 1)).toBe(true);
    expect(snapshotWriteAllowed(JSON.stringify({ revision: 2 }), 1)).toBe(false);
  });

  it("keeps fixture products off a deployed environment", () => {
    expect(fixturesEnabled({ SUPERTAB_SHOP_FIXTURES: "1" })).toBe(false);
    expect(fixturesEnabled({ SUPERTAB_SHOP_FIXTURES: "1", SUPERTAB_ALLOW_SHOP_FIXTURES: "1" })).toBe(true);
    expect(fixturesEnabled({ SUPERTAB_SHOP_FIXTURES: "1", SUPERTAB_ALLOW_SHOP_FIXTURES: "1", VERCEL: "1" })).toBe(false);
    expect(fixturesEnabled({ SUPERTAB_SHOP_FIXTURES: "1", SUPERTAB_ALLOW_SHOP_FIXTURES: "1", VERCEL_ENV: "production" })).toBe(false);
    expect(fixturesEnabled({ SUPERTAB_SHOP_FIXTURES: "1", SUPERTAB_ALLOW_SHOP_FIXTURES: "1", SUPERTAB_DEPLOYMENT: "live" })).toBe(false);
    expect(fixturesEnabled({})).toBe(false);
  });
});
