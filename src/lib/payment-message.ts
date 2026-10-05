import { decodeBase58, encodeBase58 } from "./base58";

export function transactionBlockhash(transaction: Uint8Array): string {
  const hex = parse(transaction).blockhash;
  return encodeBase58(Uint8Array.from(hex.match(/../g)!, pair => parseInt(pair, 16)));
}

/** Compare payment meaning across legacy/v0 serialization and account reordering.
 * No added instruction, changed privilege, blockhash, or lookup table is allowed.
 */
export function samePaymentMessage(expected: Uint8Array, returned: Uint8Array): boolean {
  try {
    return JSON.stringify(comparable(parse(expected))) === JSON.stringify(comparable(parse(returned)));
  } catch { return false; }
}

export const DEVNET_PRIORITY_FEE_CAP_LAMPORTS = 100_000n;

/** Allow only the wallet's bounded unit-limit/unit-price pair in addition to the exact payment. */
export function samePaymentWithWalletBudget(expected: Uint8Array, returned: Uint8Array): boolean {
  try {
    const left = parse(expected);
    const right = parse(returned);
    const budgetKey = pubkeyHex("ComputeBudget111111111111111111111111111111");
    if (left.instructions.some(i => i.program.key === budgetKey)) return false;
    const budgets = right.instructions.filter(i => i.program.key === budgetKey);
    if (budgets.length !== 2) return false;
    let units: bigint | null = null;
    let price: bigint | null = null;
    for (const instruction of budgets) {
      if (instruction.accounts.length || instruction.program.signer || instruction.program.writable) return false;
      const data = instruction.data;
      const value = (hex: string) => BigInt(`0x${hex.match(/../g)!.reverse().join("")}`);
      if (data.startsWith("02") && data.length === 10 && units === null) units = value(data.slice(2));
      else if (data.startsWith("03") && data.length === 18 && price === null) price = value(data.slice(2));
      else return false;
    }
    if (units === null || price === null || units <= 0n || units > 1_400_000n) return false;
    const priorityFee = (units * price + 999_999n) / 1_000_000n;
    if (priorityFee > DEVNET_PRIORITY_FEE_CAP_LAMPORTS) return false;
    const payment = { ...right,
      keys: right.keys.filter(key => key.key !== budgetKey),
      instructions: right.instructions.filter(i => i.program.key !== budgetKey),
    };
    return JSON.stringify(comparable(left)) === JSON.stringify(comparable(payment));
  } catch { return false; }
}

function comparable(parsed: ReturnType<typeof parse>) {
  return {
    payer: parsed.payer,
    keys: parsed.keys,
    blockhash: parsed.blockhash,
    instructions: parsed.instructions,
  };
}

/** Sizes, versions, and instruction types only. No accounts, amounts, or signatures. */
export function describePaymentMismatch(expected: Uint8Array, returned: Uint8Array): string {
  const sizes = `${expected.length} → ${returned.length} bytes`;
  try {
    const left = summarize(parse(expected));
    const right = summarize(parse(returned));
    const added = right.programs.filter((program) => !left.programs.includes(program));
    const addedText = added.length > 0 ? `, added ${added.join("+")}` : "";
    return `${sizes}, ${left.version} → ${right.version}, instructions ${left.instructions} → ${right.instructions}${addedText}`;
  } catch {
    return `${sizes}, unreadable transaction`;
  }
}

const PROGRAM_NAMES = new Map<string, string>([
  [pubkeyHex("11111111111111111111111111111111"), "System"],
  [pubkeyHex("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), "Token"],
  [pubkeyHex("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), "Memo"],
  [pubkeyHex("ComputeBudget111111111111111111111111111111"), "ComputeBudget"],
  [pubkeyHex("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"), "AssociatedToken"],
]);

function pubkeyHex(address: string): string {
  const bytes = decodeBase58(address);
  if (!bytes) return "";
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function summarize(parsed: ReturnType<typeof parse>): { version: "legacy" | "v0"; instructions: number; programs: string[] } {
  return {
    version: parsed.version,
    instructions: parsed.instructions.length,
    programs: parsed.instructions.map((instruction) => PROGRAM_NAMES.get(instruction.program.key) ?? "other"),
  };
}

function parse(raw: Uint8Array) {
  let offset = 0;
  function byte(): number {
    if (offset >= raw.length) throw new Error("Truncated transaction");
    return raw[offset++]!;
  }
  function count(): number {
    let value = 0;
    for (let shift = 0; shift <= 14; shift += 7) {
      const part = byte();
      value |= (part & 127) << shift;
      if (!(part & 128)) return value;
    }
    throw new Error("Invalid compact count");
  }
  function bytes(length: number): string {
    if (offset + length > raw.length) throw new Error("Truncated transaction");
    const value = Array.from(raw.subarray(offset, offset + length), b => b.toString(16).padStart(2, "0")).join("");
    offset += length;
    return value;
  }
  const signatures = count();
  if (signatures < 1 || signatures > 2) throw new Error("Unexpected signers");
  bytes(64 * signatures);
  let required = byte();
  const versioned = (required & 128) !== 0;
  if (versioned) {
    if (required !== 128) throw new Error("Unsupported version");
    required = byte();
  }
  const readonlySigned = byte();
  const readonlyUnsigned = byte();
  const keyCount = count();
  if (required !== signatures || readonlySigned > required || readonlyUnsigned > keyCount - required || keyCount > 256) {
    throw new Error("Invalid header");
  }
  const keys = Array.from({ length: keyCount }, (_, index) => ({
    key: bytes(32), signer: index < required,
    writable: index < required ? index < required - readonlySigned : index < keyCount - readonlyUnsigned,
  }));
  if (new Set(keys.map(key => key.key)).size !== keys.length) throw new Error("Duplicate account");
  const blockhash = bytes(32);
  function account(index: number) {
    if (!keys[index]) throw new Error("Invalid account index");
    return keys[index]!;
  }
  const instructionCount = count();
  if (instructionCount > 64) throw new Error("Too many instructions");
  const instructions = Array.from({ length: instructionCount }, () => {
    const program = account(byte());
    const accounts = Array.from({ length: count() }, () => account(byte()));
    const data = bytes(count());
    return { program, accounts, data };
  });
  if (versioned && count() !== 0) throw new Error("Lookup tables are not supported");
  if (offset !== raw.length) throw new Error("Trailing bytes");
  return {
    version: versioned ? "v0" as const : "legacy" as const,
    payer: keys[0],
    keys: [...keys].sort((a, b) => a.key.localeCompare(b.key)),
    blockhash,
    instructions,
  };
}
