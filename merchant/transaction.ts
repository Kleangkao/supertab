import { requirePubkey } from "./base58";
import { ASSOCIATED_TOKEN_PROGRAM } from "./ata";
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
      { program: TOKEN_PROGRAM, accounts: [input.sourceTokenAccount, input.mint, input.destinationTokenAccount, input.buyer, input.reference], data },
      { program: MEMO_PROGRAM, accounts: [input.buyer], data: new TextEncoder().encode(input.memo) },
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

export function buildCreateAssociatedTokenAccount(input: {
  payer: string;
  associated: string;
  owner: string;
  mint: string;
  blockhash: string;
}): BuiltTransaction {
  return compile({
    blockhash: input.blockhash,
    accounts: [
      { address: input.payer, signer: true, writable: true },
      { address: input.associated, signer: false, writable: true },
      { address: input.owner, signer: false, writable: false },
      { address: input.mint, signer: false, writable: false },
      { address: SYSTEM_PROGRAM, signer: false, writable: false },
      { address: TOKEN_PROGRAM, signer: false, writable: false },
      { address: ASSOCIATED_TOKEN_PROGRAM, signer: false, writable: false },
    ],
    instructions: [{
      program: ASSOCIATED_TOKEN_PROGRAM,
      accounts: [input.payer, input.associated, input.owner, input.mint, SYSTEM_PROGRAM, TOKEN_PROGRAM],
      data: Uint8Array.of(1),
    }],
  });
}

export function buildRefundTransaction(input: {
  feePayer: string;
  merchant: string;
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
      { address: input.feePayer, signer: true, writable: true },
      { address: input.merchant, signer: true, writable: false },
      { address: input.sourceTokenAccount, signer: false, writable: true },
      { address: input.destinationTokenAccount, signer: false, writable: true },
      { address: input.mint, signer: false, writable: false },
      { address: TOKEN_PROGRAM, signer: false, writable: false },
      { address: MEMO_PROGRAM, signer: false, writable: false },
      { address: input.reference, signer: false, writable: false },
    ],
    instructions: [
      { program: TOKEN_PROGRAM, accounts: [input.sourceTokenAccount, input.mint, input.destinationTokenAccount, input.merchant, input.reference], data },
      { program: MEMO_PROGRAM, accounts: [input.merchant], data: new TextEncoder().encode(input.memo) },
    ],
  });
}

export function signPreparedTransaction(serialized: string, key: SolanaKey): Uint8Array {
  const raw = Buffer.from(serialized, "base64");
  if (raw[0] !== 1) throw new Error("The checkout transaction does not have one signer.");
  const message = raw.subarray(65);
  const firstAccount = message.subarray(4, 36);
  if (Buffer.compare(firstAccount, key.publicKey) !== 0) throw new Error("The checkout is not for this payer.");
  const signed = raw.subarray();
  signed.set(signBytes(key, message), 1);
  return Uint8Array.from(signed);
}

/** Fills one zero signature slot. A signature that is already present must already match. */
export function addSignerSignature(transaction: Uint8Array, key: SolanaKey, signerIndex: number): Uint8Array {
  const signers = transaction[0] ?? 0;
  if (signers < 1 || signers > 2 || signerIndex < 0 || signerIndex >= signers) {
    throw new Error("Signer index is outside this transaction.");
  }
  const message = transaction.subarray(1 + signers * 64);
  const versioned = (message[0]! & 128) !== 0;
  const header = versioned ? 1 : 0;
  if (message[header] !== signers) throw new Error("The transaction header does not match its signatures.");
  const pubkeyAt = header + 4 + signerIndex * 32;
  const pubkey = message.subarray(pubkeyAt, pubkeyAt + 32);
  if (pubkey.length !== 32 || Buffer.compare(pubkey, key.publicKey) !== 0) {
    throw new Error("This signature slot is not the devnet merchant.");
  }
  const signature = signBytes(key, message);
  const slot = 1 + signerIndex * 64;
  const existing = transaction.subarray(slot, slot + 64);
  if (existing.every((byte) => byte === 0)) {
    const signed = Uint8Array.from(transaction);
    signed.set(signature, slot);
    return signed;
  }
  if (Buffer.compare(existing, signature) !== 0) throw new Error("The merchant signature does not match this refund.");
  return Uint8Array.from(transaction);
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
    ordered.filter((account) => account.signer && !account.writable).length,
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
