import { offerId, summarizeText, type NormalizedOffer } from "./offers";

export const DEFAULT_SHOPIFY_CATALOG_URL = "https://catalog.shopify.com/api/ucp/mcp";
export const DEFAULT_SHOPIFY_PROFILE = "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json";

export interface ShopifySearchInput {
  query: string;
  maxPriceCents: bigint | null;
  shipToCountry: string | null;
  limit: number;
}

export interface ShopifyProviderOptions {
  enabled: boolean;
  endpoint?: string;
  profileUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

export interface ProviderResult {
  provider: "shopify" | "ebay";
  status: "ok" | "not_configured" | "unavailable" | "error" | "timeout";
  offers: NormalizedOffer[];
  message?: string;
}

export async function searchShopify(input: ShopifySearchInput, options: ShopifyProviderOptions): Promise<ProviderResult> {
  if (!options.enabled) {
    return { provider: "shopify", status: "not_configured", offers: [], message: "Shopify catalog search is turned off." };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  try {
    const response = await fetchImpl(options.endpoint ?? DEFAULT_SHOPIFY_CATALOG_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify(catalogRequest(input, options.profileUrl ?? DEFAULT_SHOPIFY_PROFILE)),
      signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
    });
    const text = await response.text();
    if (!response.ok) {
      return { provider: "shopify", status: "unavailable", offers: [], message: `Shopify catalog returned ${response.status}.` };
    }
    const payload = parseMcpBody(text);
    const errorMessage = mcpError(payload);
    if (errorMessage) return { provider: "shopify", status: "error", offers: [], message: errorMessage };
    const offers = normalizeShopifyProducts(productsFrom(payload), now().toISOString()).slice(0, 24);
    return {
      provider: "shopify",
      status: "ok",
      offers,
      message: offers.length === 0 ? "Shopify returned no products for this search." : undefined,
    };
  } catch (error) {
    if (isTimeout(error)) {
      return { provider: "shopify", status: "timeout", offers: [], message: "Shopify took too long to answer." };
    }
    return { provider: "shopify", status: "unavailable", offers: [], message: "Shopify catalog could not be reached." };
  }
}

export function normalizeShopifyProducts(products: unknown[], verifiedAt: string): NormalizedOffer[] {
  const offers: NormalizedOffer[] = [];
  for (const product of products) {
    if (!product || typeof product !== "object") continue;
    const record = product as Record<string, unknown>;
    const variants = Array.isArray(record.variants) ? record.variants.slice(0, 6) : [record];
    for (const variant of variants) {
      const offer = normalizeVariant(record, variant, verifiedAt);
      if (offer) offers.push(offer);
    }
  }
  return offers;
}

function normalizeVariant(product: Record<string, unknown>, variant: unknown, verifiedAt: string): NormalizedOffer | null {
  if (!variant || typeof variant !== "object") return null;
  const item = variant as Record<string, unknown>;
  const sourceItemId = stringValue(item.id) ?? stringValue(product.id);
  if (!sourceItemId) return null;
  const title = stringValue(product.title) ?? stringValue(item.title) ?? "Untitled product";
  const price = moneyField(item.price) ?? moneyField(product.price_range && (product.price_range as { min?: unknown }).min);
  const seller = item.seller && typeof item.seller === "object" ? item.seller as Record<string, unknown> : null;
  const availability = availabilityOf(item.availability);
  const options = optionsOf(item.options);
  const checkoutUrl = stringValue(item.checkout_url);
  const nativeCheckout = Boolean((item.eligible as { native_checkout?: boolean } | undefined)?.native_checkout);
  const condition = Array.isArray(item.condition) ? item.condition.filter((value): value is string => typeof value === "string").join(", ") : null;
  return {
    id: offerId("shopify", sourceItemId),
    source: "shopify",
    sourceItemId,
    merchant: stringValue(seller?.name),
    title,
    descriptionSummary: summarizeText(plainText(item.description) ?? plainText(product.description)),
    imageUrl: imageOf(item.media) ?? imageOf(product.media),
    price: price ? { ...price, basis: "catalog" } : null,
    availability,
    variantLabel: options.length > 0 ? options.map((option) => option.value).join(" / ") : stringValue(item.title),
    options,
    condition: condition || null,
    shipping: null,
    productUrl: stringValue(item.url) ?? stringValue(product.url),
    checkout: checkoutUrl
      ? { kind: "merchant_cart_link", url: checkoutUrl, nativeCheckout }
      : { kind: "unavailable", reason: "Shopify did not return a checkout link for this variant." },
    providerMetadata: {
      priceBasis: "catalog",
      nativeCheckout,
      shopId: stringValue(seller?.id),
    },
    verifiedAt,
  };
}

function catalogRequest(input: ShopifySearchInput, profile: string) {
  const filters: Record<string, unknown> = { available: true };
  if (input.shipToCountry) filters.ships_to = { country: input.shipToCountry };
  if (input.maxPriceCents != null && input.maxPriceCents <= BigInt(Number.MAX_SAFE_INTEGER)) {
    filters.price = { max: Number(input.maxPriceCents) };
  }
  return {
    jsonrpc: "2.0",
    method: "tools/call",
    id: 1,
    params: {
      name: "search_catalog",
      arguments: {
        meta: { "ucp-agent": { profile } },
        catalog: {
          query: input.query,
          filters,
          context: {
            address_country: input.shipToCountry ?? "US",
            intent: input.query,
          },
          pagination: { limit: Math.min(Math.max(input.limit, 1), 10) },
        },
      },
    },
  };
}

function productsFrom(payload: unknown): unknown[] {
  const root = payload as { result?: { structuredContent?: { products?: unknown[] }; content?: { text?: string }[] } };
  const structured = root?.result?.structuredContent?.products;
  if (Array.isArray(structured)) return structured;
  const content = root?.result?.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (!part?.text) continue;
      try {
        const parsed = JSON.parse(part.text) as { products?: unknown[] };
        if (Array.isArray(parsed.products)) return parsed.products;
      } catch {
        continue;
      }
    }
  }
  return [];
}

