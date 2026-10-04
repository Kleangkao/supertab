import { TEST_TOTAL_MINOR } from "./product";

export function missingFunding(input: {
  lamports: bigint;
  usdcMinor: bigint;
  rentLamports: bigint;
  missingTokenAccounts: number;
  totalMinor?: bigint;
}): "devnet SOL" | "Circle devnet USDC" | null {
  const neededLamports = input.rentLamports * BigInt(input.missingTokenAccounts) + 50_000n;
  if (input.lamports < neededLamports) return "devnet SOL";
  if (input.usdcMinor < (input.totalMinor ?? TEST_TOTAL_MINOR)) return "Circle devnet USDC";
  return null;
}
