import { postedProduct, type ConfirmResult, type DevnetMerchant } from "./service";

export async function dispatchMerchant(
  merchant: DevnetMerchant,
  method: string,
  pathname: string,
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  if (method === "GET" && pathname === "/product") return { status: 200, body: postedProduct() };
  if (method === "POST" && pathname === "/checkouts") {
    const checkout = await merchant.createCheckout({
      buyer: stringField(body, "buyer"),
      sourceTokenAccount: stringField(body, "sourceTokenAccount"),
      quantity: numberField(body, "quantity"),
      now: Date.now(),
    });
    return { status: 201, body: checkout };
  }
  const confirm = pathname.match(/^\/checkouts\/([^/]+)\/confirm$/);
  if (method === "POST" && confirm) {
    const result = await merchant.confirm(decodeURIComponent(confirm[1]!), stringField(body, "signature"), Date.now());
    return { status: statusFor(result), body: result };
  }
  const order = pathname.match(/^\/orders\/([^/]+)$/);
  if (method === "GET" && order) {
    const found = merchant.getOrder(decodeURIComponent(order[1]!));
    return { status: found ? 200 : 404, body: found ?? { error: "Order not found." } };
  }
  const prepareRefund = pathname.match(/^\/orders\/([^/]+)\/refund-transaction$/);
  if (method === "POST" && prepareRefund) {
    return { status: 200, body: await merchant.prepareRefund(decodeURIComponent(prepareRefund[1]!)) };
  }
  const submitRefund = pathname.match(/^\/orders\/([^/]+)\/refund-submit$/);
  if (method === "POST" && submitRefund) {
    return { status: 200, body: await merchant.submitSignedRefund(decodeURIComponent(submitRefund[1]!), signedTransactionField(body)) };
  }
  const refund = pathname.match(/^\/orders\/([^/]+)\/refund$/);
  if (method === "POST" && refund) {
    return { status: 200, body: await merchant.refund(decodeURIComponent(refund[1]!), stringField(body, "signature")) };
  }
  if (method === "POST" && pathname === "/recover") return { status: 200, body: { orders: merchant.recover() } };
  return { status: 404, body: { error: "Not found." } };
}

function statusFor(result: ConfirmResult): number {
  if (result.kind === "order") return 200;
  if (result.kind === "pending" || result.kind === "payment_recorded") return 202;
  return 409;
}

function signedTransactionField(body: unknown): string {
  if (!body || typeof body !== "object" || !("signedTransaction" in body)) throw new Error("Missing signed transaction.");
  const value = (body as { signedTransaction?: unknown }).signedTransaction;
  if (typeof value !== "string" || value.length < 80 || value.length > 1800 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("Invalid signed transaction.");
  }
  return value;
}

function stringField(body: unknown, key: string): string {
  if (!body || typeof body !== "object" || !(key in body)) throw new Error(`Missing ${key}.`);
  const value = (body as Record<string, unknown>)[key];
  if (typeof value !== "string" || value.length === 0 || value.length > 200) throw new Error(`Invalid ${key}.`);
  return value;
}

function numberField(body: unknown, key: string): number {
  if (!body || typeof body !== "object" || !(key in body)) throw new Error(`Missing ${key}.`);
  const value = (body as Record<string, unknown>)[key];
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(`Invalid ${key}.`);
  return value;
}
