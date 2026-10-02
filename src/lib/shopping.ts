import { readConfig, type AppConfig } from "./config";
import { buildSearchQuery, describeConstraints, emptyConstraints, resolveConstraints, type ConstraintPatch, type ShoppingConstraints } from "./constraints";
import { bindQuote, fetchPreparedTransaction, quoteInputForTargetOutput, type DflowClientOptions } from "./dflow";
import { searchEbay } from "./ebay";
import { knownPlanningMinor, planFunding, quoteIsUsable, type BoundQuote, type FundingPlan } from "./funding-planner";
import { payableFromOffer, type NormalizedOffer, type PayableSnapshot } from "./offers";
import { classifyOffers } from "./filter-offers";
import { transitionPurchase, type PurchaseState } from "./purchase";
import { BridgeCardRail } from "./bridge-rail";
import type { PaymentRailStatus } from "./card-rail";
import { createPurchaseIntent, PurchaseApprovalError, PURCHASE_APPROVAL_TTL_MS, type PurchaseIntent } from "./purchase-intent";
import { paymentStateFor, type OrderState } from "./payment-lifecycle";
import { searchShopify } from "./shopify";
import { extractConstraintPatch, GeminiBusyError } from "./gemini";
import {
  dflowInputMint,
  sampleSpendingAssets,
  type AssetBalance,
} from "./tokens";
import { createReadOnlyWallet } from "./wallet";
import { usdMinorToUsdcBase } from "./money";
import { USDC_DECIMALS } from "./tokens";
import {
  toAssetView,
  toCheckoutView,
  toFundingView,
  toOfferView,
} from "./serialize";
import type { ProviderNote, PurchaseView, SessionView } from "./view";

export interface ShoppingDependencies {
  config: AppConfig;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

interface SessionRecord {
  id: string;
  messages: { role: "user" | "assistant"; text: string }[];
  constraints: ShoppingConstraints;
  offers: NormalizedOffer[];
  excluded: { id: string; reasons: string[] }[];
  providers: ProviderNote[];
  assistantMessage: string;
  gemini: SessionView["gemini"];
  selectedOfferId: string | null;
  quantity: number;
  walletMode: "none" | "sample" | "address" | "connected";
  signatureCapability: "disabled" | "available" | "unavailable";
  walletAddress: string | null;
  balances: AssetBalance[];
  balanceSource: PurchaseView["balanceSource"];
  balanceError: string | null;
  snapshot: PayableSnapshot | null;
  quote: BoundQuote | null;
  plan: FundingPlan | null;
  state: PurchaseState;
  swapApproval: { at: string; executed: false } | null;
  purchaseIntent: PurchaseIntent | null;
  unsignedTransaction: "not_requested" | "prepared";
  transactionVersion: "legacy" | "v0" | null;
}

export class ShoppingService {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly turns = new Map<string, Promise<SessionView>>();
  private readonly rail: BridgeCardRail;

  constructor(private readonly deps: ShoppingDependencies) {
    this.rail = new BridgeCardRail(deps.config);
  }

  async converse(sessionId: string | null, message: string): Promise<SessionView> {
    const text = message.trim();
    if (!text) throw new Error("Tell SuperTab what you want to buy.");
    const session = this.session(sessionId);
    const previous = this.turns.get(session.id) ?? Promise.resolve();
    const turn = previous.then(() => this.completeTurn(this.requireSession(session.id), text), () => this.completeTurn(this.requireSession(session.id), text));
    this.turns.set(session.id, turn);
    try {
      return await turn;
    } finally {
      if (this.turns.get(session.id) === turn) this.turns.delete(session.id);
    }
  }

