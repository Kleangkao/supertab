export type CommerceSource = "shopify" | "ebay";
export type PriceBasis = "catalog" | "listing";
export type Availability = "in_stock" | "out_of_stock" | "unknown";

export type CheckoutCapability =
  | { kind: "unavailable"; reason: string }
  | { kind: "merchant_cart_link"; url: string; nativeCheckout: boolean };

export interface OfferPrice {
  amountMinor: bigint;
  currency: string;
  exponent: number;
  basis: PriceBasis;
}

export interface ShippingInfo {
  summary: string | null;
  costMinor: bigint | null;
  currency: string | null;
}

export interface NormalizedOffer {
  id: string;
  source: CommerceSource;
  sourceItemId: string;
  merchant: string | null;
  title: string;
  descriptionSummary: string | null;
  imageUrl: string | null;
  price: OfferPrice | null;
  availability: Availability;
  variantLabel: string | null;
  options: { name: string; value: string }[];
  condition: string | null;
  /** Null means shipping was not provided. A present object may still have unknown cost. */
  shipping: ShippingInfo | null;
  productUrl: string | null;
  checkout: CheckoutCapability;
  providerMetadata: Record<string, string | number | boolean | null>;
  verifiedAt: string;
}

export interface PayableSnapshot {
  itemMinor: bigint | null;
  itemCurrency: string | null;
  itemExponent: number;
  itemBasis: PriceBasis | null;
  quantity: number;
  lineMinor: bigint | null;
  shippingMinor: bigint | null;
  shippingCurrency: string | null;
  taxMinor: bigint | null;
  discountMinor: bigint | null;
  merchantTotalMinor: bigint | null;
  merchantTotalKnown: boolean;
  currency: string | null;
  note: string;
}

export function offerId(source: CommerceSource, sourceItemId: string): string {
  return `${source}:${sourceItemId}`;
}

export function summarizeText(value: string | null | undefined, max = 180): string | null {
  if (!value) return null;
  const collapsed = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  return collapsed.length > max ? `${collapsed.slice(0, max - 1).trim()}…` : collapsed;
}

export function payableFromOffer(offer: NormalizedOffer, quantity: number): PayableSnapshot {
  const safeQuantity = Number.isInteger(quantity) && quantity > 0 && quantity <= 20 ? quantity : 1;
  const price = offer.price;
  const itemMinor = price?.amountMinor ?? null;
  const lineMinor = itemMinor == null ? null : itemMinor * BigInt(safeQuantity);
  const shippingKnown = offer.shipping?.costMinor != null;
  const shippingMinor = shippingKnown ? offer.shipping!.costMinor : null;
  const sameCurrency = !offer.shipping?.currency || !price?.currency || offer.shipping.currency === price.currency;
  const merchantTotalKnown = false;
  return {
    itemMinor,
    itemCurrency: price?.currency ?? null,
    itemExponent: price?.exponent ?? 2,
    itemBasis: price?.basis ?? null,
    quantity: safeQuantity,
    lineMinor,
    shippingMinor: sameCurrency ? shippingMinor : null,
    shippingCurrency: offer.shipping?.currency ?? null,
    taxMinor: null,
    discountMinor: null,
    merchantTotalMinor: null,
    merchantTotalKnown,
    currency: price?.currency ?? null,
    note: merchantTotalNote(price?.basis ?? null, shippingKnown),
  };
}

function merchantTotalNote(basis: PriceBasis | null, shippingKnown: boolean): string {
  if (!basis) return "No price was returned for this offer.";
  const priceLabel = basis === "catalog" ? "catalog price" : "listing price";
  if (!shippingKnown) {
    return `This is the ${priceLabel}. Shipping and tax were not provided, so this is not the merchant checkout total.`;
  }
  return `Item price and a shipping figure are known. Tax was not provided, so the merchant checkout total is still unknown.`;
}

export function planningMinor(snapshot: PayableSnapshot): bigint | null {
  if (snapshot.merchantTotalKnown && snapshot.merchantTotalMinor != null) return snapshot.merchantTotalMinor;
  if (snapshot.lineMinor == null) return null;
  if (snapshot.currency !== "USD") return null;
  const shipping = snapshot.shippingMinor ?? 0n;
  const discount = snapshot.discountMinor ?? 0n;
  return snapshot.lineMinor + shipping - discount;
}
