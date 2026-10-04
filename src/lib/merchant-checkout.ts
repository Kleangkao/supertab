import type { AppConfig } from "./config";
import { merchantReviewUrl, payableFromOffer, type NormalizedOffer, type PayableSnapshot } from "./offers";
import { publicBuyerIp } from "./buyer-context";

// Pricing uses get_checkout or create_checkout. Never update payment, never
// complete_checkout, and never place an order from this module.
// https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp
// https://ucp.dev/specification/shopping/checkout/
export const CHECKOUT_FRESHNESS_MS = 5 * 60_000;
export interface CheckoutEvidence {
  merchantOrigin: string;
  verifiedAtMs: number;
  expiresAtMs: number;
  authority: "merchant_stated" | "merchant_calculated" | "merchant_ready";
  statement: MerchantStatement | null;
  snapshot: PayableSnapshot;
}

/** Merchant-returned amounts. Unreconciled or non-USD statements do not fund the plan. */
export interface MerchantStatement {
  status: string;
  currency: string;
  subtotalMinor: bigint;
  shippingMinor: bigint | null;
  taxMinor: bigint | null;
  dutyMinor: bigint | null;
  feeMinor: bigint | null;
  discountMinor: bigint | null;
  statedTotalMinor: bigint;
  /** Stated total minus the returned components. Zero when the breakdown matches. */
  gapMinor: bigint;
  reconciled: boolean;
  deliveryMethod: string | null;
  missingCodes: string[];
}

export interface MerchantDestination {
  email: string;
  firstName: string;
  lastName: string;
  streetAddress: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  discountCode?: string;
  line2?: string;
}

export function checkoutOrigin(offer: NormalizedOffer): string | null {
  const url = merchantReviewUrl(offer.checkout.kind === "merchant_cart_link" ? offer.checkout.url : offer.productUrl);
  return url ? new URL(url).origin : null;
}

export function checkoutAccess(offer: NormalizedOffer, config: AppConfig): { available: boolean; message: string } {
  if (offer.source !== "shopify") return { available: false, message: "eBay checkout requires separate Order API access. Listing search cannot verify the payable total." };
  const origin = checkoutOrigin(offer);
  if (!(config.shopifyCheckoutToken || (config.shopifyClientId && config.shopifyClientSecret)) || !origin || !config.shopifyCheckoutOrigins.includes(origin)) {
    return { available: false, message: "Final-total verification needs merchant checkout access. Review shipping and tax at the merchant; SuperTab still uses a planning amount." };
  }
  return { available: true, message: "Enter a real delivery destination. The merchant calculates shipping, tax and discounts. A total that can still change is not approved. Only a current, ready checkout for this exact product and quantity can verify the final total." };
}