  private async completeTurn(current: SessionRecord, text: string): Promise<SessionView> {
    const session: SessionRecord = { ...current, messages: [...current.messages],
      selectedOfferId: null, snapshot: null, plan: null, quote: null, swapApproval: null,
      purchaseIntent: null, unsignedTransaction: "not_requested", transactionVersion: null, state: "DISCOVERING" };
    this.sessions.set(session.id, session);
    session.messages.push({ role: "user", text });
    const gemini = await this.modelPatch(session, text);
    session.constraints = resolveConstraints(session.constraints, text, gemini.patch);
    session.gemini = gemini.status;
    const query = buildSearchQuery(session.constraints);
    const shipTo = session.constraints.shipToCountry ?? this.deps.config.shopifyShipTo;
    const [shopify, ebay] = await Promise.all([
      searchShopify({
        query: query || text,
        maxPriceCents: session.constraints.maxPriceCents,
        shipToCountry: shipTo,
        limit: 8,
      }, {
        enabled: this.deps.config.shopifyEnabled,
        endpoint: this.deps.config.shopifyCatalogUrl,
        profileUrl: this.deps.config.shopifyProfile,
        fetchImpl: this.deps.fetchImpl,
        now: this.deps.now,
      }),
      searchEbay({
        query: query || text,
        maxPriceCents: session.constraints.maxPriceCents,
        limit: 8,
      }, {
        clientId: this.deps.config.ebayClientId,
        clientSecret: this.deps.config.ebayClientSecret,
        environment: this.deps.config.ebayEnvironment,
        marketplaceId: this.deps.config.ebayMarketplaceId,
        fetchImpl: this.deps.fetchImpl,
        now: this.deps.now,
      }),
    ]);
    const classified = classifyOffers([...shopify.offers, ...ebay.offers], session.constraints);
    if (this.sessions.get(session.id) !== session) return this.view(this.requireSession(session.id));
    session.offers = classified.exact;
    session.excluded = classified.excluded.map((item) => ({ id: item.offer.id, reasons: item.reasons }));
    this.rememberExcluded(session, classified.excluded.map((item) => item.offer));
    session.providers = [shopify, ebay].map((result) => ({
      provider: result.provider,
      status: result.status,
      message: result.message,
    }));
    session.selectedOfferId = null;
    session.snapshot = null;
    session.quote = null;
    session.plan = null;
    session.state = "DISCOVERING";
    session.swapApproval = null;
    session.assistantMessage = assistantCopy({
      constraints: session.constraints,
      exact: classified.exact.length,
      excluded: classified.excluded.length,
      providers: session.providers,
      gemini: session.gemini,
    });
    session.messages.push({ role: "assistant", text: session.assistantMessage });
    return this.view(session);
  }

  async review(input: {
    sessionId: string;
    offerId: string;
    quantity?: number;
    walletMode: "none" | "sample" | "address" | "connected";
    address?: string;
    fundingMint?: string | null;
    signatureAvailable?: boolean;
  }): Promise<SessionView> {
    // Each review owns a separate working record. A slower wallet/quote read
    // must never mutate a newer review (including a clear-wallet action).
    const session: SessionRecord = { ...this.requireSession(input.sessionId), balances: [] as AssetBalance[],
      balanceSource: "none" as PurchaseView["balanceSource"], balanceError: null,
      walletAddress: null, plan: null, swapApproval: null, state: "OFFER_SELECTED" as PurchaseState };
    const excluded = this.excludedOffers.get(session.id);
    const offer = session.offers.find((item) => item.id === input.offerId) ?? excluded?.get(input.offerId);
    if (!offer) throw new Error("That product is no longer in this search. Search again.");
    if (session.excluded.some((item) => item.id === offer.id)) {
      throw new Error("That listing misses a requirement, so it cannot be selected.");
    }
    session.selectedOfferId = offer.id;
    session.purchaseIntent = null;
    // A new wallet, product, balance read or explicit refresh needs its own quote.
    session.quote = null;
    session.unsignedTransaction = "not_requested";
    session.transactionVersion = null;
    session.quantity = input.quantity && input.quantity > 0 && input.quantity <= 20 ? input.quantity : 1;
    session.walletMode = input.walletMode;
    session.signatureCapability = input.walletMode === "connected"
      ? (input.signatureAvailable ? "available" : "unavailable")
      : "disabled";
    session.snapshot = payableFromOffer(offer, session.quantity);
    this.sessions.set(session.id, session);
    await this.loadBalances(session, input.address);
    if (this.sessions.get(session.id) !== session) return this.view(this.requireSession(session.id));
    const fundingMint = input.fundingMint ?? null;
    const planningMinor = knownPlanningMinor(session.snapshot);
    const candidate = this.candidateFor(session.balances, fundingMint);
    const dflowMint = candidate ? dflowInputMint(candidate) : null;
    const freshness = quoteIsUsable(session.quote, planningMinor, dflowMint, this.nowMs());
    if (freshness !== "live") session.quote = null;
    if (session.quote == null && dflowMint && planningMinor != null && candidate) {
      const required = usdMinorToUsdcBase(planningMinor, session.snapshot.itemExponent, USDC_DECIMALS);
      const existing = session.balances.find((balance) => balance.isUsdc && balance.decimals === USDC_DECIMALS)?.amount ?? 0n;
      const deficit = required > existing ? required - existing : 0n;
      if (deficit > 0n) {
        session.quote = await this.quoteDeficit(candidate, dflowMint, deficit, planningMinor);
        const stored = session.balances.find((balance) => balance.mint === candidate.mint);
        if (stored && session.quote) stored.routeKnown = true;
      }
    }
    session.plan = planFunding({
      snapshot: session.snapshot,
      balances: session.balances,
      selectedFundingMint: fundingMint ?? candidate?.mint ?? null,
      quote: session.quote,
      nowMs: this.nowMs(),
    });
    if (session.quote && session.plan.quoteFreshness === "live" && session.plan.candidateMint) {
      const quotedAsset = session.balances.find((balance) => balance.mint === session.plan?.candidateMint);
      if (quotedAsset) quotedAsset.routeKnown = true;
    }
    session.state = this.stateFor(session.plan);
    session.swapApproval = null;
    const prepared = await this.prepareUnsigned(session);
    if (this.sessions.get(session.id) !== session) return this.view(this.requireSession(session.id));
    session.unsignedTransaction = prepared.status;
    session.transactionVersion = prepared.version;
    if (prepared.status === "prepared" && session.state === "SWAP_QUOTE_READY") {
      session.state = transitionPurchase(session.state, "AWAITING_SWAP_APPROVAL");
    }
    return this.view(session);
  }

