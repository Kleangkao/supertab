import type { AppConfig } from "./config";
import { DEVNET_CONVERSION_FINDING, type ConversionReview, type DevnetConversionResult } from "./conversion-facts";
import {
  ConversionInputError,
  assessConversionBalance,
  buildConversionReview,
  decodeTransaction,
  parseDisclosedLookupTables,
  parseExactTokenAmount,
  resolveConversionAsset,
  validateConversionTransaction,
} from "./conversion-review";
import { DflowRouteError, fetchConversionOrder } from "./dflow";
import { formatFixedMinor } from "./money";
import { USDC_DECIMALS, USDC_MINT, type AssetBalance } from "./tokens";
import { isPlausibleAddress, readSolanaBalances } from "./wallet";

export interface ConversionDeps {
  config: AppConfig;
  fetchImpl?: typeof fetch;
  now?: () => number;
  readBalances?: typeof readSolanaBalances;
}

export async function readConversionWallet(address: string, deps: ConversionDeps): Promise<{
  network: "solana:mainnet-beta";
  assets: {
    mint: string;
    symbol: string | null;
    decimals: number;
    amountBase: string;
    amountDisplay: string;
    kind: AssetBalance["kind"];
    isMainnetUsdc: boolean;
  }[];
}> {
  if (!isPlausibleAddress(address)) throw new ConversionInputError("That does not look like a Solana address.");
  const balances = await (deps.readBalances ?? readSolanaBalances)(address, {
    rpcUrl: deps.config.solanaRpcUrl,
    fetchImpl: deps.fetchImpl,
  });
  return {
    network: "solana:mainnet-beta",
    assets: balances.map((asset) => ({
      mint: asset.mint,
      symbol: asset.symbol,
      decimals: asset.decimals,
      amountBase: asset.amount.toString(),
      amountDisplay: `${formatFixedMinor(asset.amount, asset.decimals)} ${asset.symbol ?? "tokens"}`,
      kind: asset.kind,
      isMainnetUsdc: asset.mint === USDC_MINT && asset.decimals === USDC_DECIMALS,
    })),
  };
}

