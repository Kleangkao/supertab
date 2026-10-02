export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export const NATIVE_SOL_MINT = "native-sol";
export const JUP_MINT = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
export const BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

export const DEFAULT_SOL_RESERVE_LAMPORTS = 10_000_000n;
export const USDC_DECIMALS = 6;

export type AssetKind = "native" | "stablecoin" | "spl";

export interface AssetBalance {
  mint: string;
  symbol: string | null;
  name: string | null;
  decimals: number;
  amount: bigint;
  kind: AssetKind;
  /** True only when the mint is the canonical USDC mint, not when a symbol says USDC. */
  isUsdc: boolean;
  /** True only after DFlow returns a route. Never assumed from the token list. */
  routeKnown: boolean;
  observed: boolean;
}

interface KnownMint {
  symbol: string;
  name: string;
  decimals: number;
}

const KNOWN: Record<string, KnownMint> = {
  [WSOL_MINT]: { symbol: "SOL", name: "Solana", decimals: 9 },
  [USDC_MINT]: { symbol: "USDC", name: "USD Coin", decimals: 6 },
  [JUP_MINT]: { symbol: "JUP", name: "Jupiter", decimals: 6 },
  [BONK_MINT]: { symbol: "BONK", name: "Bonk", decimals: 5 },
};

export function knownMintMetadata(mint: string): KnownMint | null {
  return KNOWN[mint] ?? null;
}

export function isUsdcMint(mint: string): boolean {
  return mint === USDC_MINT;
}

export function dflowInputMint(balance: AssetBalance): string | null {
  if (balance.kind === "native" || balance.mint === NATIVE_SOL_MINT) return WSOL_MINT;
  if (balance.isUsdc) return null;
  return balance.mint;
}

export function emptyUsdcBalance(): AssetBalance {
  return {
    mint: USDC_MINT,
    symbol: "USDC",
    name: "USD Coin",
    decimals: USDC_DECIMALS,
    amount: 0n,
    kind: "stablecoin",
    isUsdc: true,
    routeKnown: false,
    observed: false,
  };
}

export function sampleSpendingAssets(): AssetBalance[] {
  return [
    {
      mint: USDC_MINT,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      amount: 42_000_000n,
      kind: "stablecoin",
      isUsdc: true,
      routeKnown: false,
      observed: true,
    },
    {
      mint: NATIVE_SOL_MINT,
      symbol: "SOL",
      name: "Solana",
      decimals: 9,
      amount: 600_000_000n,
      kind: "native",
      isUsdc: false,
      routeKnown: false,
      observed: true,
    },
    {
      mint: JUP_MINT,
      symbol: "JUP",
      name: "Jupiter",
      decimals: 6,
      amount: 350_000_000n,
      kind: "spl",
      isUsdc: false,
      routeKnown: false,
      observed: true,
    },
  ];
}

export function spendableNativeLamports(balance: AssetBalance, reserve = DEFAULT_SOL_RESERVE_LAMPORTS): bigint {
  if (balance.kind !== "native" && balance.mint !== NATIVE_SOL_MINT) return balance.amount;
  return balance.amount > reserve ? balance.amount - reserve : 0n;
}