  getSession(sessionId: string): SessionView {
    return this.view(this.requireSession(sessionId));
  }

  async approve(sessionId: string): Promise<SessionView> {
    const session = this.requireSession(sessionId);
    if (session.state !== "SWAP_QUOTE_READY" && session.state !== "AWAITING_SWAP_APPROVAL") {
      throw new Error("There is no live conversion quote to approve.");
    }
    if (quoteIsUsable(session.quote, session.snapshot ? knownPlanningMinor(session.snapshot) : null, session.quote?.inputMint ?? null, this.nowMs()) !== "live") {
      throw new Error("The conversion quote expired. Refresh it before reviewing approval.");
    }
    if (session.state === "SWAP_QUOTE_READY") {
      session.state = transitionPurchase(session.state, "AWAITING_SWAP_APPROVAL");
    }
    session.swapApproval = { at: new Date(this.nowMs()).toISOString(), executed: false };
    // Approval records the displayed quote. Preparing again would silently
    // replace the approved terms; refresh must require a separate review.
    return this.view(session);
  }

  async approvePurchase(sessionId: string): Promise<SessionView> {
    const session = this.requireSession(sessionId);
    const offer = this.selectedOffer(session);
    if (!session.snapshot?.merchantTotalKnown || session.snapshot.merchantTotalMinor == null) {
      throw new PurchaseApprovalError("The final merchant checkout total must be verified before approving this purchase. A planning amount is not a final checkout total.");
    }
    const amount = session.snapshot.merchantTotalMinor;
    if (!offer || amount == null) throw new Error("There is no reviewed amount to approve.");
    const now = this.nowMs();
    session.purchaseIntent = createPurchaseIntent({
      explicitApproval: true,
      purchaseId: session.id,
      merchant: offer.merchant,
      merchantReference: offer.productUrl,
      productTitle: offer.title,
      variant: offer.variantLabel,
      reviewedAmountMinor: amount,
      maximumAuthorizedAmountMinor: amount,
      currency: session.snapshot?.currency ?? "USD",
      approvedAtMs: now,
      expiresAtMs: now + PURCHASE_APPROVAL_TTL_MS,
      fundingPlanReference: session.plan ? `funding:${amount.toString()}` : null,
      cardRailProvider: this.rail.id,
    });
    return this.view(session);
  }

  private selectedOffer(session: SessionRecord): NormalizedOffer | null {
    if (!session.selectedOfferId) return null;
    return session.offers.find((item) => item.id === session.selectedOfferId)
      ?? this.excludedOffers.get(session.id)?.get(session.selectedOfferId)
      ?? null;
  }

