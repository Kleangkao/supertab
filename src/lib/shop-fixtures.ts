import type { NormalizedOffer } from "./offers";
import type { ProviderResult } from "./shopify";

const WHEN = "2026-10-08T06:00:00.000Z";

function offer(input: Partial<NormalizedOffer> & Pick<NormalizedOffer, "id" | "title" | "sourceItemId">): NormalizedOffer {
  return {
    source: "shopify",
    merchant: "Fixture merchant",
    descriptionSummary: null,
    imageUrl: null,
    price: { amountMinor: 2700n, currency: "USD", exponent: 2, basis: "catalog" },
    availability: "in_stock",
    variantLabel: "S",
    options: [],
    condition: "new",
    shipping: null,
    productUrl: "https://merchant.test/products/fixture",
    checkout: { kind: "merchant_cart_link", url: "https://merchant.test/cart/1:1", nativeCheckout: false },
    providerMetadata: {},
    verifiedAt: WHEN,
    ...input,
  };
}

const polos: NormalizedOffer[] = [
  offer({
    id: "shopify:black-polo",
    sourceItemId: "gid://shopify/ProductVariant/101",
    title: "Black Torrey Polo",
    variantLabel: "S",
    options: [{ name: "Color", value: "Black" }, { name: "Size", value: "S" }],
    price: { amountMinor: 2700n, currency: "USD", exponent: 2, basis: "catalog" },
    productUrl: "https://merchant.test/products/black-polo",
  }),
  offer({
    id: "shopify:navy-polo",
    sourceItemId: "gid://shopify/ProductVariant/102",
    title: "Navy Torrey Polo",
    variantLabel: "S",
    options: [{ name: "Color", value: "Navy" }, { name: "Size", value: "S" }],
    price: { amountMinor: 3200n, currency: "USD", exponent: 2, basis: "catalog" },
    productUrl: "https://merchant.test/products/navy-polo",
  }),
  offer({
    id: "shopify:white-polo",
    sourceItemId: "gid://shopify/ProductVariant/103",
    title: "White court polo",
    descriptionSummary: "The description mentions black and navy, which is not this variant.",
    variantLabel: "S",
    options: [{ name: "Color", value: "White" }, { name: "Size", value: "S" }],
    price: { amountMinor: 2000n, currency: "USD", exponent: 2, basis: "catalog" },
    productUrl: "https://merchant.test/products/white-polo",
  }),
  offer({
    id: "shopify:euro-polo",
    sourceItemId: "gid://shopify/ProductVariant/104",
    title: "Black euro polo",
    variantLabel: "S",
    options: [{ name: "Color", value: "Black" }, { name: "Size", value: "S" }],
    price: { amountMinor: 1500n, currency: "EUR", exponent: 2, basis: "catalog" },
    productUrl: "https://merchant.test/products/euro-polo",
  }),
];

const shoes: NormalizedOffer[] = [
  offer({
    id: "shopify:black-shoes",
    sourceItemId: "gid://shopify/ProductVariant/201",
    title: "Black running shoes",
    variantLabel: "42",
    options: [{ name: "Color", value: "Black" }, { name: "Size", value: "42" }],
    price: { amountMinor: 9000n, currency: "USD", exponent: 2, basis: "catalog" },
    productUrl: "https://merchant.test/products/shoes",
  }),
];

/** Hosted / PaaS markers that must never serve fixture products as live listings. */
const HOSTED_MARKERS = [
  "VERCEL",
  "VERCEL_ENV",
  "CF_PAGES",
  "NETLIFY",
  "AWS_EXECUTION_ENV",
  "K_SERVICE",
  "FLY_APP_NAME",
  "RENDER",
  "RAILWAY_ENVIRONMENT",
] as const;

function hostedDeployment(env: Record<string, string | undefined>): boolean {
  if (env.SUPERTAB_DEPLOYMENT === "live") return true;
  return HOSTED_MARKERS.some((name) => Boolean(env[name]));
}

/**
 * Deterministic catalog for local Playwright against a production-built Next server.
 * Requires both explicit flags. Hosted markers always refuse. NODE_ENV alone is not enough.
 * Clients cannot enable fixtures; only process env on the server matters.
 */
export function fixturesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.SUPERTAB_SHOP_FIXTURES !== "1") return false;
  if (env.SUPERTAB_ALLOW_SHOP_FIXTURES !== "1") return false;
  if (hostedDeployment(env)) return false;
  return true;
}

/** True when fixtures were requested in a way that must never serve synthetic products. */
export function fixturesMisconfigured(env: Record<string, string | undefined> = process.env): boolean {
  if (env.SUPERTAB_SHOP_FIXTURES !== "1") return false;
  if (hostedDeployment(env)) return true;
  return env.SUPERTAB_ALLOW_SHOP_FIXTURES !== "1";
}

export function fixtureProviders(message: string): [ProviderResult, ProviderResult] {
  const text = message.toLowerCase();
  const offers = /\bshoe/.test(text) ? shoes : /\btent\b/.test(text) ? [] : polos;
  return [
    { provider: "shopify", status: "ok", offers },
    { provider: "ebay", status: "unavailable", offers: [], message: "eBay is unavailable in this fixture. Shopify results are still listed." },
  ];
}
