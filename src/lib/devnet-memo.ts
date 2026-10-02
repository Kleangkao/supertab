import { decodeBase58 } from "./base58";

export const DEVNET_CHAIN = "solana:devnet";
export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export interface DevnetSigningCheck {
  id: string; termsId: string; address: string; chain: typeof DEVNET_CHAIN;
  memo: string; blockhash: string; expiresAt: string; transaction: string;
}

// https://solana.com/docs/core/transactions/transaction-structure
// https://www.solana-program.com/docs/memo
/** A deliberately narrow legacy transaction: one signer and one memo, no transfer. */
export function buildMemoTransaction(address: string, blockhash: string, memo: string): Uint8Array {
  const payer = decodeBase58(address), hash = decodeBase58(blockhash), program = decodeBase58(MEMO_PROGRAM)!;
  const data = new TextEncoder().encode(memo);
  if (payer?.length !== 32 || hash?.length !== 32 || data.length < 1 || data.length > 500) throw new Error("Invalid devnet memo terms.");
  const length = data.length < 128 ? [data.length] : [(data.length & 127) | 128, data.length >> 7];
  // Header [one signature, no readonly signers, one readonly unsigned key].
  const message = [1, 0, 1, 2, ...payer, ...program, ...hash, 1, 1, 1, 0, ...length, ...data];
  return Uint8Array.from([1, ...new Array<number>(64).fill(0), ...message]);
}

export function checkMemoBytes(check: DevnetSigningCheck, transaction: Uint8Array, signed: boolean): void {
  if (check.chain !== DEVNET_CHAIN) throw new Error("Only the isolated devnet check can be signed.");
  const expected = buildMemoTransaction(check.address, check.blockhash, check.memo);
  if (transaction.length !== expected.length || transaction[0] !== 1
    || transaction.subarray(65).some((byte, index) => byte !== expected[index + 65])
    || (!signed && transaction.subarray(1, 65).some(byte => byte !== 0))) {
    throw new Error("The wallet transaction differs from the single-memo signing check.");
  }
}