export async function requestConversionQuote(input: {
  network?: string;
  inputMint?: string;
  amountText?: string;
  assetKind?: string;
  walletAddress?: string;
}, deps: ConversionDeps): Promise<ConversionReview | DevnetConversionResult> {
  if (input.network === "devnet" || input.network === "solana:devnet") {
    return {
      label: "Asset conversion — quote only",
      network: "solana:devnet",
      supported: false,
      completed: false,
      signing: "unavailable",
      broadcast: "unavailable",
      finding: DEVNET_CONVERSION_FINDING,
    };
  }
  if (input.network != null && input.network !== "mainnet-beta" && input.network !== "solana:mainnet-beta") {
    throw new ConversionInputError("Choose Solana mainnet-beta for a USDC quote, or review the recorded devnet result.");
  }
  if (typeof input.inputMint !== "string" || typeof input.amountText !== "string") {
    throw new ConversionInputError("Choose an asset and an amount.");
  }
  const kind = input.assetKind === "native" ? "native" : "spl";
  const asset = resolveConversionAsset(input.inputMint, kind);
  const walletAddress = input.walletAddress?.trim() ?? "";
  let decimals = asset.decimals;
  let balance: ConversionReview["balance"] = {
    status: "not_read",
    detail: "No wallet was read. This quote is not compared with a balance.",
    usdcBalanceBase: null,
    usdcBalanceDisplay: null,
  };
  if (walletAddress) {
    if (!isPlausibleAddress(walletAddress)) throw new ConversionInputError("That does not look like a Solana address.");
    const balances = await (deps.readBalances ?? readSolanaBalances)(walletAddress, {
      rpcUrl: deps.config.solanaRpcUrl,
      fetchImpl: deps.fetchImpl,
    });
    const held = balances.find((item) => item.mint === asset.walletMint);
    if (!held) throw new ConversionInputError("That mint is not in this mainnet wallet.");
    if (!Number.isInteger(held.decimals) || held.decimals < 0 || held.decimals > 18) {
      throw new ConversionInputError("The wallet returned decimals that cannot be used.");
    }
    if (asset.known && asset.decimals !== held.decimals) {
      throw new ConversionInputError(`The wallet reports ${held.decimals} decimals for this mint, which does not match the mint SuperTab knows.`);
    }
    decimals = held.decimals;
    asset.symbol = held.symbol ?? asset.symbol;
    const sol = balances.find((item) => item.kind === "native")?.amount ?? 0n;
    const usdc = balances.find((item) => item.mint === USDC_MINT && item.decimals === USDC_DECIMALS)?.amount ?? 0n;
    const amountForBalance = parseExactTokenAmount(input.amountText, decimals);
    balance = {
      ...assessConversionBalance({
        kind: asset.kind,
        assetAmount: held.amount,
        solLamports: sol,
        inputAmount: amountForBalance,
      }),
      usdcBalanceBase: usdc.toString(),
      usdcBalanceDisplay: `${formatFixedMinor(usdc, USDC_DECIMALS)} USDC`,
    };
  }
  if (decimals == null) {
    throw new ConversionInputError("Read the wallet so the mint decimals come from the chain.");
  }
  const amount = parseExactTokenAmount(input.amountText, decimals);
  const order = await fetchConversionOrder({
    inputMint: asset.quotedMint,
    outputMint: USDC_MINT,
    amount,
    userPublicKey: walletAddress || undefined,
    wrapAndUnwrapSol: asset.kind === "native",
  }, {
    baseUrl: deps.config.dflowBaseUrl,
    apiKey: deps.config.dflowApiKey ?? undefined,
    slippageBps: deps.config.dflowSlippageBps,
    fetchImpl: deps.fetchImpl,
  });
  if (order.quote.outputMint !== USDC_MINT) {
    throw new Error("DFlow returned an output mint that is not mainnet USDC.");
  }
  const validation = walletAddress
    ? inspectOrder(order, walletAddress)
    : {
      status: "not_prepared" as const,
      explanation: "No wallet address was read, so DFlow was not asked for an unsigned transaction.",
      limits: "A quote is not a conversion. Mainnet signing and sending are unavailable.",
    };
  return buildConversionReview({
    asset,
    decimals,
    quote: order.quote,
    quotedAtMs: deps.now?.() ?? Date.now(),
    balance,
    validation,
  });
}

function inspectOrder(
  order: Awaited<ReturnType<typeof fetchConversionOrder>>,
  payer: string,
): ConversionReview["validation"] {
  const limits = "Checked from the unsigned transaction and DFlow's disclosed lookup tables. Not simulated, not signed, and not sent. A checked result is not a completed conversion.";
  if (!order.transactionBase64) {
    return { status: "rejected", explanation: "DFlow did not return an unsigned transaction for this wallet.", limits };
  }
  const transaction = decodeTransaction(order.transactionBase64);
  if (!transaction) {
    return { status: "rejected", explanation: "DFlow returned a transaction that could not be read.", limits };
  }
  try {
    return validateConversionTransaction({
      transaction,
      payer,
      inputMint: order.quote.inputMint,
      outputMint: order.quote.outputMint,
      inAmount: order.quote.inAmount,
      outAmount: order.quote.outAmount,
      minOutAmount: order.quote.minOutAmount,
      lookupTables: parseDisclosedLookupTables(order.lookupTables),
      prioritizationFeeLamports: order.quote.prioritizationFeeLamports,
      executionMode: order.quote.executionMode,
    });
  } catch (error) {
    return {
      status: "rejected",
      explanation: error instanceof Error ? error.message : "The unsigned transaction could not be checked.",
      limits,
    };
  }
}

export function conversionFailureStatus(error: unknown): number {
  if (error instanceof ConversionInputError || error instanceof DflowRouteError) return 400;
  return 502;
}