export async function readMerchantCheckout(input: {
  offer: NormalizedOffer; quantity: number; checkoutId: string; config: AppConfig;
  nowMs: number; fetchImpl?: typeof fetch;
  buyerIp?: string | null;
}): Promise<CheckoutEvidence> {
  const access = checkoutAccess(input.offer, input.config);
  if (!access.available) throw new Error(access.message);
  const buyerIp = publicBuyerIp(input.buyerIp);
  if (!buyerIp) throw new Error("Merchant checkout reading needs trusted buyer network context. Configure it for this local PC or a trusted deployment proxy. Your final total remains unverified.");
  if (!input.checkoutId.startsWith("gid://shopify/Checkout/") || input.checkoutId.length > 2048 || /[\r\n]/.test(input.checkoutId)) {
    throw new Error("Enter the merchant-provided Shopify checkout ID. A cart ID or product URL is not a final checkout.");
  }
  const origin = checkoutOrigin(input.offer)!;
  // Credentials go only to explicitly configured merchant origins. Redirects
  // must not forward the token to another host or return unrelated evidence.
  let response: Response;
  try {
    const token = await checkoutToken(input.config, input.fetchImpl ?? fetch);
    response = await (input.fetchImpl ?? fetch)(`${origin}/api/ucp/mcp`, {
      method: "POST", redirect: "error", cache: "no-store",
      headers: { "Content-Type": "application/json", accept: "application/json, text/event-stream",
        authorization: `Bearer ${token}`, "Shopify-Buyer-IP": buyerIp },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
        name: "get_checkout", arguments: { id: input.checkoutId,
          meta: { "ucp-agent": { profile: input.config.shopifyProfile } } },
      } }), signal: AbortSignal.timeout(12_000),
    });
  } catch { throw new Error("The merchant checkout could not be reached. Your final total remains unverified."); }
  if (!response.ok) throw new Error(`Merchant checkout access failed (${response.status}). Your final total remains unverified.`);
  const text = await response.text();
  let payload: unknown;
  try {
    const json = text.trim().startsWith("{") ? text : text.split("\n")
      .filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).filter(line => line !== "[DONE]").at(-1);
    payload = JSON.parse(json ?? "");
  } catch { throw new Error("The merchant returned an unreadable checkout."); }
  const root = record(payload);
  const result = record(root?.result);
  if (root?.error) throw new Error("The merchant could not read this checkout. No final total was accepted.");
  const checkout = checkoutDocument(result);
  // Shopify can mark an existing incomplete document as a tool error. Explain
  // that state, but never use an error result to establish a payable amount.
  if (result?.isError) {
    if (checkout?.id === input.checkoutId && checkout.status === "incomplete") {
      throw new Error("The merchant checkout is not ready. Finish the required delivery and buyer details at the merchant, then verify again.");
    }
    throw new Error("The merchant could not read this checkout. No final total was accepted.");
  }
  return verifyCheckout(checkout, {
    offer: input.offer, quantity: input.quantity, checkoutId: input.checkoutId, merchantOrigin: origin, nowMs: input.nowMs,
  });
}

function checkoutDocument(result: Record<string, unknown> | null): Record<string, unknown> | null {
  // Both MCP representations come from the authenticated server response.
  // Prefer structured content; never replace it with a conflicting text block.
  if (result?.structuredContent !== undefined) return record(result.structuredContent);
  if (!Array.isArray(result?.content)) return null;
  for (const raw of result.content) {
    const block = record(raw);
    if (block?.type !== "text" || typeof block.text !== "string") continue;
    try { const parsed = record(JSON.parse(block.text)); if (parsed) return parsed; } catch { /* Ignore opaque text. */ }
  }
  return null;
}

async function checkoutToken(config: AppConfig, fetchImpl: typeof fetch): Promise<string> {
  if (config.shopifyCheckoutToken) return config.shopifyCheckoutToken;
  const response = await fetchImpl("https://api.shopify.com/auth/access_token", {
    method: "POST", redirect: "error", cache: "no-store", headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: config.shopifyClientId, client_secret: config.shopifyClientSecret,
      grant_type: "client_credentials" }), signal: AbortSignal.timeout(12_000),
  });
  const payload = record(await response.json());
  if (!response.ok || typeof payload?.access_token !== "string" || !payload.access_token) throw new Error("Merchant checkout authentication failed.");
  return payload.access_token;
}