function mcpError(payload: unknown): string | null {
  const root = payload as { error?: { message?: string }; result?: { isError?: boolean } };
  if (root?.error?.message) return "Shopify catalog rejected the search.";
  if (root?.result?.isError) return "Shopify catalog could not complete the search.";
  return null;
}

function moneyField(value: unknown): { amountMinor: bigint; currency: string; exponent: number } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { amount?: unknown; currency?: unknown };
  if (typeof record.amount !== "number" || !Number.isSafeInteger(record.amount) || record.amount < 0) return null;
  if (typeof record.currency !== "string" || record.currency.length !== 3) return null;
  return { amountMinor: BigInt(record.amount), currency: record.currency.toUpperCase(), exponent: 2 };
}

function availabilityOf(value: unknown): NormalizedOffer["availability"] {
  if (!value || typeof value !== "object") return "unknown";
  const available = (value as { available?: boolean }).available;
  if (available === true) return "in_stock";
  if (available === false) return "out_of_stock";
  return "unknown";
}

function optionsOf(value: unknown): { name: string; value: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option) => {
    if (!option || typeof option !== "object") return [];
    const record = option as { name?: string; label?: string };
    if (!record.name || !record.label) return [];
    return [{ name: record.name, value: record.label }];
  });
}

function imageOf(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const media of value) {
    if (media && typeof media === "object" && (media as { type?: string }).type === "image") {
      const url = (media as { url?: string }).url;
      if (typeof url === "string") return url;
    }
  }
  return null;
}

function plainText(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { plain?: string; html?: string };
  return record.plain ?? record.html ?? null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseMcpBody(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed) as unknown;
  const lines = trimmed.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("data:"));
  const last = lines.map((line) => line.slice(5).trim()).filter((line) => line && line !== "[DONE]").at(-1);
  return last ? JSON.parse(last) as unknown : null;
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}
