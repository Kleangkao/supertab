import type { AppConfig } from "./config";
import { merchantReviewUrl, payableFromOffer, type NormalizedOffer, type PayableSnapshot } from "./offers";
import { publicBuyerIp } from "./buyer-context";

// get_checkout only. Never create, update or complete a merchant checkout here.
// https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp
// https://ucp.dev/specification/shopping/checkout/
export const CHECKOUT_FRESHNESS_MS = 5 * 60_000;
export interface CheckoutEvidence {
  merchantOrigin: string;
  verifiedAtMs: number;
  expiresAtMs: number;
  snapshot: PayableSnapshot;
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
  return { available: true, message: "Checkout reading is configured. The merchant must accept authentication and buyer context. Only a current, ready checkout for this exact product and quantity can verify the final total." };
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

/** Only called on the authenticated server response, never on client JSON. */
export function verifyCheckout(checkout: Record<string, unknown> | null, input: {
  offer: NormalizedOffer; quantity: number; checkoutId: string; merchantOrigin: string; nowMs: number;
}): CheckoutEvidence {
  if (!checkout || checkout.id !== input.checkoutId) throw new Error("The merchant returned a different checkout.");
  if (checkout.status !== "ready_for_complete") throw new Error("The merchant checkout is not ready. Finish the required delivery and buyer details at the merchant, then verify again.");
  if (checkout.currency !== "USD") throw new Error("Only USD checkout totals can currently be funded with USDC.");
  if (Array.isArray(checkout.messages) && checkout.messages.some(message => {
    const entry = record(message);
    return entry?.type === "error" || ["recoverable", "requires_buyer_input", "requires_buyer_review"].includes(String(entry?.severity));
  })) throw new Error("The merchant still requires buyer input or review. This total cannot be approved yet.");
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
  if (sum !== total) throw new Error("The merchant total does not match its price breakdown.");
  const snapshot = payableFromOffer(input.offer, input.quantity);
  return {
    merchantOrigin: input.merchantOrigin, verifiedAtMs: input.nowMs,
    expiresAtMs: Math.min(expires, input.nowMs + CHECKOUT_FRESHNESS_MS),
    snapshot: { ...snapshot, itemMinor: price, lineMinor: price * BigInt(input.quantity),
      shippingMinor: amounts.get("fulfillment") ?? null, shippingCurrency: "USD",
      taxMinor: amounts.get("tax") ?? null,
      feeMinor: amounts.get("fee") ?? null,
      discountMinor: -(amounts.get("items_discount") ?? 0n) - (amounts.get("discount") ?? 0n),
      merchantTotalMinor: total, merchantTotalKnown: true, currency: "USD",
      note: "Final total read from the authorized merchant checkout. No payment or order was submitted." },
  };
}

function totals(value: unknown): Map<string, bigint> {
  if (!Array.isArray(value) || value.length > 20) throw new Error("The merchant did not return a usable price breakdown.");
  const output = new Map<string, bigint>();
  for (const raw of value) {
    const entry = record(raw);
    const kind = String(entry?.type);
    if (!["subtotal", "items_discount", "discount", "fulfillment", "tax", "fee", "total"].includes(kind) || output.has(kind)) {
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