/** Buyer-supplied delivery context. Nothing here is invented or retained in the session view. */
export function merchantDestination(value: unknown): MerchantDestination {
  const input = record(value);
  if (!input) throw new Error("Enter the delivery details the merchant needs before it can calculate shipping and tax.");
  const email = String(input.email ?? "").trim();
  const country = String(input.country ?? "").trim().toUpperCase();
  const discountCode = String(input.discountCode ?? "").trim();
  const destination: MerchantDestination = {
    email,
    firstName: String(input.firstName ?? "").trim(),
    lastName: String(input.lastName ?? "").trim(),
    streetAddress: String(input.streetAddress ?? "").trim(),
    city: String(input.city ?? "").trim(),
    region: String(input.region ?? "").trim(),
    postalCode: String(input.postalCode ?? "").trim(),
    country,
  };
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) throw new Error("Enter the email address the merchant should use for this checkout.");
  if (!/^[A-Z]{2}$/.test(country)) throw new Error("Enter the two-letter country code for delivery.");
  const line2 = String(input.line2 ?? "").trim();
  if (line2) {
    if (line2.length > 120 || /[\r\n\u0000]/.test(line2)) throw new Error("Enter a shorter second address line.");
    destination.line2 = line2;
  }
  for (const [label, field] of [["first name", destination.firstName], ["last name", destination.lastName], ["city", destination.city], ["region", destination.region]] as const) {
    if (field && (!/^[\s\S]{1,80}$/.test(field) || /[\r\n\u0000]/.test(field))) throw new Error(`Enter a ${label} for delivery.`);
  }
  if (destination.streetAddress.length < 1 || destination.streetAddress.length > 200 || /[\r\n\u0000]/.test(destination.streetAddress)) {
    throw new Error("Enter a street address for delivery.");
  }
  if (destination.postalCode.length < 1 || destination.postalCode.length > 20 || /[\s]{2}|[\r\n\u0000]/.test(destination.postalCode) || !/^[\w .+-]{1,20}$/.test(destination.postalCode)) {
    throw new Error("Enter a postal code for delivery.");
  }
  if (discountCode) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(discountCode)) throw new Error("A discount code may contain only letters, numbers, hyphens and underscores. Leave it blank if you do not have one.");
    destination.discountCode = discountCode;
  }
  return destination;
}

/**
 * Ask the merchant to price the selected variant for a real destination.
 * create_checkout does not submit payment or place an order.
 */
export async function prepareMerchantCheckout(input: {
  offer: NormalizedOffer; quantity: number; destination: unknown; config: AppConfig;
  nowMs: number; fetchImpl?: typeof fetch; buyerIp?: string | null;
}): Promise<CheckoutEvidence> {
  const access = checkoutAccess(input.offer, input.config);
  if (!access.available) throw new Error(access.message);
  const buyerIp = publicBuyerIp(input.buyerIp);
  if (!buyerIp) throw new Error("Merchant checkout reading needs trusted buyer network context. Configure it for this local PC or a trusted deployment proxy. Your final total remains unverified.");
  const destination = merchantDestination(input.destination);
  const origin = checkoutOrigin(input.offer)!;
  let response: Response;
  try {
    const token = await checkoutToken(input.config, input.fetchImpl ?? fetch);
    response = await (input.fetchImpl ?? fetch)(`${origin}/api/ucp/mcp`, {
      method: "POST", redirect: "error", cache: "no-store",
      headers: { "Content-Type": "application/json", accept: "application/json, text/event-stream",
        authorization: `Bearer ${token}`, "Shopify-Buyer-IP": buyerIp },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
        name: "create_checkout", arguments: {
          checkout: checkoutRequest(input.offer, input.quantity, destination),
          meta: { "ucp-agent": { profile: input.config.shopifyProfile } },
        },
      } }), signal: AbortSignal.timeout(12_000),
    });
  } catch { throw new Error("The merchant checkout could not be reached. No payable amount was accepted, and no payment was submitted."); }
  if (!response.ok) throw new Error(`Merchant checkout access failed (${response.status}). No payable amount was accepted, and no payment was submitted.`);
  const payload = await checkoutPayload(response);
  const root = record(payload);
  const result = record(root?.result);
  if (root?.error || result?.isError) throw new Error("The merchant could not price this destination. No payable amount was accepted, and no payment was submitted.");
  return classifyCreatedCheckout(checkoutDocument(result), {
    offer: input.offer, quantity: input.quantity, merchantOrigin: origin, nowMs: input.nowMs,
  });
}

function checkoutRequest(offer: NormalizedOffer, quantity: number, destination: MerchantDestination): Record<string, unknown> {
  const address: Record<string, string> = {
    street_address: destination.streetAddress, address_locality: destination.city,
    address_region: destination.region, postal_code: destination.postalCode, address_country: destination.country,
  };
  if (destination.firstName) address.first_name = destination.firstName;
  if (destination.lastName) address.last_name = destination.lastName;
  if (destination.line2) address.extended_address = destination.line2;
  return {
    currency: "USD",
    line_items: [{ quantity, item: { id: offer.sourceItemId } }],
    ...(destination.email ? { buyer: { email: destination.email, ...(destination.firstName ? { first_name: destination.firstName } : {}), ...(destination.lastName ? { last_name: destination.lastName } : {}) } } : {}),
    fulfillment: { methods: [{ type: "shipping", destinations: [address] }] },
    ...(destination.discountCode ? { discounts: { codes: [destination.discountCode] } } : {}),
  };
}

