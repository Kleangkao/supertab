import { requirePubkey } from "./base58";
import { signBytes, type SolanaKey } from "./keys";
import { TOKEN_PROGRAM } from "./product";

export const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const TOKEN_ACCOUNT_SPACE = 165n;

interface AccountMeta {
  address: string;
  signer: boolean;
  writable: boolean;
}

interface Instruction {
  program: string;
  accounts: string[];
  data: Uint8Array;
}

export interface BuiltTransaction {
  transaction: Uint8Array;
  message: Uint8Array;
  signers: string[];
}

export function buildPaymentTransaction(input: {
  buyer: string;
  sourceTokenAccount: string;
  destinationTokenAccount: string;
  mint: string;
  reference: string;
  amount: bigint;
  decimals: number;
  memo: string;
  blockhash: string;
}): BuiltTransaction {
  const data = new Uint8Array(10);
  data[0] = 12;
  writeU64(data, 1, input.amount);
  data[9] = input.decimals;
  return compile({
    blockhash: input.blockhash,
    accounts: [
      { address: input.buyer, signer: true, writable: true },
      { address: input.sourceTokenAccount, signer: false, writable: true },
      { address: input.destinationTokenAccount, signer: false, writable: true },
      { address: input.mint, signer: false, writable: false },
      { address: TOKEN_PROGRAM, signer: false, writable: false },
      { address: MEMO_PROGRAM, signer: false, writable: false },
      { address: input.reference, signer: false, writable: false },
    ],
    instructions: [
      { program: TOKEN_PROGRAM, accounts: [input.sourceTokenAccount, input.mint, input.destinationTokenAccount, input.buyer], data },
      { program: MEMO_PROGRAM, accounts: [input.buyer, input.reference], data: new TextEncoder().encode(input.memo) },
    ],
  });
}

export function buildCreateTokenAccount(input: {
  payer: string;
  tokenAccount: string;
  owner: string;
  mint: string;
  lamports: bigint;
  blockhash: string;
}): BuiltTransaction {
  const create = new Uint8Array(4 + 8 + 8 + 32);
  writeU64(create, 4, input.lamports);
  writeU64(create, 12, TOKEN_ACCOUNT_SPACE);
  create.set(requirePubkey(TOKEN_PROGRAM, "token program"), 20);
  const initialize = new Uint8Array(33);
  initialize[0] = 18;
  initialize.set(requirePubkey(input.owner, "token owner"), 1);
  return compile({
    blockhash: input.blockhash,
    accounts: [
      { address: input.payer, signer: true, writable: true },
      { address: input.tokenAccount, signer: true, writable: true },
      { address: SYSTEM_PROGRAM, signer: false, writable: false },
      { address: TOKEN_PROGRAM, signer: false, writable: false },
      { address: input.mint, signer: false, writable: false },
    ],
    instructions: [
      { program: SYSTEM_PROGRAM, accounts: [input.payer, input.tokenAccount], data: create },
      { program: TOKEN_PROGRAM, accounts: [input.tokenAccount, input.mint], data: initialize },
    ],
  });
}

export function signTransaction(built: BuiltTransaction, keys: SolanaKey[]): Uint8Array {
  if (keys.length !== built.signers.length || keys.some((key, index) => key.address !== built.signers[index])) {
    throw new Error("Transaction signers are not in the required order.");
  }
  const signed = built.transaction.slice();
  keys.forEach((key, index) => signed.set(signBytes(key, built.message), 1 + index * 64));
  return signed;
}

export function transactionBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function compile(input: { blockhash: string; accounts: AccountMeta[]; instructions: Instruction[] }): BuiltTransaction {
  const ordered = [
    ...input.accounts.filter((account) => account.signer && account.writable),
    ...input.accounts.filter((account) => account.signer && !account.writable),
    ...input.accounts.filter((account) => !account.signer && account.writable),
    ...input.accounts.filter((account) => !account.signer && !account.writable),
  ];
  const signers = ordered.filter((account) => account.signer).map((account) => account.address);
  const indexes = new Map(ordered.map((account, index) => [account.address, index]));
  const encodedInstructions = input.instructions.flatMap((instruction) => {
    const programIndex = indexes.get(instruction.program);
    if (programIndex === undefined) throw new Error("Instruction program is missing from the account list.");
    const accountIndexes = instruction.accounts.map((account) => {
      const index = indexes.get(account);
      if (index === undefined) throw new Error("Instruction account is missing from the account list.");
      return index;
    });
    return [programIndex, ...shortvec(accountIndexes.length), ...accountIndexes, ...shortvec(instruction.data.length), ...instruction.data];
  });
  const message = Uint8Array.from([
    signers.length,
    0,
    ordered.filter((account) => !account.signer && !account.writable).length,
    ...shortvec(ordered.length),
    ...ordered.flatMap((account) => [...requirePubkey(account.address, "account")]),
    ...requirePubkey(input.blockhash, "blockhash"),
    ...shortvec(input.instructions.length),
    ...encodedInstructions,
  ]);
  return {
    message,
    signers,
    transaction: Uint8Array.from([...shortvec(signers.length), ...new Array<number>(signers.length * 64).fill(0), ...message]),
  };
}

function shortvec(length: number): number[] {
  if (!Number.isInteger(length) || length < 0 || length > 0x7fff) throw new Error("Unsupported compact length.");
  return length < 128 ? [length] : [(length & 127) | 128, length >> 7];
}

function writeU64(target: Uint8Array, offset: number, value: bigint): void {
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) throw new Error("Amount does not fit in 64 bits.");
  let remaining = value;
  for (let index = 0; index < 8; index += 1) {
    target[offset + index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
}