  private async prepareUnsigned(session: SessionRecord): Promise<{ status: "not_requested" | "prepared"; version: "legacy" | "v0" | null }> {
    if (session.walletMode === "sample" || !session.walletAddress || !session.quote || !session.plan?.fundable) {
      return { status: "not_requested", version: null };
    }
    try {
      const prepared = await fetchPreparedTransaction({
        inputMint: session.quote.inputMint,
        outputMint: session.quote.outputMint,
        amount: session.quote.inAmount,
        userPublicKey: session.walletAddress,
      }, {
        baseUrl: this.deps.config.dflowBaseUrl,
        apiKey: this.deps.config.dflowApiKey ?? undefined,
        slippageBps: this.deps.config.dflowSlippageBps,
        fetchImpl: this.deps.fetchImpl,
      });
      if (prepared.prepared && session.snapshot) {
        session.quote = bindQuote({ quote: prepared.quote, payableMinor: knownPlanningMinor(session.snapshot)!,
          fundingMint: prepared.quote.inputMint, inputDecimals: session.quote.inputDecimals,
          outputDecimals: USDC_DECIMALS, nowMs: this.nowMs() });
      }
      return prepared.prepared
        ? { status: "prepared", version: prepared.version }
        : { status: "not_requested", version: null };
    } catch {
      return { status: "not_requested", version: null };
    }
  }

  private async quoteDeficit(
    candidate: AssetBalance,
    inputMint: string,
    deficit: bigint,
    planningMinor: bigint,
  ): Promise<BoundQuote | null> {
    const spendable = candidate.kind === "native"
      ? (candidate.amount > 10_000_000n ? candidate.amount - 10_000_000n : 0n)
      : candidate.amount;
    if (spendable <= 0n) return null;
    const options: DflowClientOptions = {
      baseUrl: this.deps.config.dflowBaseUrl,
      apiKey: this.deps.config.dflowApiKey ?? undefined,
      slippageBps: this.deps.config.dflowSlippageBps,
      fetchImpl: this.deps.fetchImpl,
    };
    try {
      const result = await quoteInputForTargetOutput({
        inputMint,
        inputDecimals: candidate.decimals,
        spendable,
        targetOut: deficit,
        options,
      });
      if (!result.quote) return null;
      return bindQuote({
        quote: result.quote,
        payableMinor: planningMinor,
        fundingMint: inputMint,
        inputDecimals: candidate.decimals,
        outputDecimals: USDC_DECIMALS,
        nowMs: this.nowMs(),
      });
    } catch {
      return null;
    }
  }

  private stateFor(plan: FundingPlan): PurchaseState {
    let state: PurchaseState = "OFFER_SELECTED";
    state = transitionPurchase(state, "CHECKOUT_PREPARING");
    state = transitionPurchase(state, "CHECKOUT_READY");
    state = transitionPurchase(state, "FUNDING_ANALYZED");
    if (plan.readiness === "covered_by_usdc") {
      state = transitionPurchase(state, "FUNDS_READY");
      state = transitionPurchase(state, "PAYMENT_RAIL_UNAVAILABLE");
    } else if (plan.quoteFreshness === "live" && plan.fundable) {
      state = transitionPurchase(state, "SWAP_QUOTE_READY", { quoteFresh: true });
    }
    return state;
  }

  private async loadBalances(session: SessionRecord, address: string | undefined): Promise<void> {
    session.balanceError = null;
    if (session.walletMode === "sample") {
      session.walletAddress = null;
      session.balances = sampleSpendingAssets();
      session.balanceSource = "sample";
      return;
    }
    if ((session.walletMode === "address" || session.walletMode === "connected") && address?.trim()) {
      try {
        const wallet = createReadOnlyWallet({
          rpcUrl: this.deps.config.solanaRpcUrl,
          cluster: this.deps.config.solanaCluster,
          customRpc: this.deps.config.solanaRpcCustom,
          fetchImpl: this.deps.fetchImpl,
        });
        session.balances = await wallet.getBalances(address.trim());
        session.walletAddress = address.trim();
        session.balanceSource = "chain";
        if (wallet.prepareTransaction().status !== "disabled" || wallet.requestSignature().status !== "disabled") {
          throw new Error("Wallet signing must stay disabled.");
        }
      } catch (error) {
        session.balances = [];
        session.balanceSource = "error";
        session.balanceError = error instanceof Error ? error.message : "The address could not be read.";
        session.walletAddress = address.trim();
      }
      return;
    }
    session.walletMode = "none";
    session.walletAddress = null;
    session.balances = [];
    session.balanceSource = "none";
  }

