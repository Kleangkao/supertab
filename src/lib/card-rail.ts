export type RailAvailability = "not_connected" | "unavailable" | "ready";

export interface PaymentRailStatus {
  providerId: string | null;
  availability: RailAvailability;
  countryEligibility: "unknown";
  kycRequired: "unknown";
  supportedChain: null;
  supportedFundingAsset: "USDC on Solana" | null;
  cardStatus: "not_issued";
  spendingAvailable: false;
  message: string;
}

export interface PaymentRail {
  readonly id: string;
  status(): PaymentRailStatus;
  preparePayment(): never;
}

export class UnavailablePaymentRail implements PaymentRail {
  readonly id = "unconnected";

  status(): PaymentRailStatus {
    return {
      providerId: null,
      availability: "not_connected",
      countryEligibility: "unknown",
      kycRequired: "unknown",
      supportedChain: null,
      supportedFundingAsset: null,
      cardStatus: "not_issued",
      spendingAvailable: false,
      message: "Connect a supported wallet-backed spending card to complete this merchant payment.",
    };
  }

  preparePayment(): never {
    throw new Error("Payment rail is not connected.");
  }
}

export function assertPaymentCanStart(rail: PaymentRail): void {
  const status = rail.status();
  if (status.availability !== "ready" || !status.spendingAvailable) {
    throw new Error("Payment cannot start until a spending card is connected and ready.");
  }
}
