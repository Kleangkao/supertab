export interface DevnetCheckout {
  id: string;
  productId: string;
  productName: string;
  label: string;
  quantity: number;
  itemMinor: string;
  shippingMinor: string;
  taxMinor: string;
  totalMinor: string;
  mint: string;
  mintIssuer: "Circle";
  decimals: number;
  network: "solana:devnet";
  buyer: string;
  recipient: string;
  reference: string;
  expiresAt: string;
  transaction: string;
  separation: string;
}

export interface DevnetMerchantOrder {
  id: string;
  checkoutId: string;
  productId: string;
  buyer: string;
  totalMinor: string;
  mint: string;
  paymentSignature: string;
  settlement: "on_time" | "late";
  status: "paid" | "refunded";
  refundSignature: string | null;
  separation: string;
}

/** Asks the merchant for a checkout. This client cannot create the merchant's order. */
export async function requestDevnetCheckout(baseUrl: string, input: {
  buyer: string;
  sourceTokenAccount: string;
  quantity: number;
}, fetchImpl: typeof fetch = fetch): Promise<DevnetCheckout> {
  const response = await fetchImpl(new URL("/checkouts", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (response.status !== 201) {
    const failure = await response.json().catch(() => null) as { error?: unknown } | null;
    const message = typeof failure?.error === "string" ? failure.error : "";
    if (/rate limit|too many requests|429/i.test(message)) {
      throw new Error("Solana devnet is rate limiting checkout requests. No payment was sent. Wait a minute, then review again. A dedicated devnet endpoint belongs in SOLANA_DEVNET_RPC_URL. Mainnet SOLANA_RPC_URL is not used.");
    }
    if (/returned Solana mainnet|returned Solana testnet|not Solana devnet/i.test(message)) {
      throw new Error("Devnet checkout refused the RPC because it is not Solana devnet. No payment was sent.");
    }
    throw new Error("The devnet merchant did not open a checkout.");
  }
  return response.json() as Promise<DevnetCheckout>;
}

/** Submits a chain signature. The merchant, not this client, decides whether an order exists. */
export async function submitDevnetSignature(baseUrl: string, checkoutId: string, signature: string, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const response = await fetchImpl(new URL(`/checkouts/${encodeURIComponent(checkoutId)}/confirm`, baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ signature }),
  });
  return { status: response.status, body: await response.json() as unknown };
}

/** Reads an order from the merchant. A missing order is not rewritten as confirmed. */
export async function readDevnetOrder(baseUrl: string, orderId: string, fetchImpl: typeof fetch = fetch): Promise<DevnetMerchantOrder | null> {
  const response = await fetchImpl(new URL(`/orders/${encodeURIComponent(orderId)}`, baseUrl));
  if (response.status === 404) return null;
  if (response.status !== 200) throw new Error("The devnet merchant order could not be read.");
  return response.json() as Promise<DevnetMerchantOrder>;
}
