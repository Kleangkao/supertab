export const PURCHASE_APPROVAL_TTL_MS = 15 * 60 * 1000;

export interface PurchaseIntent {
  purchaseId: string;
  merchant: string | null;
  merchantReference: string | null;
  productTitle: string;
  variant: string | null;
  reviewedAmountMinor: bigint;
  maximumAuthorizedAmountMinor: bigint;
  currency: string;
  approvedAt: string;
  expiresAt: string;
  fundingPlanReference: string | null;
  cardRailProvider: "bridge";
}

export class PurchaseApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseApprovalError";
  }
}

export function createPurchaseIntent(input: {
  explicitApproval: boolean;
  purchaseId: string;
  merchant: string | null;
  merchantReference: string | null;
  productTitle: string;
  variant: string | null;
  reviewedAmountMinor: bigint;
  maximumAuthorizedAmountMinor: bigint;
  currency: string;
  approvedAtMs: number;
  expiresAtMs: number;
  fundingPlanReference: string | null;
}): PurchaseIntent {
  if (!input.explicitApproval) {
    throw new PurchaseApprovalError("This purchase has not been approved. A connected wallet is not approval.");
  }
  if (input.reviewedAmountMinor <= 0n || input.maximumAuthorizedAmountMinor <= 0n) {
    throw new PurchaseApprovalError("A purchase approval needs a reviewed amount.");
  }
  if (input.maximumAuthorizedAmountMinor < input.reviewedAmountMinor) {
    throw new PurchaseApprovalError("The approved ceiling is below the reviewed amount.");
  }
  if (input.expiresAtMs <= input.approvedAtMs) {
    throw new PurchaseApprovalError("A purchase approval needs an expiry after approval.");
  }
  return {
    purchaseId: input.purchaseId,
    merchant: input.merchant,
    merchantReference: input.merchantReference,
    productTitle: input.productTitle,
    variant: input.variant,
    reviewedAmountMinor: input.reviewedAmountMinor,
    maximumAuthorizedAmountMinor: input.maximumAuthorizedAmountMinor,
    currency: input.currency.toUpperCase(),
    approvedAt: new Date(input.approvedAtMs).toISOString(),
    expiresAt: new Date(input.expiresAtMs).toISOString(),
    fundingPlanReference: input.fundingPlanReference,
    cardRailProvider: "bridge",
  };
}

export function assertPurchasePayable(intent: PurchaseIntent | null, amountMinor: bigint, nowMs: number): void {
  if (!intent) {
    throw new PurchaseApprovalError("No purchase approval exists. A wallet allowance is not approval.");
  }
  if (nowMs >= Date.parse(intent.expiresAt)) {
    throw new PurchaseApprovalError("This purchase approval has expired.");
  }
  if (amountMinor > intent.maximumAuthorizedAmountMinor) {
    throw new PurchaseApprovalError("The amount is above the approved ceiling.");
  }
}
