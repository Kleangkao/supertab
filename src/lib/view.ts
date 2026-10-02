export interface OfferView {
  id: string;
  source: "shopify" | "ebay";
  sourceItemId: string;
  merchant: string | null;
  title: string;
  descriptionSummary: string | null;
  imageUrl: string | null;
  priceDisplay: string | null;
  priceMinor: string | null;
  currency: string | null;
  priceKind: "catalog" | "listing" | null;
  availability: "in_stock" | "out_of_stock" | "unknown";
  variantLabel: string | null;
  condition: string | null;
  shippingSummary: string | null;
  shippingDisplay: string | null;
  productUrl: string | null;
  checkoutLabel: string;
  merchantReviewUrl: string | null;
  verifiedAt: string;
}

export interface ExcludedOfferView {
  offer: OfferView;
  reasons: string[];
}

export interface AssetView {
  mint: string;
  symbol: string | null;
  name: string | null;
  amountDisplay: string;
  amountBase: string;
  decimals: number;
  kind: "native" | "stablecoin" | "spl";
  isUsdc: boolean;
  routeKnown: boolean;
}

export interface FundingView {
  payableKnown: boolean;
  planningBasis: string;
  merchantTotalKnown: boolean;
  planningDisplay: string | null;
  existingUsdc: string;
  usdcUsed: string;
  deficit: string;
  reserve: string;
  candidateSymbol: string | null;
  candidateMint: string | null;
  requiredInput: string | null;
  expectedOutput: string | null;
  minimumOutput: string | null;
  priceImpact: string | null;
  slippageBps: number | null;
  platformFee: string | null;
  quoteFreshness: string;
  quoteExpiresAt: string | null;
  fundable: boolean;
  readiness: string;
  notes: string[];
}

export interface CheckoutView {
  itemDisplay: string | null;
  itemKind: string | null;
  quantity: number;
  shippingDisplay: string | null;
  taxDisplay: string | null;
  feeDisplay: string | null;
  discountDisplay: string | null;
  merchantTotalDisplay: string | null;
  currency: string | null;
  note: string;
}

export interface PurchaseView {
  termsId: string;
  checkoutVerification: {
    status: "unknown" | "verified";
    readAvailable: boolean;
    message: string;
    merchantOrigin: string | null;
    verifiedAt: string | null;
    expiresAt: string | null;
  };
  state: string;
  checkout: CheckoutView;
  funding: FundingView | null;
  walletMode: "none" | "sample" | "address" | "connected";
  walletKind: "none" | "sample" | "read_only" | "connected";
  walletAddress: string | null;
  walletControl: { verifiedAt: string; expiresAt: string } | null;
  signatureCapability: "disabled" | "available" | "unavailable";
  transactionVersion: "legacy" | "v0" | null;
  balanceSource: "none" | "sample" | "chain" | "error";
  balanceError: string | null;
  assets: AssetView[];
  cardRail: {
    availability: "not_connected" | "unavailable" | "ready";
    access: "not_connected" | "sandbox_not_configured" | "sandbox_blocked" | "sandbox_configured" | "sandbox_live";
    preferredProvider: string | null;
    message: string;
  };
  product: {
    title: string;
    merchant: string | null;
    variant: string | null;
    source: "shopify" | "ebay";
  };
  swapApproval: { at: string; executed: false } | null;
  purchaseApproval: "required" | "approved" | "expired";
  paymentStatus: "PAYMENT_NOT_READY" | "PAYMENT_READY" | "PAYMENT_APPROVAL_REQUIRED" | "PAYMENT_PENDING" | "PAYMENT_AUTHORIZED" | "PAYMENT_CAPTURED" | "PAYMENT_FAILED" | "PAYMENT_REVERSED" | "REFUND_PENDING" | "PAYMENT_REFUNDED";
  orderStatus: "ORDER_NOT_CREATED" | "ORDER_PENDING" | "ORDER_CONFIRMED" | "ORDER_EXCEPTION";
  unsignedTransaction: "not_requested" | "prepared";
  amountKind: "planning_amount" | "merchant_checkout_total";
  finalTotal: "unknown" | "verified";
  financialExecution: "disabled";
}

export interface ProviderNote {
  provider: "shopify" | "ebay";
  status: string;
  message?: string;
}

export interface SessionView {
  sessionId: string;
  assistantMessage: string;
  constraintsLabel: string;
  messages: { role: "user" | "assistant"; text: string }[];
  exact: OfferView[];
  excluded: ExcludedOfferView[];
  providers: ProviderNote[];
  gemini: "used" | "fallback" | "busy" | "not_configured";
  selectedOfferId: string | null;
  purchase: PurchaseView | null;
}

export interface HealthView {
  gemini: "configured" | "not_configured";
  geminiModel: string;
  shopify: "configured" | "not_configured";
  ebay: "configured" | "not_configured";
  solana: "available" | "unavailable";
  dflow: "not_configured" | "available" | "authenticated" | "live_quote" | "unavailable";
  cardRail: "not_connected" | "sandbox_not_configured" | "sandbox_blocked" | "sandbox_configured" | "sandbox_live";
  financialExecution: "disabled";
}
