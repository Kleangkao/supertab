import { parseDecimalToMinor } from "./money";
import { offerId, summarizeText, type NormalizedOffer } from "./offers";

export interface EbaySearchInput {
  query: string;
  maxPriceCents: bigint | null;
  limit: number;
}

export interface EbayProviderOptions {
  clientId: string | null;
  clientSecret: string | null;
  environment?: "production" | "sandbox";
  marketplaceId?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

export interface EbayProviderResult {
  provider: "ebay";
  status: "ok" | "not_configured" | "unavailable" | "error" | "timeout";
  offers: NormalizedOffer[];
  message?: string;
}

export async function searchEbay(input: EbaySearchInput, options: EbayProviderOptions): Promise<EbayProviderResult> {
  if (!options.clientId || !options.clientSecret) {
    return {
      provider: "ebay",
      status: "not_configured",
      offers: [],
      message: "eBay discovery needs EBAY_CLIENT_ID and EBAY_CLIENT_SECRET.",
    };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const base = options.environment === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  try {
    const token = await ebayApplicationToken(base, options.clientId, options.clientSecret, fetchImpl, options.timeoutMs ?? 12_000);
    const first = await browse(base, token, input, options, fetchImpl, true);
    const payload = first.status === 400 && input.maxPriceCents != null
      ? await browse(base, token, input, options, fetchImpl, false)
      : first;
    if (payload.status === 401 || payload.status === 403) {
      return { provider: "ebay", status: "error", offers: [], message: "eBay refused the discovery credential." };
    }
    if (payload.status < 200 || payload.status >= 300) {
      return { provider: "ebay", status: "unavailable", offers: [], message: `eBay search returned ${payload.status}.` };
    }
    const summaries = Array.isArray(payload.body?.itemSummaries) ? payload.body.itemSummaries : [];
    const offers = normalizeEbaySummaries(summaries, now().toISOString());
    return {
      provider: "ebay",
      status: "ok",
      offers,
      message: offers.length === 0 ? "eBay returned no listings for this search." : undefined,
    };
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return { provider: "ebay", status: "timeout", offers: [], message: "eBay took too long to answer." };
    }
    return { provider: "ebay", status: "unavailable", offers: [], message: "eBay could not be reached." };
  }
}

export function normalizeEbaySummaries(summaries: unknown[], verifiedAt: string): NormalizedOffer[] {
  const offers: NormalizedOffer[] = [];
  for (const summary of summaries) {
    const offer = normalizeSummary(summary, verifiedAt);
    if (offer) offers.push(offer);
  }
  return offers;
}

function normalizeSummary(summary: unknown, verifiedAt: string): NormalizedOffer | null {
  if (!summary || typeof summary !== "object") return null;
  const item = summary as Record<string, unknown>;
  const sourceItemId = typeof item.itemId === "string" ? item.itemId : null;
  const title = typeof item.title === "string" ? item.title : null;
  if (!sourceItemId || !title) return null;
  const price = item.price && typeof item.price === "object" ? item.price as { value?: string; currency?: string } : null;
  const seller = item.seller && typeof item.seller === "object" ? item.seller as { username?: string } : null;
  const image = item.image && typeof item.image === "object" ? item.image as { imageUrl?: string } : null;
  return {
    id: offerId("ebay", sourceItemId),
    source: "ebay",
    sourceItemId,
    merchant: seller?.username ?? null,
    title,
    descriptionSummary: summarizeText(typeof item.shortDescription === "string" ? item.shortDescription : null),
    imageUrl: image?.imageUrl ?? null,
    price: parseListingPrice(price?.value, price?.currency),
    availability: "unknown",
    variantLabel: null,
    options: [],
    condition: typeof item.condition === "string" ? item.condition : null,
    shipping: shippingOf(item.shippingOptions),
    productUrl: typeof item.itemWebUrl === "string" ? item.itemWebUrl : null,
    checkout: {
      kind: "unavailable",
      reason: "eBay listing search does not include permission to purchase or place an order.",
    },
    providerMetadata: {
      priceBasis: "listing",
      buyingOptions: Array.isArray(item.buyingOptions) ? item.buyingOptions.filter((value) => typeof value === "string").join(",") : null,
    },
    verifiedAt,
  };
}

function parseListingPrice(value: string | undefined, currency: string | undefined): NormalizedOffer["price"] {
  if (!value || !currency) return null;
  try {
    return {
      amountMinor: parseDecimalToMinor(value, 2),
      currency: currency.toUpperCase(),
      exponent: 2,
      basis: "listing",
    };
  } catch {
    return null;
  }
}

function shippingOf(value: unknown): NormalizedOffer["shipping"] {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first = value[0] as {
    shippingCostType?: string;
    shippingCost?: { value?: string; currency?: string };
  };
  if (first?.shippingCostType === "FREE") {
    return { summary: "Shipping listed as free", costMinor: 0n, currency: first.shippingCost?.currency?.toUpperCase() ?? "USD" };
  }
  if (first?.shippingCost?.value && first.shippingCost.currency) {
    try {
      return {
        summary: "Shipping cost provided with the listing",
        costMinor: parseDecimalToMinor(first.shippingCost.value, 2),
        currency: first.shippingCost.currency.toUpperCase(),
      };
    } catch {
      return { summary: "Shipping was mentioned but could not be read", costMinor: null, currency: null };
    }
  }
  return { summary: "Shipping was listed without a cost", costMinor: null, currency: null };
}

async function ebayApplicationToken(
  base: string,
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<string> {
  const response = await fetchImpl(`${base}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`eBay token request failed (${response.status}).`);
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("eBay did not return an application token.");
  return body.access_token;
}

async function browse(
  base: string,
  token: string,
  input: EbaySearchInput,
  options: EbayProviderOptions,
  fetchImpl: typeof fetch,
  withPriceFilter: boolean,
): Promise<{ status: number; body: { itemSummaries?: unknown[] } | null }> {
  const params = new URLSearchParams({
    q: input.query,
    limit: String(Math.min(Math.max(input.limit, 1), 20)),
  });
  if (withPriceFilter && input.maxPriceCents != null) {
    const dollars = formatEbayPrice(input.maxPriceCents);
    params.set("filter", `price:[..${dollars}],priceCurrency:USD`);
  }
  const response = await fetchImpl(`${base}/buy/browse/v1/item_summary/search?${params.toString()}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "x-ebay-c-marketplace-id": options.marketplaceId ?? "EBAY_US",
      accept: "application/json",
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) as { itemSummaries?: unknown[] } : null };
}

function formatEbayPrice(cents: bigint): string {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}
