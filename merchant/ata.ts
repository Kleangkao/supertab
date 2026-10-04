import { createHash } from "node:crypto";
import { encodeBase58, requirePubkey } from "./base58";
import { isOnCurve } from "./curve";
import { TOKEN_PROGRAM } from "./product";

export const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

export function associatedTokenAddress(owner: string, mint: string): string {
  const address = findProgramAddress(
    [requirePubkey(owner, "owner"), requirePubkey(TOKEN_PROGRAM, "token program"), requirePubkey(mint, "mint")],
    requirePubkey(ASSOCIATED_TOKEN_PROGRAM, "associated token program"),
  );
  return encodeBase58(address);
}

function findProgramAddress(seeds: Uint8Array[], program: Uint8Array): Uint8Array {
  for (let bump = 255; bump >= 0; bump -= 1) {
    const hash = createHash("sha256");
    for (const seed of seeds) hash.update(seed);
    hash.update(Buffer.from([bump]));
    hash.update(program);
    hash.update(Buffer.from("ProgramDerivedAddress"));
    const address = hash.digest();
    if (!isOnCurve(address)) return address;
  }
  throw new Error("No program address was found.");
}
