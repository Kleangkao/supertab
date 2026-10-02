import type { AppConfig } from "./config";
import { FinancialExecutionDisabled } from "./execution";
import type { PaymentRail, PaymentRailStatus } from "./card-rail";

/** Official Bridge sandbox host. Production api.bridge.xyz is refused. */
export const BRIDGE_SANDBOX_ORIGIN = "https://api.sandbox.bridge.xyz";

/**
 * Solana Devnet values published in Bridge's card sandbox guide.
 * https://apidocs.bridge.xyz/platform/cards/sandbox/sandbox
 * Delegation stays here. It is not part of the generic payment rail.
 */
export const BRIDGE_SOLANA_DEVNET = {
  cluster: "devnet",
  usdcMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  cardProgramId: "cardWArqhdV5jeRXXjUti7cHAa4mj41Nj3Apc6RPZH2",
  merchantId: 1,
  walletType: "standard",
  chain: "solana",
  currency: "usdc",
} as const;

const BLOCKED_REASON = "Bridge Dashboard sign-in returned to the login page and said something went wrong, so no sandbox API key was created.";

export type BridgeAccess = PaymentRailStatus["access"];

export function bridgeSandboxOrigin(requested: string | null): string {
  const value = (requested ?? BRIDGE_SANDBOX_ORIGIN).replace(/\/$/, "");
  return value === BRIDGE_SANDBOX_ORIGIN ? value : BRIDGE_SANDBOX_ORIGIN;
}

export function bridgeAccess(config: Pick<AppConfig, "bridgeApiKey" | "bridgeApiBaseUrl">): PaymentRailStatus {
  const requested = config.bridgeApiBaseUrl.replace(/\/$/, "");
  if (requested !== BRIDGE_SANDBOX_ORIGIN) {
    return railStatus("sandbox_blocked", "Production Bridge is disabled. SuperTab only accepts the sandbox host.");
  }
  if (!config.bridgeApiKey) {
    return railStatus("sandbox_blocked", BLOCKED_REASON);
  }
  return railStatus("sandbox_configured", "A sandbox key is configured. No card has been created and no payment has been sent.");
}

export class BridgeCardRail implements PaymentRail {
  readonly id = "bridge";

  constructor(private readonly config: Pick<AppConfig, "bridgeApiKey" | "bridgeApiBaseUrl">) {}

  status(): PaymentRailStatus {
    return bridgeAccess(this.config);
  }

  preparePayment(): never {
    throw new FinancialExecutionDisabled("submitting a Bridge or Stripe card payment");
  }
}

export function describeSolanaFundingBinding(): {
  chain: "solana";
  cluster: "devnet";
  usdcMint: string;
  cardProgramId: string;
  merchantId: number;
  walletType: "standard";
  ownerAddressRequired: true;
  execution: "disabled";
} {
  return {
    chain: "solana",
    cluster: "devnet",
    usdcMint: BRIDGE_SOLANA_DEVNET.usdcMint,
    cardProgramId: BRIDGE_SOLANA_DEVNET.cardProgramId,
    merchantId: BRIDGE_SOLANA_DEVNET.merchantId,
    walletType: "standard",
    ownerAddressRequired: true,
    execution: "disabled",
  };
}

function railStatus(access: BridgeAccess, message: string): PaymentRailStatus {
  return {
    providerId: "bridge",
    preferredProvider: "Bridge + Stripe Issuing",
    availability: "unavailable",
    access,
    countryEligibility: "unknown",
    kycRequired: "unknown",
    supportedChain: null,
    supportedFundingAsset: "USDC on Solana",
    cardStatus: "not_issued",
    spendingAvailable: false,
    message,
  };
}
