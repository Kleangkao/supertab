import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyConstraints, mergeConstraints } from "../src/lib/constraints";
import { matchOffer } from "../src/lib/match-evidence";
import type { NormalizedOffer } from "../src/lib/offers";

interface SnapOffer {
  title: string;
  variant: string | null;
  options: string[];
  condition: string | null;
  availability: "in_stock" | "out_of_stock" | "unknown";
  currency: string | null;
  amountMinor: string | null;
}
interface SnapRow {
  request: string;
  provider: string;
  offers: SnapOffer[];
}

const fixtureUrl = new URL("./fixtures/live-shop-2026-10-08.json", import.meta.url);
const fixturePath = fixtureUrl.pathname.startsWith("/") && /^[A-Za-z]:/.test(decodeURIComponent(fixtureUrl.pathname.slice(1)))
  ? decodeURIComponent(fixtureUrl.pathname.slice(1))
  : decodeURIComponent(fixtureUrl.pathname);
const hasFixture = existsSync(fixturePath);
const evidence = hasFixture
  ? JSON.parse(readFileSync(fixturePath, "utf8")) as { rows: SnapRow[] }
  : { rows: [] as SnapRow[] };

function offerFrom(row: SnapOffer, id: string): NormalizedOffer {
  return {
    id, source: "shopify", sourceItemId: id, merchant: "Recorded merchant", title: row.title,
    descriptionSummary: null, imageUrl: null,
    price: row.amountMinor && row.currency ? { amountMinor: BigInt(row.amountMinor), currency: row.currency, exponent: 2, basis: "catalog" } : null,
    availability: row.availability,
    variantLabel: row.variant,
    options: row.options.map((option) => {
      const [name, ...rest] = option.split("=");
      return { name: name ?? "", value: rest.join("=") };
    }),
    condition: row.condition, shipping: null, productUrl: "https://merchant.example/recorded",
    checkout: { kind: "unavailable", reason: "snapshot" }, providerMetadata: {}, verifiedAt: "2026-10-08T08:14:00.000Z",
  };
}

function recorded(request: string, title: string): SnapOffer {
  const row = evidence.rows.find((item) => item.request === request && item.offers.some((offer) => offer.title === title));
  const offer = row?.offers.find((item) => item.title === title);
  if (!offer) throw new Error(`Missing snapshot ${request} / ${title}`);
  return offer;
}

describe.skipIf(!hasFixture)("sanitized live snapshot", () => {
  it("keeps the observed polo shirt and rejects the observed brand T-shirt", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me black polo under $50");
    const polo = offerFrom(recorded("black polo under $50", "Drop-Cut: LUX Polo"), "polo");
    const tee = offerFrom(recorded("black polo under $50", "Polo Ralph Lauren Men's Custom Slim Fit  Crewneck T-Shirt Black & White -S-XXL"), "tee");
    expect(matchOffer(polo, constraints).decision).toBe("exact");
    expect(matchOffer(tee, constraints).decision).not.toBe("exact");
  });

  it("does not confirm an iPad cable from a generic USB-C cable title", () => {
    const constraints = mergeConstraints(emptyConstraints(), "Find me usb-c cable for ipad");
    const generic = offerFrom(recorded("usb-c cable for ipad", "USB-C to USB-C Cable - 10 Inches"), "cable");
    expect(matchOffer(generic, constraints).decision).not.toBe("exact");
    expect(matchOffer(generic, constraints).evidence.find((item) => item.attribute === "product")?.status).toBe("unknown");
  });
});
