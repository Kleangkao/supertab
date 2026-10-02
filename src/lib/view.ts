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
  discountDisplay: string | null;
  merchantTotalDisplay: string | null;
  currency: string | null;
  note: string;
}

export interface PurchaseView {
  state: string;
  checkout: CheckoutView;
  funding: FundingView | null;
  walletMode: "none" | "sample" | "address";
  walletAddress: string | null;
  balanceSource: "none" | "sample" | "chain" | "error";
  balanceError: string | null;
  assets: AssetView[];
  cardRail: {
    availability: "not_connected" | "unavailable" | "ready";
    message: string;
  };
  product: {
    title: string;
    merchant: string | null;
    variant: string | null;
    source: "shopify" | "ebay";
  };
  swapApproval: { at: string; executed: false } | null;
  paymentStatus: "not_authorized";
  orderStatus: "not_created";
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
  cardRail: "not_connected";
  financialExecution: "disabled";
}
