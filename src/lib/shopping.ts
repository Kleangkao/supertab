import { createHash } from "node:crypto";
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
  toStatementView,
} from "./serialize";
import type { ProviderNote, PurchaseView, SessionView } from "./view";
import { checkoutAccess, prepareMerchantCheckout, readMerchantCheckout, type CheckoutEvidence } from "./merchant-checkout";
import { createWalletChallenge, verifyWalletChallenge, type WalletChallenge } from "./wallet-proof";
import { prepareDevnetCheck, verifyDevnetCheck } from "./devnet-signing";
import type { DevnetSigningCheck } from "./devnet-memo";

export const BALANCE_FRESHNESS_MS = 60_000;

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
  walletChallenge: WalletChallenge | null;
  walletProof: { verifiedAt: string; expiresAt: string } | null;
  devnetCheck: DevnetSigningCheck | null;
  devnetSigning: { verifiedAt: string; chain: "solana:devnet"; broadcast: false } | null;
  balances: AssetBalance[];
  balanceSource: PurchaseView["balanceSource"];
  balanceError: string | null;
  balanceReadAtMs: number | null;
  snapshot: PayableSnapshot | null;
  checkoutEvidence: CheckoutEvidence | null;
  termsId: string;
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
      checkoutEvidence: null, termsId: crypto.randomUUID(), walletChallenge: null, walletProof: null, devnetCheck: null, devnetSigning: null,
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
    const current = this.requireSession(input.sessionId);
    const session: SessionRecord = { ...current, balances: [] as AssetBalance[],
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
    session.walletChallenge = null;
    session.walletProof = null;
    session.devnetCheck = null;
    session.devnetSigning = null;
    // A new wallet, product, balance read or explicit refresh needs its own quote.
    session.quote = null;
    session.unsignedTransaction = "not_requested";
    session.transactionVersion = null;
    session.quantity = Number.isInteger(input.quantity) && input.quantity! > 0 && input.quantity! <= 20 ? input.quantity! : 1;
    session.walletMode = input.walletMode;
    session.signatureCapability = input.walletMode === "connected"
      ? (input.signatureAvailable ? "available" : "unavailable")
      : "disabled";
    session.checkoutEvidence = current.selectedOfferId === offer.id && current.quantity === session.quantity
      && current.checkoutEvidence && current.checkoutEvidence.expiresAtMs > this.nowMs() ? current.checkoutEvidence : null;
    session.snapshot = session.checkoutEvidence?.snapshot ?? payableFromOffer(offer, session.quantity);
    session.termsId = crypto.randomUUID();
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

  /** A signature with no selected product. It does not approve a purchase. */
  beginWalletControl(address: string, origin: string): { sessionId: string; termsId: string; challenge: WalletChallenge } {
    const session = emptySession(crypto.randomUUID());
    session.walletMode = "connected";
    session.walletAddress = address;
    session.signatureCapability = "available";
    session.assistantMessage = "This wallet check is separate from any product or payment.";
    session.walletChallenge = createWalletChallenge({ sessionId: session.id, termsId: session.termsId, origin, address, nowMs: this.nowMs() });
    this.sessions.set(session.id, session);
    return { sessionId: session.id, termsId: session.termsId, challenge: session.walletChallenge };
  }

  requestWalletCheck(sessionId: string, termsId: string, origin: string): WalletChallenge {
    const session = this.requireSession(sessionId);
    if (session.walletMode !== "connected" || !session.walletAddress || session.termsId !== termsId) {
      throw new Error("Reconnect your wallet and review the current product first.");
    }
    session.walletProof = null;
    session.devnetCheck = null; session.devnetSigning = null;
    session.walletChallenge = createWalletChallenge({ sessionId, termsId, origin,
      address: session.walletAddress, nowMs: this.nowMs() });
    return session.walletChallenge;
  }

  confirmWalletCheck(sessionId: string, termsId: string, challengeId: string, signature: string): SessionView {
    const session = this.requireSession(sessionId);
    const challenge = session.walletChallenge;
    // Consume every attempt, including rejected signatures. No signature is stored.
    session.walletChallenge = null;
    if (!challenge || session.walletMode !== "connected" || !session.walletAddress || session.termsId !== termsId) {
      throw new Error("This wallet check is no longer current. Request a new check.");
    }
    verifyWalletChallenge(challenge, { termsId, challengeId, signature,
      address: session.walletAddress, nowMs: this.nowMs() });
    session.walletProof = { verifiedAt: new Date(this.nowMs()).toISOString(), expiresAt: challenge.expiresAt };
    return this.view(session);
  }

  async prepareDevnetSigning(sessionId: string, termsId: string, origin: string): Promise<DevnetSigningCheck> {
    const current = this.requireSession(sessionId);
    this.requireWalletControl(current, termsId);
    const session: SessionRecord = { ...current, devnetCheck: null, devnetSigning: null };
    this.sessions.set(sessionId, session);
    const check = await prepareDevnetCheck({ address: session.walletAddress!, termsId, origin,
      now: () => this.nowMs(), fetchImpl: this.deps.fetchImpl });
    if (this.sessions.get(sessionId) !== session) throw new Error("The wallet review changed while preparing. Prepare a new check.");
    this.requireWalletControl(session, termsId);
    session.devnetCheck = check;
    return check;
  }

  confirmDevnetSigning(sessionId: string, termsId: string, checkId: string, signedTransaction: string): SessionView {
    const session = this.requireSession(sessionId);
    const check = session.devnetCheck;
    session.devnetCheck = null;
    this.requireWalletControl(session, termsId);
    if (!check || check.id !== checkId || check.termsId !== termsId || check.address !== session.walletAddress) throw new Error("This devnet check is no longer current.");
    verifyDevnetCheck(check, signedTransaction, this.nowMs());
    session.devnetSigning = { verifiedAt: new Date(this.nowMs()).toISOString(), chain: "solana:devnet", broadcast: false };
    return this.view(session);
  }

  private requireWalletControl(session: SessionRecord, termsId: string): void {
    if (session.walletMode !== "connected" || !session.walletAddress || session.termsId !== termsId
      || !session.walletProof || this.nowMs() >= Date.parse(session.walletProof.expiresAt)) {
      throw new Error("Verify control of the connected wallet for this review first.");
    }
  }

  async verifyMerchantTotal(sessionId: string, termsId: string, checkoutId: string, buyerIp?: string | null): Promise<SessionView> {
    const current = this.requireSession(sessionId);
    const offer = this.selectedOffer(current);
    if (!offer || current.termsId !== termsId) throw new PurchaseApprovalError("Your selection changed. Review the current product before verifying its checkout.");
    // Invalidate old evidence before the request. Failed or changed merchant
    // terms must not leave an earlier approval or final total usable.
    const session: SessionRecord = { ...current, checkoutEvidence: null, snapshot: payableFromOffer(offer, current.quantity),
      purchaseIntent: null, swapApproval: null, quote: null, plan: null,
      unsignedTransaction: "not_requested", transactionVersion: null, termsId: crypto.randomUUID(), state: "CHECKOUT_READY" };
    this.sessions.set(sessionId, session);
    const evidence = await readMerchantCheckout({ offer, quantity: session.quantity, checkoutId, buyerIp,
      config: this.deps.config, fetchImpl: this.deps.fetchImpl, nowMs: this.nowMs() });
    if (this.sessions.get(sessionId) !== session) return this.view(this.requireSession(sessionId));
    if (evidence.expiresAtMs <= this.nowMs()) throw new Error("This checkout expired while it was being read. Verify a current checkout.");
    session.checkoutEvidence = evidence;
    return this.review({ sessionId, offerId: offer.id, quantity: session.quantity, walletMode: session.walletMode,
      address: session.walletAddress ?? undefined, fundingMint: current.plan?.candidateMint,
      signatureAvailable: session.signatureCapability === "available" });
  }

  async calculateMerchantTotal(sessionId: string, termsId: string, destination: unknown, buyerIp?: string | null): Promise<SessionView> {
    const current = this.requireSession(sessionId);
    const offer = this.selectedOffer(current);
    if (!offer || current.termsId !== termsId) throw new PurchaseApprovalError("Your selection changed. Review the current product before asking the merchant to price it.");
    const session: SessionRecord = { ...current, checkoutEvidence: null, snapshot: payableFromOffer(offer, current.quantity),
      purchaseIntent: null, swapApproval: null, quote: null, plan: null,
      unsignedTransaction: "not_requested", transactionVersion: null, termsId: crypto.randomUUID(), state: "CHECKOUT_READY" };
    this.sessions.set(sessionId, session);
    const evidence = await prepareMerchantCheckout({ offer, quantity: session.quantity, destination, buyerIp,
      config: this.deps.config, fetchImpl: this.deps.fetchImpl, nowMs: this.nowMs() });
    if (this.sessions.get(sessionId) !== session) return this.view(this.requireSession(sessionId));
    if (evidence.expiresAtMs <= this.nowMs()) throw new Error("This checkout expired while it was being priced. Submit the destination again.");
    session.checkoutEvidence = evidence;
    return this.review({ sessionId, offerId: offer.id, quantity: session.quantity, walletMode: session.walletMode,
      address: session.walletAddress ?? undefined, fundingMint: current.plan?.candidateMint,
      signatureAvailable: session.signatureCapability === "available" });
  }

  async approve(sessionId: string): Promise<SessionView> {
    const session = this.requireSession(sessionId);
    this.view(session);
    if (session.state !== "SWAP_QUOTE_READY" && session.state !== "AWAITING_SWAP_APPROVAL") {
      throw new Error("There is no current conversion quote to approve. Refresh your funding plan.");
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

  async approvePurchase(sessionId: string, termsId?: string): Promise<SessionView> {
    const session = this.requireSession(sessionId);
    this.view(session); // Re-evaluate evidence freshness before accepting approval.
    const offer = this.selectedOffer(session);
    if (!session.snapshot?.merchantTotalKnown || session.snapshot.merchantTotalMinor == null) {
      throw new PurchaseApprovalError("The final merchant checkout total must be verified before approving this purchase. A planning amount is not a final checkout total.");
    }
    if (termsId !== session.termsId) throw new PurchaseApprovalError("The reviewed terms changed. Review the current final amount before approving.");
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
      expiresAtMs: Math.min(now + PURCHASE_APPROVAL_TTL_MS, session.checkoutEvidence!.expiresAtMs),
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
    session.balanceReadAtMs = null;
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
        session.balanceReadAtMs = this.nowMs();
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
    const offer = this.selectedOffer(session);
    if (session.balanceSource === "chain" && (session.balanceReadAtMs == null || this.nowMs() >= session.balanceReadAtMs + BALANCE_FRESHNESS_MS)) {
      session.balanceSource = "error";
      session.balanceError = "Wallet balances expired. Refresh your wallet to review current funds.";
      session.balances = []; session.plan = null; session.quote = null;
      session.purchaseIntent = null; session.swapApproval = null;
      session.walletChallenge = null; session.walletProof = null; session.devnetCheck = null; session.devnetSigning = null;
      session.unsignedTransaction = "not_requested"; session.transactionVersion = null;
      session.termsId = crypto.randomUUID(); session.state = "CHECKOUT_READY";
    }
    if (session.checkoutEvidence && this.nowMs() >= session.checkoutEvidence.expiresAtMs) {
      session.checkoutEvidence = null;
      session.snapshot = offer ? payableFromOffer(offer, session.quantity) : null;
      session.purchaseIntent = null; session.swapApproval = null; session.quote = null;
      session.unsignedTransaction = "not_requested"; session.transactionVersion = null;
      session.termsId = crypto.randomUUID(); session.state = "FUNDING_ANALYZED";
    }
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
      exact: session.offers.map(item => toOfferView(item, item.id === session.selectedOfferId ? session.quantity : 1)),
      excluded: session.excluded.flatMap((item) => {
        const offer = excludedOffers.get(item.id);
        return offer ? [{ offer: toOfferView(offer, offer.id === session.selectedOfferId ? session.quantity : 1), reasons: item.reasons }] : [];
      }),
      providers: session.providers,
      gemini: session.gemini,
      selectedOfferId: session.selectedOfferId,
      purchase: session.snapshot && session.selectedOfferId ? {
        termsId: session.termsId,
        checkoutVerification: {
          status: session.checkoutEvidence?.authority === "merchant_ready" ? "verified"
            : session.checkoutEvidence?.authority === "merchant_calculated" ? "calculated"
            : session.checkoutEvidence?.authority === "merchant_stated" ? "stated" : "unknown",
          readAvailable: offer ? checkoutAccess(offer, this.deps.config).available : false,
          message: session.checkoutEvidence?.snapshot.note
            ?? (offer ? checkoutAccess(offer, this.deps.config).message : "Choose a product first."),
          merchantOrigin: session.checkoutEvidence?.merchantOrigin ?? null,
          verifiedAt: session.checkoutEvidence ? new Date(session.checkoutEvidence.verifiedAtMs).toISOString() : null,
          expiresAt: session.checkoutEvidence ? new Date(session.checkoutEvidence.expiresAtMs).toISOString() : null,
        },
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
        walletControl: session.walletProof && this.nowMs() < Date.parse(session.walletProof.expiresAt) ? session.walletProof : null,
        devnetSigning: session.devnetSigning,
        signatureCapability: session.signatureCapability,
        transactionVersion: session.transactionVersion,
        balanceSource: session.balanceSource,
        balanceError: session.balanceError,
        balanceExpiresAt: session.balanceSource === "chain" && session.balanceReadAtMs != null
          ? new Date(session.balanceReadAtMs + BALANCE_FRESHNESS_MS).toISOString() : null,
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
        amountKind: session.checkoutEvidence?.authority === "merchant_ready" ? "merchant_checkout_total"
          : session.checkoutEvidence?.authority === "merchant_calculated" ? "merchant_calculated_total" : "planning_amount",
        finalTotal: session.checkoutEvidence?.authority === "merchant_ready" ? "verified" : "unknown",
        merchantStatement: session.checkoutEvidence?.statement ? toStatementView(session.checkoutEvidence.statement) : null,
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
    walletChallenge: null,
    walletProof: null,
    devnetCheck: null,
    devnetSigning: null,
    balances: [],
    balanceSource: "none",
    balanceError: null,
    balanceReadAtMs: null,
    snapshot: null,
    checkoutEvidence: null,
    termsId: crypto.randomUUID(),
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
  // Refresh on actual configuration changes without exposing credentials or IPs.
  return createHash("sha256").update(JSON.stringify(config)).digest("hex");
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
