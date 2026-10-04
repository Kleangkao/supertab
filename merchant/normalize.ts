import type { ChainTransaction, TokenBalance } from "./verify";

interface RpcTokenBalance {
  accountIndex?: unknown;
  mint?: unknown;
  owner?: unknown;
  amount?: unknown;
  decimals?: unknown;
  uiTokenAmount?: { amount?: unknown; decimals?: unknown };
}

/** Solana `jsonParsed` puts the integer amount under `uiTokenAmount`. Verification needs that integer. */
export function normalizeChainTransaction(raw: unknown): ChainTransaction | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { meta?: unknown; transaction?: { message?: { accountKeys?: unknown } } };
  const message = record.transaction?.message;
  if (!message || !Array.isArray(message.accountKeys)) return null;
  const meta = record.meta && typeof record.meta === "object" ? record.meta as { err?: unknown; preTokenBalances?: unknown; postTokenBalances?: unknown } : null;
  return {
    meta: meta ? {
      err: meta.err ?? null,
      preTokenBalances: tokenBalances(meta.preTokenBalances),
      postTokenBalances: tokenBalances(meta.postTokenBalances),
    } : null,
    transaction: { message: { accountKeys: message.accountKeys as ChainTransaction["transaction"]["message"]["accountKeys"] } },
  };
}

function tokenBalances(value: unknown): TokenBalance[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const balance = entry as RpcTokenBalance;
    const amount = balance.uiTokenAmount?.amount ?? balance.amount;
    const decimals = balance.uiTokenAmount?.decimals ?? balance.decimals;
    return {
      accountIndex: typeof balance.accountIndex === "number" ? balance.accountIndex : -1,
      mint: typeof balance.mint === "string" ? balance.mint : "",
      owner: typeof balance.owner === "string" ? balance.owner : "",
      amount: typeof amount === "string" ? amount : "",
      decimals: typeof decimals === "number" ? decimals : -1,
    };
  });
}