  private candidateFor(balances: AssetBalance[], fundingMint: string | null): AssetBalance | null {
    if (fundingMint) return balances.find((balance) => balance.mint === fundingMint && !balance.isUsdc) ?? null;
    return balances.find((balance) => balance.kind === "native") ?? null;
  }

  private async modelPatch(session: SessionRecord, message: string): Promise<{ patch: ConstraintPatch | null; status: SessionView["gemini"] }> {
    if (!this.deps.config.geminiApiKey) return { patch: null, status: "not_configured" };
    try {
      const patch = await extractConstraintPatch({
        apiKey: this.deps.config.geminiApiKey,
        model: this.deps.config.geminiModel,
        message,
        current: session.constraints,
        history: session.messages,
        fetchImpl: this.deps.fetchImpl,
      });
      return { patch, status: patch ? "used" : "fallback" };
    } catch (error) {
      return { patch: null, status: error instanceof GeminiBusyError ? "busy" : "fallback" };
    }
  }

  private session(sessionId: string | null): SessionRecord {
    if (sessionId && this.sessions.has(sessionId)) return this.sessions.get(sessionId)!;
    const id = sessionId && sessionId.length > 8 ? sessionId : crypto.randomUUID();
    const record = emptySession(id);
    this.sessions.set(id, record);
    return record;
  }

  private requireSession(sessionId: string): SessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("This shopping session expired. Start a new search.");
    return session;
  }

  private nowMs(): number {
    return (this.deps.now ?? (() => new Date()))().getTime();
  }

  private excludedOffers = new Map<string, Map<string, NormalizedOffer>>();

  private rememberExcluded(session: SessionRecord, offers: NormalizedOffer[]): void {
    const map = new Map<string, NormalizedOffer>();
    for (const offer of offers) map.set(offer.id, offer);
    this.excludedOffers.set(session.id, map);
  }

  private view(session: SessionRecord): SessionView {
    if (session.snapshot && session.plan) {
      session.plan = planFunding({ snapshot: session.snapshot, balances: session.balances,
        selectedFundingMint: session.plan.candidateMint, quote: session.quote, nowMs: this.nowMs() });
      if ((session.plan.quoteFreshness !== "live" || !session.plan.fundable) && (session.state === "SWAP_QUOTE_READY" || session.state === "AWAITING_SWAP_APPROVAL")) {
        session.state = "FUNDING_ANALYZED";
        session.unsignedTransaction = "not_requested";
        session.transactionVersion = null;
        session.swapApproval = null;
      }
    }
    const excludedOffers = this.excludedOffers.get(session.id) ?? new Map<string, NormalizedOffer>();
    const rail: PaymentRailStatus = this.rail.status();
    return {
      sessionId: session.id,
      assistantMessage: session.assistantMessage,
      constraintsLabel: describeConstraints(session.constraints) || "No constraints yet",
      messages: session.messages,
      exact: session.offers.map(toOfferView),
      excluded: session.excluded.flatMap((item) => {
        const offer = excludedOffers.get(item.id);
        return offer ? [{ offer: toOfferView(offer), reasons: item.reasons }] : [];
      }),
      providers: session.providers,
      gemini: session.gemini,
      selectedOfferId: session.selectedOfferId,
      purchase: session.snapshot && session.selectedOfferId ? {
        state: session.state,
        checkout: toCheckoutView(session.snapshot),
        funding: session.plan ? toFundingView(session.plan) : null,
        walletMode: session.walletMode,
        walletKind: session.walletMode === "sample"
          ? "sample"
          : session.walletMode === "connected"
            ? "connected"
            : session.walletMode === "address" ? "read_only" : "none",
        walletAddress: session.walletAddress,
        signatureCapability: session.signatureCapability,
        transactionVersion: session.transactionVersion,
        balanceSource: session.balanceSource,
        balanceError: session.balanceError,
        assets: session.balances.map(toAssetView),
        cardRail: {
          availability: rail.availability,
          access: rail.access,
          preferredProvider: rail.preferredProvider,
          message: rail.message,
        },
        product: {
          title: (session.offers.find((item) => item.id === session.selectedOfferId) ?? [...(this.excludedOffers.get(session.id)?.values() ?? [])].find((item) => item.id === session.selectedOfferId))?.title ?? "Selected product",
          merchant: (session.offers.find((item) => item.id === session.selectedOfferId))?.merchant ?? null,
          variant: (session.offers.find((item) => item.id === session.selectedOfferId))?.variantLabel ?? null,
          source: (session.offers.find((item) => item.id === session.selectedOfferId))?.source ?? "shopify",
        },
        swapApproval: session.swapApproval,
        purchaseApproval: approvalLabel(session.purchaseIntent, this.nowMs()),
        paymentStatus: paymentStateFor({
          hasOffer: true,
          finalTotalKnown: session.snapshot.merchantTotalKnown,
          fundsReady: session.balanceSource === "chain" && session.plan?.readiness === "covered_by_usdc",
          approved: session.purchaseIntent != null,
          expired: session.purchaseIntent != null && this.nowMs() >= Date.parse(session.purchaseIntent.expiresAt),
          railReady: rail.availability === "ready" && rail.spendingAvailable,
        }),
        orderStatus: "ORDER_NOT_CREATED" satisfies OrderState,
        unsignedTransaction: session.unsignedTransaction,
        amountKind: "planning_amount",
        finalTotal: "unknown",
        financialExecution: "disabled",
      } : null,
    };
  }
}