/** Only called on the authenticated server response, never on client JSON. */
export function verifyCheckout(checkout: Record<string, unknown> | null, input: {
  offer: NormalizedOffer; quantity: number; checkoutId: string; merchantOrigin: string; nowMs: number;
}): CheckoutEvidence {
  if (!checkout || checkout.id !== input.checkoutId) throw new Error("The merchant returned a different checkout.");
  const parsed = checkoutSnapshot(checkout, input);
  if (parsed.currency !== "USD") throw new Error("Only USD checkout totals can currently be funded with USDC.");
  if (!parsed.reconciled) throw new Error("The merchant total does not match its price breakdown.");
  if (parsed.status !== "ready_for_complete") throw new Error("The merchant checkout is not ready. Finish the required delivery and buyer details at the merchant, then verify again.");
  if (parsed.blocked) throw new Error("The merchant still requires buyer input or review. This total cannot be approved yet.");
  if (parsed.provisionalDiscount) throw new Error("A merchant discount is still provisional, so this total cannot be approved yet.");
  return evidenceFrom(parsed, input, "merchant_ready", "Final total read from the authorized merchant checkout. No payment or order was submitted.");
}

/** Pricing result from create_checkout. A calculated total is not an approval. */
export function classifyCreatedCheckout(checkout: Record<string, unknown> | null, input: {
  offer: NormalizedOffer; quantity: number; merchantOrigin: string; nowMs: number;
}): CheckoutEvidence {
  if (!checkout || typeof checkout.id !== "string" || !checkout.id.startsWith("gid://shopify/Checkout/")) {
    throw new Error("The merchant did not return a checkout. No payable amount was accepted, and no payment was submitted.");
  }
  const parsed = checkoutSnapshot(checkout, input);
  const statement = merchantStatement(checkout, parsed);
  if (parsed.currency === "USD" && parsed.reconciled && parsed.status === "ready_for_complete" && !parsed.blocked && !parsed.provisionalDiscount) {
    return { ...evidenceFrom(parsed, input, "merchant_ready", "Final total read from the authorized merchant checkout. No payment or order was submitted."), statement };
  }
  const priceable = (parsed.status === "incomplete" || parsed.status === "requires_escalation" || parsed.status === "ready_for_complete")
    && parsed.hasFulfillment && parsed.hasTax && parsed.currency === "USD" && parsed.reconciled && !parsed.hasError;
  if (!priceable && statement && (statement.shippingMinor != null || statement.taxMinor != null || statement.dutyMinor != null)) {
    const catalog = payableFromOffer(input.offer, input.quantity);
    const note = statement.reconciled
      ? `The merchant calculated this checkout in ${statement.currency}. It is not a USD funding amount, it can still change, and no payment was submitted.`
      : `The merchant stated a ${statement.currency} total, but its shipping, tax, duty and subtotal do not add up to that total. SuperTab is not using it as a funding amount. No payment was submitted.`;
    return {
      merchantOrigin: input.merchantOrigin, verifiedAtMs: input.nowMs,
      expiresAtMs: Math.min(parsed.expiresAtMs, input.nowMs + CHECKOUT_FRESHNESS_MS),
      authority: "merchant_stated", statement,
      snapshot: { ...catalog, payableAuthority: "merchant_stated", note },
    };
  }
  if (!priceable) {
    const codes = publicCodes(checkout);
    throw new Error(parsed.status === "incomplete" || parsed.status === "requires_escalation"
      ? `The merchant has not calculated shipping and tax for this destination. No payable amount was accepted, and no payment was submitted.${codes}`
      : "The merchant checkout is not ready. Finish the required delivery and buyer details at the merchant, then verify again.");
  }
  const note = parsed.provisionalDiscount
    ? "Merchant-calculated total, including a provisional discount that can still be removed. This can change before payment and cannot be approved yet. No payment was submitted."
    : "Merchant-calculated total for this destination, including the shipping, tax and discounts the merchant returned. It can still change before payment and cannot be approved yet. No payment was submitted.";
  return { ...evidenceFrom(parsed, input, "merchant_calculated", note), statement };
}

