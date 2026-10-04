import type { ChainRpc } from "./execute";

export const DEVNET_RPC = "https://api.devnet.solana.com";

export async function rpc<T>(method: string, params: unknown[], fetchImpl: typeof fetch = fetch): Promise<T> {
  const response = await fetchImpl(DEVNET_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json() as { result?: T; error?: { message?: string } };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? `Devnet ${method} failed.`);
  return body.result as T;
}

export async function devnetMint(mint: string): Promise<{ owner: string; decimals: number; space: number }> {
  const result = await rpc<{ value: { owner: string; data: [string, string] } | null }>("getAccountInfo", [mint, { encoding: "base64" }]);
  if (!result.value) throw new Error("Devnet mint account was not found.");
  const data = Buffer.from(result.value.data[0], "base64");
  return { owner: result.value.owner, decimals: data[44] ?? -1, space: data.length };
}

export async function recentBlockhash(): Promise<string> {
  const result = await rpc<{ value: { blockhash: string } }>("getLatestBlockhash", [{ commitment: "confirmed" }]);
  return result.value.blockhash;
}

export async function sendSigned(transaction: Uint8Array): Promise<string> {
  return rpc<string>("sendTransaction", [Buffer.from(transaction).toString("base64"), { encoding: "base64", preflightCommitment: "confirmed" }]);
}

export async function confirmedTransaction(signature: string): Promise<unknown | null> {
  return rpc<unknown | null>("getTransaction", [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]);
}

export function devnetChainRpc(): ChainRpc {
  return {
    async getBalance(address) {
      const result = await rpc<{ value: number }>("getBalance", [address, { commitment: "confirmed" }]);
      return BigInt(result.value);
    },
    async tokenAccount(address) {
      const result = await rpc<{ value: { data?: { parsed?: { info?: { tokenAmount?: { amount?: unknown } } } } } | null }>(
        "getAccountInfo",
        [address, { encoding: "jsonParsed", commitment: "confirmed" }],
      );
      const amount = result.value?.data?.parsed?.info?.tokenAmount?.amount;
      return typeof amount === "string" ? { amount: BigInt(amount) } : null;
    },
    async rent(space) {
      return BigInt(await rpc<number>("getMinimumBalanceForRentExemption", [space]));
    },
    blockhash: recentBlockhash,
    send: sendSigned,
    getTransaction: confirmedTransaction,
    pause: () => new Promise((resolve) => setTimeout(resolve, 1_000)),
  };
}
