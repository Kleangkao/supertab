export interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner: string;
  amount: string;
  decimals: number;
}

export interface ChainTransaction {
  meta: {
    err: unknown;
    preTokenBalances?: TokenBalance[] | null;
    postTokenBalances?: TokenBalance[] | null;
  } | null;
  transaction: {
    message: {
      accountKeys: Array<string | { pubkey: string }>;
    };
  };
}

export interface ExpectedTransfer {
  sourceTokenAccount: string;
  destinationTokenAccount: string;
  sourceOwner: string;
  destinationOwner: string;
  mint: string;
  amount: bigint;
  decimals: number;
  reference: string;
}

export function verifyTransfer(tx: ChainTransaction, expected: ExpectedTransfer): string | null {
  if (!tx.meta || tx.meta.err) return "transaction_failed";
  const keys = tx.transaction.message.accountKeys.map((key) => typeof key === "string" ? key : key.pubkey);
  if (!keys.includes(expected.reference)) return "reference";
  const sourceIndex = keys.indexOf(expected.sourceTokenAccount);
  const destinationIndex = keys.indexOf(expected.destinationTokenAccount);
  if (sourceIndex < 0 || destinationIndex < 0) return "recipient";
  const source = movement(tx, sourceIndex, expected);
  const destination = movement(tx, destinationIndex, expected);
  if (!source || !destination) return "recipient";
  if (source.kind === "reject") return source.reason;
  if (destination.kind === "reject") return destination.reason;
  if (source.owner !== expected.sourceOwner || destination.owner !== expected.destinationOwner) return "recipient";
  if (destination.delta !== expected.amount || source.delta !== -expected.amount) return "amount";
  return null;
}

function movement(tx: ChainTransaction, accountIndex: number, expected: ExpectedTransfer):
  { kind: "ok"; owner: string; delta: bigint } | { kind: "reject"; reason: "mint" } | null {
  const before = balance(tx.meta?.preTokenBalances, accountIndex);
  const after = balance(tx.meta?.postTokenBalances, accountIndex);
  const selected = after ?? before;
  if (!selected) return null;
  if (selected.mint !== expected.mint || selected.decimals !== expected.decimals || !/^\d+$/.test(selected.amount)) return { kind: "reject", reason: "mint" };
  const prior = before && before.mint === expected.mint ? BigInt(before.amount) : 0n;
  const next = after && after.mint === expected.mint ? BigInt(after.amount) : 0n;
  return { kind: "ok", owner: selected.owner, delta: next - prior };
}

function balance(balances: TokenBalance[] | null | undefined, accountIndex: number): TokenBalance | null {
  return balances?.find((entry) => entry.accountIndex === accountIndex) ?? null;
}
