import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { postedProduct, type ConfirmResult, type DevnetMerchant } from "./service";

export async function listen(merchant: DevnetMerchant, port = 0): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    void handle(merchant, request, response);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function handle(merchant: DevnetMerchant, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/product") {
      send(response, 200, postedProduct());
      return;
    }
    if (request.method === "POST" && url.pathname === "/checkouts") {
      const body = await readJson(request);
      const checkout = await merchant.createCheckout({
        buyer: stringField(body, "buyer"),
        sourceTokenAccount: stringField(body, "sourceTokenAccount"),
        quantity: numberField(body, "quantity"),
        now: Date.now(),
      });
      send(response, 201, checkout);
      return;
    }
    const confirm = url.pathname.match(/^\/checkouts\/([^/]+)\/confirm$/);
    if (request.method === "POST" && confirm) {
      const body = await readJson(request);
      const result = await merchant.confirm(decodeURIComponent(confirm[1]!), stringField(body, "signature"), Date.now());
      send(response, statusFor(result), result);
      return;
    }
    const order = url.pathname.match(/^\/orders\/([^/]+)$/);
    if (request.method === "GET" && order) {
      const found = merchant.getOrder(decodeURIComponent(order[1]!));
      send(response, found ? 200 : 404, found ?? { error: "Order not found." });
      return;
    }
    const prepareRefund = url.pathname.match(/^\/orders\/([^/]+)\/refund-transaction$/);
    if (request.method === "POST" && prepareRefund) {
      send(response, 200, await merchant.prepareRefund(decodeURIComponent(prepareRefund[1]!)));
      return;
    }
    const submitRefund = url.pathname.match(/^\/orders\/([^/]+)\/refund-submit$/);
    if (request.method === "POST" && submitRefund) {
      const body = await readJson(request);
      send(response, 200, await merchant.submitSignedRefund(decodeURIComponent(submitRefund[1]!), signedTransactionField(body)));
      return;
    }
    const refund = url.pathname.match(/^\/orders\/([^/]+)\/refund$/);
    if (request.method === "POST" && refund) {
      const body = await readJson(request);
      send(response, 200, await merchant.refund(decodeURIComponent(refund[1]!), stringField(body, "signature")));
      return;
    }
    if (request.method === "POST" && url.pathname === "/recover") {
      send(response, 200, { orders: merchant.recover() });
      return;
    }
    send(response, 404, { error: "Not found." });
  } catch (error) {
    send(response, 400, { error: error instanceof Error ? error.message : "Request failed." });
  }
}

function statusFor(result: ConfirmResult): number {
  if (result.kind === "order") return 200;
  if (result.kind === "pending" || result.kind === "payment_recorded") return 202;
  return 409;
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
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
