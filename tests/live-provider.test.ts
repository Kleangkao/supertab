import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readConfig } from "../src/lib/config";
import { mergeConstraints, emptyConstraints } from "../src/lib/constraints";
import { matchOffer } from "../src/lib/match-evidence";
import { searchEbay } from "../src/lib/ebay";
import { searchShopify } from "../src/lib/shopify";

const live = process.env.SUPERTAB_LIVE_SHOP === "1";

describe.skipIf(!live)("live provider snapshot", () => {
  const queries = [
    "black polo under $50",
    "running shoes size 42",
    "iphone case",
    "sony wireless headphones",
    "leather belt",
    "refurbished iphone",
    "navy wool sweater",
    "usb-c cable for ipad",
  ];

  it("records sanitized shopify and ebay outcomes", async () => {
    const config = readConfig();
    const rows: unknown[] = [];
    for (const message of queries) {
      const constraints = mergeConstraints(emptyConstraints(), `Find me ${message}`);
      const [shopify, ebay] = await Promise.all([
        searchShopify({
          query: constraints.productQuery || message,
          maxPriceCents: constraints.maxPriceCents,
          shipToCountry: constraints.shipToCountry ?? config.shopifyShipTo,
          limit: 4,
        }, {
          enabled: config.shopifyEnabled,
          endpoint: config.shopifyCatalogUrl,
          profileUrl: config.shopifyProfile,
        }),
        searchEbay({
          query: constraints.productQuery || message,
          maxPriceCents: constraints.maxPriceCents,
          limit: 4,
        }, {
          clientId: config.ebayClientId,
          clientSecret: config.ebayClientSecret,
          environment: config.ebayEnvironment,
          marketplaceId: config.ebayMarketplaceId,
        }),
      ]);
      for (const result of [shopify, ebay]) {
        rows.push({
          request: message,
          constraints: {
            productQuery: constraints.productQuery,
            colors: constraints.colors,
            sizes: constraints.sizes,
            condition: constraints.condition,
            budget: constraints.maxPriceCents?.toString() ?? null,
          },
          provider: result.provider,
          status: result.status,
          message: result.message ?? null,
          offers: result.offers.slice(0, 4).map((offer) => {
            const assessment = matchOffer(offer, constraints);
            return {
              title: offer.title.slice(0, 120),
              variant: offer.variantLabel?.slice(0, 80) ?? null,
              options: offer.options.map((option) => `${option.name}=${option.value}`).slice(0, 6),
              condition: offer.condition,
              availability: offer.availability,
              currency: offer.price?.currency ?? null,
              exponent: offer.price?.exponent ?? null,
              amountMinor: offer.price?.amountMinor.toString() ?? null,
              merchantPresent: Boolean(offer.merchant),
              imagePresent: Boolean(offer.imageUrl),
              decision: assessment.decision,
              evidence: assessment.evidence.map((item) => `${item.attribute}:${item.status}`),
            };
          }),
        });
      }
    }
    const evidence = { observedAt: "2026-10-08T15:14:00+07:00", source: "live-provider", rows };
    const directory = new URL("./fixtures/", import.meta.url);
    mkdirSync(directory, { recursive: true });
    writeFileSync(new URL("./fixtures/live-shop-2026-10-08.json", import.meta.url), JSON.stringify(evidence, null, 2));
    expect(rows.length).toBe(queries.length * 2);
  }, 90_000);
});
