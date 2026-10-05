import { associatedTokenAddress } from "../../merchant/ata";
import { CIRCLE_SOLANA_DEVNET_USDC_MINT } from "../../merchant/product";
import { sendSigned } from "../../merchant/rpc";
import { decodeBase58 } from "./base58";
import { readDevnetOrder, requestDevnetCheckout, submitDevnetSignature } from "./devnet-merchant-client";

export function merchantBaseUrl(): string {
  return process.env.DEVNET_MERCHANT_URL ?? "http://127.0.0.1:8787";
}

export async function proxyProduct(): Promise<Response> {
  return proxy("/product");
}

export async function proxyCheckout(buyer: string): Promise<Response> {
  if (decodeBase58(buyer)?.length !== 32) {
    return Response.json({ error: "Connect a Solana wallet before reviewing the checkout." }, { status: 400 });
  }
  try {
    const checkout = await requestDevnetCheckout(merchantBaseUrl(), {
      buyer,
      sourceTokenAccount: associatedTokenAddress(buyer, CIRCLE_SOLANA_DEVNET_USDC_MINT),
      quantity: 1,
    });
    return Response.json(checkout, { status: 201 });
  } catch (error) {
    return merchantError(error, "The devnet merchant did not open a checkout.");
  }
}

export async function proxyConfirm(checkoutId: string, signature: string): Promise<Response> {
  try {
    const result = await submitDevnetSignature(merchantBaseUrl(), checkoutId, signature) as { status: number; body: unknown };
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return merchantError(error, "The devnet merchant did not accept the signature.");
  }
}

export async function proxyOrder(orderId: string): Promise<Response> {
  try {
    const order = await readDevnetOrder(merchantBaseUrl(), orderId);
    if (!order) return Response.json({ error: "The merchant has no order with that id." }, { status: 404 });
    return Response.json(order);
  } catch (error) {
    return merchantError(error, "The devnet merchant order could not be read.");
  }
}

export async function proxyRecover(): Promise<Response> {
  return proxy("/recover", { method: "POST" });
}

export async function proxyPrepareRefund(orderId: string): Promise<Response> {
  return proxy(`/orders/${encodeURIComponent(orderId)}/refund-transaction`, { method: "POST" });
}

export async function proxySubmitRefund(orderId: string, signedTransaction: string): Promise<Response> {
  if (signedTransaction.length < 80 || signedTransaction.length > 1800 || !/^[A-Za-z0-9+/]+={0,2}$/.test(signedTransaction)) {
    return Response.json({ error: "Invalid signed transaction." }, { status: 400 });
  }
  return proxy(`/orders/${encodeURIComponent(orderId)}/refund-submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ signedTransaction }),
  }, 45_000);
}

export async function proxyBroadcast(signedTransaction: string): Promise<Response> {
  const raw = bytesFromBase64(signedTransaction);
  if (!raw || raw[0] !== 1 || raw.length < 66) {
    return Response.json({ error: "The signed devnet payment is not a legacy transaction." }, { status: 400 });
  }
  try {
    const signature = await sendSigned(raw);
    return Response.json({ signature, network: "solana:devnet" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Devnet rejected the signed payment." }, { status: 400 });
  }
}

async function proxy(path: string, init?: RequestInit, timeoutMs = 20_000): Promise<Response> {
  try {
    const response = await fetch(new URL(path, merchantBaseUrl()), { ...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    return Response.json(await response.json() as unknown, { status: response.status });
  } catch (error) {
    return merchantError(error, "The local devnet merchant is not running.");
  }
}

function merchantError(error: unknown, fallback: string): Response {
  const message = error instanceof Error ? error.message : fallback;
  const down = /fetch failed|ECONNREFUSED|not running|timeout/i.test(message);
  return Response.json({ error: down ? "The local devnet merchant is not running." : message }, { status: down ? 503 : 400 });
}

function bytesFromBase64(value: string): Uint8Array | null {
  try {
    return Uint8Array.from(Buffer.from(value, "base64"));
  } catch {
    return null;
  }
}
