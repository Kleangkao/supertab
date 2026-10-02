import { randomUUID } from "node:crypto";
import { buildMemoTransaction, checkMemoBytes, DEVNET_CHAIN, type DevnetSigningCheck } from "./devnet-memo";
import { verifyEd25519 } from "./wallet-proof";

export const DEVNET_CHECK_TTL_MS = 60_000;
export async function prepareDevnetCheck(input: { address: string; termsId: string; origin: string;
  now: () => number; fetchImpl?: typeof fetch }): Promise<DevnetSigningCheck> {
  // Fixed public Devnet endpoint; never use the production RPC setting or redirect.
  const response = await (input.fetchImpl ?? fetch)("https://api.devnet.solana.com", {
    method: "POST", redirect: "error", cache: "no-store", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestBlockhash", params: [{ commitment: "confirmed" }] }),
    signal: AbortSignal.timeout(12_000),
  }).catch(() => { throw new Error("Devnet could not be reached. No signing check was prepared."); });
  const body = await response.json() as { error?: unknown; result?: { value?: { blockhash?: unknown; lastValidBlockHeight?: unknown } } };
  const value = body.result?.value;
  if (!response.ok || body.error || typeof value?.blockhash !== "string" || value.blockhash.length > 44
    || typeof value.lastValidBlockHeight !== "number" || !Number.isSafeInteger(value.lastValidBlockHeight)) {
    throw new Error("Devnet did not return a usable blockhash.");
  }
  const id = randomUUID();
  const memo = `SuperTab devnet signing check\nApp: ${input.origin}\nNonce: ${id}\nSign only. No broadcast, swap, payment or purchase approval.`;
  const transaction = buildMemoTransaction(input.address, value.blockhash, memo);
  return { id, address: input.address, termsId: input.termsId, chain: DEVNET_CHAIN,
    memo, blockhash: value.blockhash, expiresAt: new Date(input.now() + DEVNET_CHECK_TTL_MS).toISOString(),
    transaction: Buffer.from(transaction).toString("base64") };
}

export function verifyDevnetCheck(check: DevnetSigningCheck, signedTransaction: string, nowMs: number): void {
  if (nowMs >= Date.parse(check.expiresAt)) throw new Error("This devnet check expired. Prepare a new check.");
  if (signedTransaction.length > 1800 || !/^[A-Za-z0-9+/]+={0,2}$/.test(signedTransaction)) throw new Error("Invalid signed transaction.");
  const bytes = Buffer.from(signedTransaction, "base64");
  checkMemoBytes(check, bytes, true);
  verifyEd25519(check.address, bytes.subarray(65), bytes.subarray(1, 65));
}