function publicCodes(checkout: Record<string, unknown>): string {
  if (!Array.isArray(checkout.messages)) return "";
  const codes = [...new Set(checkout.messages.map(message => String(record(message)?.code ?? "")).filter(code => /^[a-z0-9_]{1,80}$/.test(code)))];
  return codes.length ? ` Merchant reported: ${codes.join(", ")}.` : "";
}

function evidenceFrom(parsed: ParsedCheckout, input: { merchantOrigin: string; nowMs: number }, authority: CheckoutEvidence["authority"], note: string): CheckoutEvidence {
  return {
    merchantOrigin: input.merchantOrigin, verifiedAtMs: input.nowMs,
    expiresAtMs: Math.min(parsed.expiresAtMs, input.nowMs + CHECKOUT_FRESHNESS_MS),
    authority, statement: null,
    snapshot: { ...parsed.snapshot, merchantTotalKnown: authority === "merchant_ready", payableAuthority: authority, note },
  };
}

function merchantStatement(checkout: Record<string, unknown>, parsed: ParsedCheckout): MerchantStatement | null {
  const amounts = parsed.amounts;
  const total = amounts.get("total");
  if (!parsed.currency || total == null) return null;
  const components = [...amounts].filter(([kind]) => kind !== "total").reduce((sum, [, amount]) => sum + amount, 0n);
  let deliveryMethod: string | null = null;
  const methods = record(checkout.fulfillment)?.methods;
  if (Array.isArray(methods)) {
    for (const method of methods) {
      const groups = record(method)?.groups;
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        const selected = String(record(group)?.selected_option_id ?? "");
        const options = record(group)?.options;
        if (!Array.isArray(options)) continue;
        for (const option of options) {
          const title = String(record(option)?.title ?? "");
          if (title && String(record(option)?.id ?? "") === selected) deliveryMethod = title;
        }
      }
    }
  }
  return {
    status: parsed.status, currency: parsed.currency, subtotalMinor: amounts.get("subtotal") ?? 0n,
    shippingMinor: amounts.has("fulfillment") ? amounts.get("fulfillment")! : null,
    taxMinor: amounts.has("tax") ? amounts.get("tax")! : null,
    dutyMinor: amounts.has("duty") ? amounts.get("duty")! : null,
    feeMinor: amounts.has("fee") ? amounts.get("fee")! : null,
    discountMinor: amounts.has("items_discount") || amounts.has("discount") ? -(amounts.get("items_discount") ?? 0n) - (amounts.get("discount") ?? 0n) : null,
    statedTotalMinor: total, gapMinor: total - components, reconciled: components === total, deliveryMethod,
    missingCodes: codeList(checkout),
  };
}

function codeList(checkout: Record<string, unknown>): string[] {
  if (!Array.isArray(checkout.messages)) return [];
  return [...new Set(checkout.messages.map(message => String(record(message)?.code ?? "")).filter(code => /^[a-z0-9_]{1,80}$/.test(code)))];
}

interface ParsedCheckout {
  status: string;
  currency: string;
  expiresAtMs: number;
  hasFulfillment: boolean;
  hasTax: boolean;
  reconciled: boolean;
  amounts: Map<string, bigint>;
  blocked: boolean;
  hasError: boolean;
  provisionalDiscount: boolean;
  snapshot: PayableSnapshot;
}