function emptySession(id: string): SessionRecord {
  return {
    id,
    messages: [],
    constraints: emptyConstraints(),
    offers: [],
    excluded: [],
    providers: [],
    assistantMessage: "",
    gemini: "not_configured",
    selectedOfferId: null,
    quantity: 1,
    walletMode: "none",
    signatureCapability: "disabled",
    walletAddress: null,
    balances: [],
    balanceSource: "none",
    balanceError: null,
    snapshot: null,
    quote: null,
    plan: null,
    state: "DISCOVERING",
    swapApproval: null,
    purchaseIntent: null,
    unsignedTransaction: "not_requested",
    transactionVersion: null,
  };
}

function approvalLabel(intent: PurchaseIntent | null, nowMs: number): "required" | "approved" | "expired" {
  if (!intent) return "required";
  return nowMs >= Date.parse(intent.expiresAt) ? "expired" : "approved";
}

function assistantCopy(input: {
  constraints: ShoppingConstraints;
  exact: number;
  excluded: number;
  providers: ProviderNote[];
  gemini: SessionView["gemini"];
}): string {
  const looking = describeConstraints(input.constraints);
  const lead = input.gemini === "busy"
    ? "The shopping assistant is briefly busy, so I used the words in your message."
    : input.gemini === "fallback"
      ? "I couldn't reach the shopping assistant, so I used the words in your message."
      : input.gemini === "not_configured"
        ? "I used the words in your message."
        : "I kept the requirements from your message.";
  const match = input.exact === 0
    ? input.excluded > 0
      ? "No listing matched every requirement."
      : "No products came back from the stores that are connected."
    : `I found ${input.exact} ${input.exact === 1 ? "listing that matches" : "listings that match"}${looking ? `: ${looking}` : ""}.`;
  const notes = input.providers
    .filter((provider) => provider.status !== "ok" && provider.message)
    .map((provider) => provider.message);
  return [lead, match, ...notes].filter(Boolean).join(" ");
}

const globalStore = globalThis as { __supertab?: ShoppingService; __supertabStamp?: string };

export function configStamp(config: AppConfig): string {
  return [
    config.geminiApiKey ? "gemini" : "",
    config.ebayClientId && config.ebayClientSecret ? "ebay" : "",
    config.shopifyEnabled ? "shopify" : "",
    config.dflowApiKey ? "dflow" : "",
    config.solanaRpcCustom ? "rpc" : "",
    config.geminiModel,
    config.bridgeApiKey ? "bridge" : "",
    config.dflowBaseUrl,
    config.ebayEnvironment,
  ].join("|");
}

export function getShoppingService(): ShoppingService {
  const config = readConfig();
  const stamp = configStamp(config);
  if (!globalStore.__supertab || globalStore.__supertabStamp !== stamp) {
    globalStore.__supertab = new ShoppingService({ config });
    globalStore.__supertabStamp = stamp;
  }
  return globalStore.__supertab;
}
