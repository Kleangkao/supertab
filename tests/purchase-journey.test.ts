import { describe, expect, it } from "vitest";
import { purchaseJourneyStages } from "../src/lib/purchase-journey";
import type { PurchaseView } from "../src/lib/view";

function purchase(overrides: Partial<PurchaseView> = {}): PurchaseView {
  return {
    termsId: "terms-1",
    checkoutVerification: { status: "unknown", readAvailable: true, message: "Final total unknown", merchantOrigin: null, verifiedAt: null, expiresAt: null },
    state: "review",
    checkout: { itemDisplay: "$27.00", itemKind: "catalog", quantity: 1, shippingDisplay: null, taxDisplay: null, feeDisplay: null, discountDisplay: null, merchantTotalDisplay: null, currency: "USD", note: "planning" },
    funding: null,
    walletMode: "none",
    walletKind: "none",
    walletAddress: null,
    walletControl: null,
    devnetSigning: null,
    signatureCapability: "disabled",
    transactionVersion: null,
    balanceSource: "none",
    balanceError: null,
    balanceExpiresAt: null,
    assets: [],
    cardRail: { availability: "not_connected", access: "sandbox_blocked", preferredProvider: "bridge", message: "Bridge sandbox blocked" },
    product: { title: "Black Torrey Polo", merchant: "Fresh Clean Threads", variant: "S", source: "shopify" },
    swapApproval: null,
    purchaseApproval: "required",
    paymentStatus: "PAYMENT_NOT_READY",
    orderStatus: "ORDER_NOT_CREATED",
    unsignedTransaction: "not_requested",
    amountKind: "planning_amount",
    finalTotal: "unknown",
    merchantStatement: null,
    financialExecution: "disabled",
    ...overrides,
  };
}

describe("purchase journey stages", () => {
  it("keeps live discovery separate from blocked payment and order stages", () => {
    const stages = purchaseJourneyStages({ hasSelectedOffer: true, purchase: purchase() });
    expect(stages.find((stage) => stage.id === "compare")?.evidence).toBe("live");
    expect(stages.find((stage) => stage.id === "pay")?.evidence).toBe("blocked");
    expect(stages.find((stage) => stage.id === "order")?.evidence).toBe("blocked");
    expect(stages.find((stage) => stage.id === "terms")?.evidence).toBe("blocked");
  });

  it("marks verified terms and labels an active rehearsal as simulated payment", () => {
    const stages = purchaseJourneyStages({
      hasSelectedOffer: true,
      rehearsalActive: true,
      purchase: purchase({
        finalTotal: "verified",
        purchaseApproval: "approved",
        walletKind: "read_only",
        balanceSource: "chain",
        checkoutVerification: { status: "verified", readAvailable: true, message: "verified", merchantOrigin: "https://merchant.test", verifiedAt: "2026-10-09T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z" },
        funding: {
          payableKnown: true, planningBasis: "merchant", merchantTotalKnown: true, planningDisplay: "$35.00",
          existingUsdc: "0.00 USDC", usdcUsed: "0.00 USDC", deficit: "35.00 USDC", reserve: "0.01 SOL",
          candidateSymbol: "SOL", candidateMint: "So11111111111111111111111111111111111111112",
          requiredInput: "0.2 SOL", expectedOutput: "35.10 USDC", minimumOutput: "34.90 USDC",
          priceImpact: "0.1%", slippageBps: 50, platformFee: null, quoteFreshness: "fresh",
          quoteExpiresAt: "2099-01-01T00:00:00.000Z", fundable: true, readiness: "needs_conversion", notes: [],
        },
      }),
    });
    expect(stages.find((stage) => stage.id === "terms")?.evidence).toBe("implemented");
    expect(stages.find((stage) => stage.id === "funding")?.evidence).toBe("live");
    expect(stages.find((stage) => stage.id === "pay")?.evidence).toBe("simulated");
    expect(stages.find((stage) => stage.id === "order")?.evidence).toBe("simulated");
  });
});
