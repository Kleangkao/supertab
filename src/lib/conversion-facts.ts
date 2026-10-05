import { CIRCLE_SOLANA_DEVNET_USDC_MINT } from "../../merchant/product";
import { WSOL_MINT } from "./tokens";

/**
 * Checked once on October 5, 2026 against DFlow's order API.
 * The dev host is an unauthenticated mainnet quote tier, not Solana devnet.
 * Do not probe this pair again from the app.
 */
export const DEVNET_CONVERSION_FINDING = {
  checkedOn: "October 5, 2026",
  provider: "DFlow",
  host: "https://dev-quote-api.dflow.net",
  inputMint: WSOL_MINT,
  outputMint: CIRCLE_SOLANA_DEVNET_USDC_MINT,
  amountBase: "10000000",
  httpStatus: 400,
  code: "route_not_found",
  summary: "No genuine Solana devnet swap into Circle devnet USDC is available from DFlow. A wrapped-SOL order for that mint returned HTTP 400 route_not_found, including when a cluster=devnet parameter was sent. The order API does not select Solana devnet. Executed conversion remains unproven.",
} as const;

export interface DevnetConversionResult {
  label: "Asset conversion — quote only";
  network: "solana:devnet";
  supported: false;
  completed: false;
  signing: "unavailable";
  broadcast: "unavailable";
  finding: typeof DEVNET_CONVERSION_FINDING;
}

export interface ConversionReview {
  label: "Asset conversion — quote only";
  execution: "quote_only";
  completed: false;
  signing: "unavailable";
  broadcast: "unavailable";
  provider: "DFlow";
  network: "solana:mainnet-beta";
  walletAssetMint: string;
  inputMint: string;
  outputMint: string;
  inputSymbol: string | null;
  inputDecimals: number;
  outputDecimals: 6;
  inputAmountBase: string;
  inputAmountDisplay: string;
  estimatedOutputBase: string;
  estimatedOutputDisplay: string;
  minimumOutputBase: string;
  minimumOutputDisplay: string;
  slippageBps: number | null;
  slippageDisplay: string;
  platformFee: string;
  prioritizationFeeLamports: string | null;
  networkFee: string;
  quotedAt: string;
  expiresAt: string;
  lastValidBlockHeight: number | null;
  contextSlot: number | null;
  executionMode: string | null;
  coverage: {
    comparedWith: "recorded Solana Spaces quote, October 5, 2026";
    recordedMerchantTotal: "$55.53";
    recordedUsdcBase: string;
    minimumCoversRecordedTotal: boolean;
    note: string;
  };
  balance: {
    status: "sufficient" | "insufficient_input" | "insufficient_sol_fee" | "not_read";
    detail: string;
    usdcBalanceBase: string | null;
    usdcBalanceDisplay: string | null;
  };
  walletUsdcIncludesQuote: false;
  fundingGapIncludesQuote: false;
  validation: {
    status: "checked" | "rejected" | "not_prepared";
    explanation: string;
    limits: string;
  };
}
