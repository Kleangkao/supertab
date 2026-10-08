export interface ShortlistItem {
  id: string;
  source: "shopify" | "ebay";
  sourceItemId: string;
  merchant: string | null;
  title: string;
  variantLabel: string | null;
  condition: string | null;
  availability: "in_stock" | "out_of_stock" | "unknown";
  priceDisplay: string | null;
  priceMinor: string | null;
  currency: string | null;
  shippingDisplay: string | null;
  shippingSummary: string | null;
  productUrl: string | null;
  merchantCartUrl: string | null;
  merchantReviewUrl: string | null;
  verifiedAt: string;
  savedAt: string;
}

const NONE: ShortlistItem[] = [];
const KEY = "supertab.shortlist.v1";
const MAX = 4;
let cachedRaw = "";
let cached: ShortlistItem[] = [];

export function loadShortlist(storage: Storage | null): ShortlistItem[] {
  if (!storage) return cached;
  let raw = "";
  try { raw = storage.getItem(KEY) ?? ""; } catch { return NONE; }
  if (raw === cachedRaw) return cached;
  const parsed = parseShortlist(raw);
  if (raw && parsed == null) {
    try { storage.setItem(KEY, ""); } catch { /* Storage is optional. */ }
    cachedRaw = "";
    cached = [];
    return cached;
  }
  cachedRaw = raw;
  cached = parsed ?? [];
  return cached;
}

export function addToShortlist(storage: Storage, item: ShortlistItem, nowIso: string): { items: ShortlistItem[]; notice: string } {
  const current = loadShortlist(storage);
  if (current.some((saved) => saved.id === item.id)) return { items: current, notice: "Already on your shortlist." };
  if (current.length >= MAX) return { items: current, notice: "The shortlist holds four products. Remove one first." };
  const next = [...current, { ...sanitize(item), savedAt: nowIso }];
  if (!write(storage, next)) return { items: current, notice: "This browser could not save the shortlist." };
  return { items: next, notice: "Saved to your shortlist." };
}

export function removeFromShortlist(storage: Storage, id: string): ShortlistItem[] {
  const next = loadShortlist(storage).filter((item) => item.id !== id);
  return write(storage, next) ? next : loadShortlist(storage);
}

export function clearShortlist(storage: Storage): ShortlistItem[] {
  const current = loadShortlist(storage);
  return write(storage, []) ? [] : current;
}

export function itemPriceNote(items: ShortlistItem[]): string {
  if (items.length < 2) return "Save a second product to compare item prices.";
  if (items.some((item) => !item.priceMinor || !item.currency)) return "An item price was not returned, so these cannot be ranked.";
  const currencies = new Set(items.map((item) => item.currency));
  if (currencies.size !== 1) return "These item prices use different currencies. SuperTab does not convert them.";
  return "Lowest item price only. Shipping or tax is not a delivered total.";
}

function write(storage: Storage, items: ShortlistItem[]): boolean {
  const raw = JSON.stringify({ version: 1, items });
  try { storage.setItem(KEY, raw); } catch { return false; }
  cachedRaw = raw;
  cached = items;
  return true;
}

function parseShortlist(raw: string): ShortlistItem[] | null {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; items?: unknown };
    if (parsed.version !== 1 || !Array.isArray(parsed.items)) return null;
    return parsed.items.slice(0, MAX).map(sanitize).filter((item) => item.id && item.title);
  } catch { return null; }
}

function sanitize(value: unknown): ShortlistItem {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const source = record.source === "ebay" ? "ebay" : "shopify";
  const availability = record.availability === "in_stock" || record.availability === "out_of_stock" || record.availability === "unknown"
    ? record.availability
    : "unknown";
  return {
    id: text(record.id),
    source,
    sourceItemId: text(record.sourceItemId),
    merchant: text(record.merchant) || null,
    title: text(record.title),
    variantLabel: text(record.variantLabel) || null,
    condition: text(record.condition) || null,
    availability,
    priceDisplay: text(record.priceDisplay) || null,
    priceMinor: text(record.priceMinor) || null,
    currency: text(record.currency) || null,
    shippingDisplay: text(record.shippingDisplay) || null,
    shippingSummary: text(record.shippingSummary) || null,
    productUrl: safeHttps(text(record.productUrl)),
    merchantCartUrl: safeHttps(text(record.merchantCartUrl)),
    merchantReviewUrl: safeHttps(text(record.merchantReviewUrl)),
    verifiedAt: text(record.verifiedAt),
    savedAt: text(record.savedAt),
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 300) : "";
}

function safeHttps(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username ? url.href : null;
  } catch { return null; }
}
