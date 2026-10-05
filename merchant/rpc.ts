import type { ChainRpc } from "./execute";
import { transactionBlockhash } from "../src/lib/payment-message";

/** Public devnet endpoint. Shopping's SOLANA_RPC_URL is mainnet and is never read here. */
export const DEVNET_RPC = "https://api.devnet.solana.com";
export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const MAINNET_GENESIS_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
export const TESTNET_GENESIS_HASH = "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY";

const INVALID_DEVNET_RPC = "SOLANA_DEVNET_RPC_URL must be an https URL without embedded credentials.";
let verifiedUrl: string | null = null;

export function resetDevnetEndpointCheck(): void {
  verifiedUrl = null;
}

/** Dedicated devnet URL only. A blank value stays on the public devnet endpoint. */
export function devnetRpcUrl(env: Record<string, string | undefined> = process.env): string {
  const configured = env.SOLANA_DEVNET_RPC_URL?.trim();
  if (!configured) return DEVNET_RPC;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error(INVALID_DEVNET_RPC);
  }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error(INVALID_DEVNET_RPC);
  return url.toString();
}

export async function ensureDevnetEndpoint(fetchImpl: typeof fetch = fetch): Promise<void> {
  const url = devnetRpcUrl();
  if (verifiedUrl === url) return;
  const hash = await rpc<string>("getGenesisHash", [], fetchImpl);
  if (hash === MAINNET_GENESIS_HASH) throw new Error("The configured devnet RPC returned Solana mainnet. Checkout was not started.");
  if (hash === TESTNET_GENESIS_HASH) throw new Error("The configured devnet RPC returned Solana testnet. Checkout was not started.");
  if (hash !== DEVNET_GENESIS_HASH) throw new Error("The configured devnet RPC is not Solana devnet. Checkout was not started.");
  verifiedUrl = url;
}

export async function rpc<T>(method: string, params: unknown[], fetchImpl: typeof fetch = fetch): Promise<T> {
  const endpoint = devnetRpcUrl();
  const attempts = method === "sendTransaction" ? 1 : 3;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new Error(`Devnet ${method} could not be reached.`);
    }
    const body = await response.json() as { result?: T; error?: { message?: string } | string };
    const providerMessage = typeof body.error === "string" ? body.error : body.error?.message;
    const limited = response.status === 429 || /rate limit|too many requests/i.test(providerMessage ?? "");
    if (limited && attempt + 1 < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 1_000 * (attempt + 1)));
      continue;
    }
    if (!response.ok || body.error) throw new Error(failureMessage(providerMessage, limited, method));
    return body.result as T;
  }
  throw new Error("Devnet request failed.");
}

export async function devnetMint(mint: string): Promise<{ owner: string; decimals: number; space: number }> {
  await ensureDevnetEndpoint();
  const result = await rpc<{ value: { owner: string; data: [string, string] } | null }>("getAccountInfo", [mint, { encoding: "base64" }]);
  if (!result.value) throw new Error("Devnet mint account was not found.");
  const data = Buffer.from(result.value.data[0], "base64");
  return { owner: result.value.owner, decimals: data[44] ?? -1, space: data.length };
}

export async function recentBlockhash(fetchImpl: typeof fetch = fetch): Promise<string> {
  await ensureDevnetEndpoint(fetchImpl);
  const result = await rpc<{ value: { blockhash: string } }>("getLatestBlockhash", [{ commitment: "confirmed" }], fetchImpl);
  return result.value.blockhash;
}

export async function sendSigned(transaction: Uint8Array, fetchImpl: typeof fetch = fetch): Promise<string> {
  await ensureDevnetEndpoint(fetchImpl);
  const validity = await rpc<{ value: boolean }>("isBlockhashValid", [transactionBlockhash(transaction), { commitment: "confirmed" }], fetchImpl);
  if (validity.value !== true) throw new Error("Payment blockhash expired or is unavailable. Cancel the review, request a fresh checkout, and sign again. No payment was sent.");
  return rpc<string>("sendTransaction", [Buffer.from(transaction).toString("base64"), { encoding: "base64", preflightCommitment: "confirmed" }], fetchImpl);
}

export async function confirmedTransaction(signature: string, fetchImpl: typeof fetch = fetch): Promise<unknown | null> {
  await ensureDevnetEndpoint(fetchImpl);
  return rpc<unknown | null>("getTransaction", [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }], fetchImpl);
}

export function devnetChainRpc(): ChainRpc {
  return {
    async getBalance(address) {
      await ensureDevnetEndpoint();
      const result = await rpc<{ value: number }>("getBalance", [address, { commitment: "confirmed" }]);
      return BigInt(result.value);
    },
    async tokenAccount(address) {
      await ensureDevnetEndpoint();
      const result = await rpc<{ value: { data?: { parsed?: { info?: { tokenAmount?: { amount?: unknown } } } } } | null }>(
        "getAccountInfo",
        [address, { encoding: "jsonParsed", commitment: "confirmed" }],
      );
      const amount = result.value?.data?.parsed?.info?.tokenAmount?.amount;
      return typeof amount === "string" ? { amount: BigInt(amount) } : null;
    },
    async rent(space) {
      await ensureDevnetEndpoint();
      return BigInt(await rpc<number>("getMinimumBalanceForRentExemption", [space]));
    },
    blockhash: () => recentBlockhash(),
    send: (transaction) => sendSigned(transaction),
    getTransaction: (signature) => confirmedTransaction(signature),
    pause: () => new Promise((resolve) => setTimeout(resolve, 1_000)),
  };
}

function failureMessage(providerMessage: string | undefined, limited: boolean, method: string): string {
  if (limited) return "Connection rate limits exceeded.";
  if (providerMessage && providerMessage.length <= 160 && !/https?:|api[-_ ]?key|secret|bearer/i.test(providerMessage)) {
    return providerMessage;
  }
  return `Devnet ${method} failed.`;
}