function checkoutSnapshot(checkout: Record<string, unknown>, input: {
  offer: NormalizedOffer; quantity: number; nowMs: number;
}): ParsedCheckout {
  if (typeof checkout.currency !== "string" || !/^[A-Z]{3}$/.test(checkout.currency)) throw new Error("The merchant did not return a currency.");
  const messages = Array.isArray(checkout.messages) ? checkout.messages : [];
  const blocked = messages.some(message => {
    const entry = record(message);
    return entry?.type === "error" || ["recoverable", "requires_buyer_input", "requires_buyer_review"].includes(String(entry?.severity));
  });
  const hasError = messages.some(message => record(message)?.type === "error");
  const expires = typeof checkout.expires_at === "string" ? Date.parse(checkout.expires_at) : NaN;
  if (!Number.isFinite(expires) || expires <= input.nowMs) throw new Error("This merchant checkout expired. Retrieve a current checkout.");
  const lines = checkout.line_items;
  if (!Array.isArray(lines) || lines.length !== 1) throw new Error("The checkout must contain only the selected product.");
  const line = record(lines[0]);
  const item = record(line?.item);
  if (item?.id !== input.offer.sourceItemId || line?.quantity !== input.quantity) throw new Error("The checkout product, variant or quantity does not match your selection.");
  const price = minor(item?.price, false);
  const lineTotals = totals(line?.totals);
  if (lineTotals.get("subtotal") !== price * BigInt(input.quantity)) throw new Error("The checkout line amount does not match its price and quantity.");
  if ([...lineTotals].filter(([kind]) => kind !== "total").reduce((sum, [, amount]) => sum + amount, 0n) !== lineTotals.get("total")) {
    throw new Error("The merchant line total does not match its amount breakdown.");
  }
  const amounts = totals(checkout.totals);
  if (amounts.get("subtotal") !== lineTotals.get("subtotal")) throw new Error("The checkout subtotal does not match the selected product.");
  const total = amounts.get("total");
  if (total == null || total <= 0n) throw new Error("The merchant did not supply a positive payable total.");
  const sum = [...amounts].filter(([kind]) => kind !== "total").reduce((value, [, amount]) => value + amount, 0n);
  const discounts = record(checkout.discounts);
  const provisionalDiscount = Array.isArray(discounts?.applied) && discounts.applied.some(entry => record(entry)?.provisional === true);
  const snapshot = payableFromOffer(input.offer, input.quantity);
  return {
    status: String(checkout.status), currency: checkout.currency, expiresAtMs: expires, hasFulfillment: amounts.has("fulfillment"), hasTax: amounts.has("tax"),
    reconciled: sum === total, amounts,
    blocked, hasError, provisionalDiscount,
    snapshot: { ...snapshot, itemMinor: price, lineMinor: price * BigInt(input.quantity),
      shippingMinor: amounts.get("fulfillment") ?? null, shippingCurrency: amounts.has("fulfillment") ? "USD" : null,
      taxMinor: amounts.get("tax") ?? null,
      feeMinor: amounts.get("fee") ?? null,
      discountMinor: amounts.has("items_discount") || amounts.has("discount")
        ? -(amounts.get("items_discount") ?? 0n) - (amounts.get("discount") ?? 0n) : null,
      merchantTotalMinor: total, currency: "USD" },
  };
}

async function checkoutPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    const json = text.trim().startsWith("{") ? text : text.split("\n")
      .filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).filter(line => line !== "[DONE]").at(-1);
    return JSON.parse(json ?? "");
  } catch { throw new Error("The merchant returned an unreadable checkout."); }
}

function totals(value: unknown): Map<string, bigint> {
  if (!Array.isArray(value) || value.length > 20) throw new Error("The merchant did not return a usable price breakdown.");
  const output = new Map<string, bigint>();
  for (const raw of value) {
    const entry = record(raw);
    const kind = String(entry?.type);
    if (!["subtotal", "items_discount", "discount", "fulfillment", "tax", "duty", "fee", "total"].includes(kind) || output.has(kind)) {
      throw new Error("This checkout uses an unsupported or duplicate amount component.");
    }
    const subtractive = kind === "discount" || kind === "items_discount";
    const amount = minor(entry?.amount, subtractive);
    if (subtractive && amount > 0n) throw new Error("The merchant discount has an invalid sign.");
    output.set(kind, amount);
  }
  if (!output.has("subtotal") || !output.has("total")) throw new Error("The merchant did not supply a subtotal and total.");
  return output;
}

function minor(value: unknown, negative: boolean): bigint {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || (!negative && value < 0)) throw new Error("The merchant returned an invalid monetary amount.");
  return BigInt(value);
}
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
