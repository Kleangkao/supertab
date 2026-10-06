/** Purchase adapters. The server gate is checked before every broadcast and payment submission. */
import { decodeTransaction, parseDisclosedLookupTables, validateConversionTransaction } from "./conversion-review";
import { fetchConversionOrder } from "./dflow";
import {
  bitcoinAnchorBuyUrl,
  DigitalPurchaseError,
  EXPECTED_AMOUNT_ATOMIC,
  parseSolanaExactTerms,
  SOLANA_MAINNET_CAIP,
} from "./digital-purchase";
import { encodeBase58 } from "./base58";
import { readConfig, type AppConfig } from "./config";
import { FinancialExecutionDisabled } from "./execution";
import {
  assertSponsoredPayment,
  exactTermsFromApproval,
  parseDelivery,
  parseVerifyBody,
  paymentAuthorization,
  paymentSignatureHeader,
  publishedSigningKeys,
  safeStatusUrl,
  settlementFromParsedTransaction,
} from "./merchant-adapter";
import { buildSponsoredPaymentPreview } from "./sponsored-payment";
import { localPurchaseJournal, type PurchaseJournal, type SwapContext } from "./purchase-journal";
import {
  acceptSignedMessage,
  beginExecution,
  createReview,
  invalidateApproval,
  mainnetExecutionGate,
  markMerchantSubmitted,
  markSwapSubmitted,
  noteAuthorizationRetained,
  noteCertificate,
  noteLifetimeExpired,
  notePaymentConfirmedWithoutCertificate,
  noteResponseLost,
  noteSwapConfirmed,
  preparePayment,
  prepareSwap,
  publicWorkflow,
  recheckFunding,
  refreshUnsignedLifetime,
  skipConversion,
  type PurchaseWorkflow,
  type SettlementProof,
} from "./purchase-workflow";
import {
  messageOf,
  revalidateSignedSwap,
  sameFinancialSwap,
  SwapAlreadyProcessed,
  SwapSubmissionLost,
  transactionSignature,
} from "./swap-adapter";
import { NATIVE_SOL_MINT, USDC_MINT, WSOL_MINT } from "./tokens";
import { readSolanaBalances } from "./wallet";
import { sameOriginRequest } from "./request-origin";

export const EXECUTION_ACTIONS = [
  "prepare_swap",
  "accept_swap_signature",
  "submit_swap",
  "prepare_payment",
  "accept_payment_signature",
  "submit_payment",
  "reconcile",
  "verify_certificate",
  "replay_payment",
] as const;

export type ExecutionAction = (typeof EXECUTION_ACTIONS)[number];

const SPENDING_ACTIONS = new Set<ExecutionAction>(["submit_swap", "submit_payment", "replay_payment"]);

export interface PurchaseTransports {
  quoteSwap(input: { wallet: string; amount: bigint; slippageBps: number }): Promise<SwapContext & { transaction: Uint8Array }>;
  blockHeight(): Promise<number>;
  latestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }>;
  solLamports(owner: string): Promise<bigint>;
  usdcAtomic(owner: string): Promise<bigint>;
  sendSwap(signed: Uint8Array): Promise<string>;
  signatureStatus(signature: string): Promise<{ err: unknown; confirmationStatus: string | null } | null>;
  orderStatus(signature: string): Promise<{ status: string; outAmount: string } | null>;
  freshTerms(digest: string): Promise<ReturnType<typeof parseSolanaExactTerms>>;
  submitPayment(input: { url: string; authorization: string; idempotencyKey: string }): Promise<{ status: number; bodyText: string; paymentResponse: string | null }>;
  signingKeys(): Promise<string[]>;
  verifyCertificate(certId: string): Promise<unknown>;
  settlement(signature: string): Promise<unknown>;
  purchaseStatus(url: string, token: string): Promise<unknown>;
}

export interface ExecutionResult {
  executionGate: "off" | "on";
  executionReady: false;
  retrySwap: false;
  retryPayment: false;
  error: string | null;
  purpose: string | null;
  unsignedTransaction: string | null;
  workflow: ReturnType<typeof publicWorkflow> | null;
}

const stopped = { executionReady: false as const, retrySwap: false as const, retryPayment: false as const };

export async function runPurchaseAttempt(input: {
  gate: "off" | "on";
  action: ExecutionAction;
  attemptId: string;
  wallet: string;
  signedTransaction?: Uint8Array;
  nowMs: number;
  journal: PurchaseJournal;
  transports: PurchaseTransports;
}): Promise<ExecutionResult> {
  if (input.gate !== "on") {
    beginExecution(input.gate);
  }
  const record = input.journal.read();
  if (!record || record.id !== input.attemptId || record.wallet !== input.wallet) {
    return refuse(input.gate, "No stored attempt matches this wallet.");
  }
  const workflow = record.workflow ?? createReview(record.id, new Date(input.nowMs).toISOString());
  if (workflow.terms && workflow.terms.wallet !== input.wallet) return refuse(input.gate, "This authorization belongs to another wallet.");
  try {
    if (input.action === "prepare_swap") return await prepareSwapAction(input, workflow);
    if (input.action === "accept_swap_signature") return acceptSwap(input, workflow);
    if (input.action === "submit_swap") return await submitSwapAction(input, workflow);
    if (input.action === "prepare_payment") return await preparePaymentAction(input, workflow);
    if (input.action === "accept_payment_signature") return acceptPayment(input, workflow);
    if (input.action === "submit_payment") return await submitPaymentAction(input, workflow, false);
    if (input.action === "replay_payment") return await submitPaymentAction(input, workflow, true);
    if (input.action === "reconcile") return await reconcileAction(input, workflow);
    return await verifyAction(input, workflow);
  } catch (error) {
    if (error instanceof FinancialExecutionDisabled) throw error;
    const message = error instanceof Error ? error.message : "The attempt could not continue.";
    return refuse(input.gate, message, input.journal.read()?.workflow ?? workflow);
  }
}

async function prepareSwapAction(input: ActionInput, workflow: PurchaseWorkflow): Promise<ExecutionResult> {
  if (!workflow.terms?.conversionInputLamports || workflow.terms.slippageBps == null) {
    return refuse(input.gate, "This approval does not include a conversion.", workflow);
  }
  if (workflow.state !== "approved_terms" && workflow.state !== "swap_prepared") {
    return refuse(input.gate, "A swap can be prepared only from approved terms.", workflow);
  }
  const order = await input.transports.quoteSwap({
    wallet: workflow.terms.wallet,
    amount: BigInt(workflow.terms.conversionInputLamports),
    slippageBps: workflow.terms.slippageBps,
  });
  if (order.executionMode !== "sync") {
    return refuse(input.gate, "DFlow returned an async order. This purchase signs only a synchronous route. Nothing was signed or sent.", workflow);
  }
  if (!sameFinancialSwap(order, workflow.terms)) {
    const changed = invalidateApproval(workflow, `swap-terms-${input.nowMs}`, { ...workflow.terms, conversionInputLamports: order.inAmount }, new Date(input.nowMs).toISOString());
    input.journal.saveWorkflow(input.attemptId, changed.workflow);
    return refuse(input.gate, "The conversion terms changed. Record a fresh review. Nothing was signed or sent.", changed.workflow);
  }
  const unsigned = validateConversionTransaction({
    transaction: order.transaction,
    payer: workflow.terms.wallet,
    inputMint: order.inputMint,
    outputMint: order.outputMint,
    inAmount: BigInt(order.inAmount),
    outAmount: BigInt(order.outAmount),
    minOutAmount: BigInt(order.minOutAmount),
    lookupTables: order.lookupTables,
    prioritizationFeeLamports: BigInt(order.prioritizationFeeLamports),
    executionMode: order.executionMode,
    allowAsync: false,
  });
  if (unsigned.status !== "checked") return refuse(input.gate, unsigned.explanation, workflow);
  const height = await input.transports.blockHeight();
  if (height > order.lastValidBlockHeight) return refuse(input.gate, "The unsigned swap expired. It was not signed or sent.", workflow);
  const sol = await input.transports.solLamports(workflow.terms.wallet);
  const nowIso = new Date(input.nowMs).toISOString();
  const message = messageOf(order.transaction);
  const step = workflow.state === "swap_prepared"
    ? refreshUnsignedLifetime(workflow, `swap-lifetime-${order.blockhash}`, nowIso, { message, blockhash: order.blockhash, lastValidBlockHeight: order.lastValidBlockHeight })
    : prepareSwap(workflow, `swap-prepare-${order.blockhash}`, nowIso, { message, blockhash: order.blockhash, lastValidBlockHeight: order.lastValidBlockHeight, walletLamports: sol });
  if (step.workflow.state !== "swap_prepared") return refuse(input.gate, step.workflow.mismatch ?? "The swap was not prepared.", step.workflow);
  const next = { ...step.workflow, swapExecutionMode: order.executionMode };
  const context: SwapContext = {
    executionMode: order.executionMode,
    inAmount: order.inAmount,
    outAmount: order.outAmount,
    minOutAmount: order.minOutAmount,
    slippageBps: order.slippageBps,
    prioritizationFeeLamports: order.prioritizationFeeLamports,
    inputMint: order.inputMint,
    outputMint: order.outputMint,
    lookupTables: order.lookupTables,
    lastValidBlockHeight: order.lastValidBlockHeight,
    blockhash: order.blockhash,
  };
  input.journal.saveSwapContext(input.attemptId, context);
  input.journal.saveWorkflow(input.attemptId, next);
  return done(input.gate, next, {
    purpose: `Sign one ${order.executionMode} SOL to USDC conversion for ${order.inAmount} lamports, minimum ${order.minOutAmount} USDC base units, slippage ${order.slippageBps} bps. This does not pay the merchant.`,
    unsignedTransaction: Buffer.from(order.transaction).toString("base64"),
  });
}

function acceptSwap(input: ActionInput, workflow: PurchaseWorkflow): ExecutionResult {
  const record = input.journal.read();
  if (!input.signedTransaction || !workflow.terms || !workflow.retainedMessage || !record?.swapContext) {
    return refuse(input.gate, "There is no prepared swap to sign.", workflow);
  }
  try {
    revalidateSignedSwap({
      signed: input.signedTransaction,
      retainedMessage: Buffer.from(workflow.retainedMessage, "base64"),
      shopper: workflow.terms.wallet,
      context: record.swapContext,
      approved: workflow.terms,
    });
  } catch (error) {
    return refuse(input.gate, error instanceof Error ? error.message : "The signed swap was rejected.", workflow);
  }
  const signature = transactionSignature(input.signedTransaction, 0);
  const signed = acceptSignedMessage(workflow, `swap-sign-${signature}`, new Date(input.nowMs).toISOString(), {
    signedTransaction: input.signedTransaction, shopper: workflow.terms.wallet, shopperSlot: 0,
  });
  if (signed.workflow.state !== "swap_signed") return refuse(input.gate, signed.workflow.mismatch ?? "The swap signature was not accepted.", signed.workflow);
  input.journal.retainSignedSwap(input.attemptId, { transaction: Buffer.from(input.signedTransaction).toString("base64"), signature }, signed.workflow);
  return done(input.gate, signed.workflow, { purpose: "The conversion signature is stored. Submission is a separate action and has not been sent." });
}

async function submitSwapAction(input: ActionInput, workflow: PurchaseWorkflow): Promise<ExecutionResult> {
  beginExecution(input.gate);
  const record = input.journal.read();
  if (!record?.signedSwap || !record.swapContext || !workflow.terms) return refuse(input.gate, "There is no signed swap to submit.", workflow);
  const height = await input.transports.blockHeight();
  if (workflow.terms.lastValidBlockHeight != null && height > workflow.terms.lastValidBlockHeight) {
    const expired = noteLifetimeExpired(workflow, `swap-expired-${height}`, new Date(input.nowMs).toISOString(), height);
    input.journal.saveWorkflow(input.attemptId, expired.workflow);
    return refuse(input.gate, "The signed swap expired. It was not replaced.", expired.workflow);
  }
  const sol = await input.transports.solLamports(workflow.terms.wallet);
  if (sol < BigInt(workflow.terms.solCapLamports) + BigInt(workflow.terms.reserveLamports)) {
    return refuse(input.gate, "The wallet cannot cover the SOL cap and the reserve. Nothing was sent.", workflow);
  }
  const signedBytes = Buffer.from(record.signedSwap.transaction, "base64");
  revalidateSignedSwap({
    signed: signedBytes,
    retainedMessage: Buffer.from(workflow.retainedMessage ?? "", "base64"),
    shopper: workflow.terms.wallet,
    context: record.swapContext,
    approved: workflow.terms,
  });
  const marked = markSwapSubmitted(workflow, `swap-submit-${record.signedSwap.signature}`, new Date(input.nowMs).toISOString());
  if (marked.workflow.state !== "swap_submitted_uncertain") return refuse(input.gate, marked.workflow.mismatch ?? "The swap was not submitted.", marked.workflow);
  const claim = input.journal.claimSwapSubmission(input.attemptId, { ...marked.workflow, pendingSwapSignature: record.signedSwap.signature });
  if (claim.duplicate) return reconcileSwap(input, input.journal.read()?.workflow ?? marked.workflow);
  try {
    const returned = await input.transports.sendSwap(Buffer.from(claim.transaction, "base64"));
    if (returned !== claim.signature) return reconcileSwap(input, input.journal.read()?.workflow ?? marked.workflow);
  } catch (error) {
    if (error instanceof SwapAlreadyProcessed || error instanceof SwapSubmissionLost) {
      const lost = noteResponseLost(input.journal.read()?.workflow ?? marked.workflow, `swap-lost-${claim.signature}`, new Date(input.nowMs).toISOString());
      input.journal.saveWorkflow(input.attemptId, lost.workflow);
      return reconcileSwap(input, lost.workflow);
    }
    throw error;
  }
  return reconcileSwap(input, input.journal.read()?.workflow ?? marked.workflow);
}

async function reconcileSwap(input: ActionInput, workflow: PurchaseWorkflow): Promise<ExecutionResult> {
  const record = input.journal.read();
  const signature = record?.swapSubmission?.signature;
  if (!signature || !workflow.terms || !record?.swapContext) return done(input.gate, workflow, {});
  if (workflow.state === "swap_confirmed" || workflow.state === "funding_rechecked") return recheck(input, workflow);
  const status = await input.transports.signatureStatus(signature);
  const confirmed = status && status.err == null && (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized");
  if (!confirmed) {
    return done(input.gate, workflow, { error: "The original swap is not confirmed. No second swap was started." });
  }
  if (record.swapContext.executionMode === "async") {
    const order = await input.transports.orderStatus(signature);
    if (!order || order.status !== "closed" || BigInt(order.outAmount) < BigInt(record.swapContext.minOutAmount)) {
      return done(input.gate, workflow, { error: "The async order is not a closed fill at the approved minimum. No second swap was started." });
    }
  }
  const noted = noteSwapConfirmed(workflow, `swap-confirm-${signature}`, new Date(input.nowMs).toISOString(), { err: null, signature });
  if (noted.workflow.state !== "swap_confirmed" && !noted.replayed) return refuse(input.gate, noted.workflow.mismatch ?? "The swap confirmation was not accepted.", noted.workflow);
  input.journal.saveWorkflow(input.attemptId, noted.workflow);
  return recheck(input, noted.workflow);
}

async function recheck(input: ActionInput, workflow: PurchaseWorkflow): Promise<ExecutionResult> {
  if (!workflow.terms) return done(input.gate, workflow, {});
  let balance: bigint;
  try {
    balance = await input.transports.usdcAtomic(workflow.terms.wallet);
  } catch {
    return done(input.gate, workflow, { error: "The swap is confirmed and the USDC balance read is delayed. No merchant payment was started." });
  }
  const funded = recheckFunding(workflow, `funding-${workflow.swapSignature ?? workflow.pendingSwapSignature ?? input.attemptId}`, new Date(input.nowMs).toISOString(), balance);
  input.journal.saveWorkflow(input.attemptId, funded.workflow);
  if (funded.workflow.usdcPreserved) {
    return done(input.gate, funded.workflow, { error: "Converted USDC stays in the wallet. The merchant payment was not started." });
  }
  return done(input.gate, funded.workflow, {});
}

async function preparePaymentAction(input: ActionInput, workflow: PurchaseWorkflow): Promise<ExecutionResult> {
  if (!workflow.terms) return refuse(input.gate, "Payment waits for approved terms.", workflow);
  if (input.nowMs >= Date.parse(workflow.terms.merchantExpiresAt)) {
    return refuse(input.gate, "The approved merchant quote expired. No replacement payment was prepared.", workflow);
  }
  const fresh = await input.transports.freshTerms(workflow.terms.digest);
  if (fresh.amountAtomic !== workflow.terms.amountAtomic || fresh.payTo !== workflow.terms.recipient || fresh.feePayer !== workflow.terms.sponsor
    || fresh.mint !== USDC_MINT || fresh.network !== SOLANA_MAINNET_CAIP || fresh.digest !== workflow.terms.digest) {
    const changed = invalidateApproval(workflow, `payment-terms-${fresh.expiresAt}`, {
      ...workflow.terms,
      amountAtomic: fresh.amountAtomic,
      recipient: fresh.payTo,
      sponsor: fresh.feePayer,
    }, new Date(input.nowMs).toISOString());
    input.journal.saveWorkflow(input.attemptId, changed.workflow);
    return refuse(input.gate, "The merchant terms changed. Record a fresh review. Nothing was signed or sent.", changed.workflow);
  }
  let current = workflow;
  const nowIso = new Date(input.nowMs).toISOString();
  const approvedTerms = current.terms;
  if (!approvedTerms) return refuse(input.gate, "Payment waits for approved terms.", current);
  if (current.state === "approved_terms" && approvedTerms.conversionInputLamports == null) {
    const balance = await input.transports.usdcAtomic(approvedTerms.wallet);
    const skipped = skipConversion(current, `skip-${input.attemptId}`, nowIso, balance);
    if (skipped.workflow.state !== "funding_rechecked") return refuse(input.gate, skipped.workflow.mismatch ?? "Confirmed USDC does not cover the payment.", skipped.workflow);
    current = skipped.workflow;
    input.journal.saveWorkflow(input.attemptId, current);
  }
  if (current.state === "swap_confirmed") {
    const checked = await recheck(input, current);
    current = input.journal.read()?.workflow ?? current;
    if (current.usdcPreserved || current.state !== "funding_rechecked") return checked;
  }
  if (current.state !== "funding_rechecked" || !current.terms) return refuse(input.gate, "Payment waits for a funding recheck.", current);
  const balance = await input.transports.usdcAtomic(current.terms.wallet);
  if (balance < EXPECTED_AMOUNT_ATOMIC) {
    const held = { ...current, usdcPreserved: true, mismatch: "Converted USDC stays in the wallet. The merchant payment was not started." };
    input.journal.saveWorkflow(input.attemptId, held);
    return refuse(input.gate, held.mismatch, held);
  }
  const lifetime = await input.transports.latestBlockhash();
  const memo = fresh.memo ?? current.paymentMemo ?? input.attemptId;
  const preview = buildSponsoredPaymentPreview({
    terms: { ...fresh, memo },
    wallet: current.terms.wallet,
    attemptId: input.attemptId,
    blockhash: lifetime.blockhash,
    nowMs: input.nowMs,
  });
  const prepared = preparePayment(current, `payment-prepare-${lifetime.blockhash}`, nowIso, input.nowMs, {
    message: preview.message,
    blockhash: lifetime.blockhash,
    lastValidBlockHeight: lifetime.lastValidBlockHeight,
    merchantExpiresAt: fresh.expiresAt,
  });
  if (prepared.workflow.state !== "payment_prepared") return refuse(input.gate, prepared.workflow.mismatch ?? "The payment was not prepared.", prepared.workflow);
  const next = { ...prepared.workflow, paymentMemo: preview.memo };
  input.journal.saveWorkflow(input.attemptId, next);
  return done(input.gate, next, {
    purpose: "Sign the merchant payment in signature slot 1. Slot 0 stays empty for the sponsor. This does not broadcast the transaction.",
    unsignedTransaction: Buffer.from(preview.transaction).toString("base64"),
  });
}

function acceptPayment(input: ActionInput, workflow: PurchaseWorkflow): ExecutionResult {
  if (!input.signedTransaction || !workflow.terms || !workflow.retainedMessage || !workflow.terms.blockhash || !workflow.paymentMemo) {
    return refuse(input.gate, "There is no prepared merchant payment to sign.", workflow);
  }
  const expected = buildSponsoredPaymentPreview({
    terms: exactTermsFromApproval(workflow.terms, workflow.paymentMemo, input.nowMs),
    wallet: workflow.terms.wallet,
    attemptId: input.attemptId,
    blockhash: workflow.terms.blockhash,
    nowMs: input.nowMs,
  });
  if (Buffer.from(workflow.retainedMessage, "base64").compare(Buffer.from(expected.message)) !== 0) {
    return refuse(input.gate, "The prepared payment does not match the approved terms.", workflow);
  }
  try {
    assertSponsoredPayment({
      signed: input.signedTransaction,
      retainedMessage: expected.message,
      shopper: workflow.terms.wallet,
      recipient: workflow.terms.recipient,
      sponsor: workflow.terms.sponsor,
    });
  } catch (error) {
    return refuse(input.gate, error instanceof Error ? error.message : "The signed payment was rejected.", workflow);
  }
  const nowIso = new Date(input.nowMs).toISOString();
  const signed = acceptSignedMessage(workflow, `payment-sign-${transactionSignature(input.signedTransaction, 1)}`, nowIso, {
    signedTransaction: input.signedTransaction, shopper: workflow.terms.wallet, shopperSlot: 1,
  });
  if (signed.workflow.state !== "payment_signed") return refuse(input.gate, signed.workflow.mismatch ?? "The payment signature was not accepted.", signed.workflow);
  const retained = noteAuthorizationRetained(signed.workflow, `payment-retain-${input.attemptId}`, nowIso);
  if (retained.workflow.paymentAuthorization !== "retained") return refuse(input.gate, retained.workflow.mismatch ?? "The payment authorization was not retained.", retained.workflow);
  const authorization = paymentAuthorization({ terms: exactTermsFromApproval(workflow.terms, workflow.paymentMemo, input.nowMs), signedTransaction: input.signedTransaction });
  input.journal.retainSignedPayment(input.attemptId, authorization, Buffer.from(input.signedTransaction).toString("base64"), retained.workflow);
  return done(input.gate, retained.workflow, { purpose: "The payment authorization is stored. It has not been submitted to the merchant." });
}

async function submitPaymentAction(input: ActionInput, workflow: PurchaseWorkflow, replay: boolean): Promise<ExecutionResult> {
  beginExecution(input.gate);
  const record = input.journal.read();
  if (!record?.paymentAuthorization || !workflow.terms) return refuse(input.gate, "The original payment authorization is not in custody.", workflow);
  if (replay) {
    if (workflow.state !== "merchant_submission_uncertain") {
      return refuse(input.gate, "Replay is only for the original payment whose response was lost.", workflow);
    }
    const knownSettlement = record.merchantResponse?.settlementTx ?? workflow.settlementTx;
    if (knownSettlement) return settleAndVerify(input, workflow, knownSettlement, record.merchantResponse?.certId ?? workflow.certId);
    if (record.merchantResponse) return reconcilePayment(input, workflow);
    if (!record.signedPayment || !workflow.retainedMessage || !workflow.paymentMemo) {
      return refuse(input.gate, "The original payment authorization is not in custody.", workflow);
    }
    let signed: Buffer;
    try {
      const body = JSON.parse(record.paymentAuthorization) as { payload?: { transaction?: string } };
      if (body.payload?.transaction !== record.signedPayment) throw new Error("The stored authorization does not match the signed payment.");
      signed = Buffer.from(record.signedPayment, "base64");
      assertSponsoredPayment({
        signed, retainedMessage: Buffer.from(workflow.retainedMessage, "base64"),
        shopper: workflow.terms.wallet, recipient: workflow.terms.recipient, sponsor: workflow.terms.sponsor,
      });
    } catch (error) {
      return refuse(input.gate, error instanceof Error ? error.message : "The stored payment was rejected.", workflow);
    }
    if (Date.now() - Date.parse(record.createdAt) > 24 * 60 * 60 * 1000) return refuse(input.gate, "The documented idempotency window has passed. No replacement payment was created.", workflow);
    return deliver(input, workflow, record.paymentAuthorization, record.idempotencyKey);
  }
  const marked = markMerchantSubmitted(workflow, `payment-submit-${input.attemptId}`, new Date(input.nowMs).toISOString());
  if (marked.workflow.state !== "merchant_submission_uncertain") return refuse(input.gate, marked.workflow.mismatch ?? "The payment was not submitted.", marked.workflow);
  const claim = input.journal.claimMerchantSubmission(input.attemptId, marked.workflow);
  if (claim.duplicate) return reconcilePayment(input, input.journal.read()?.workflow ?? marked.workflow);
  return deliver(input, input.journal.read()?.workflow ?? marked.workflow, claim.authorization, record.idempotencyKey);
}

async function deliver(input: ActionInput, workflow: PurchaseWorkflow, authorization: string, idempotencyKey: string): Promise<ExecutionResult> {
  if (!workflow.terms) return refuse(input.gate, "The original payment has no approved terms.", workflow);
  let response: { status: number; bodyText: string; paymentResponse: string | null };
  try {
    response = await input.transports.submitPayment({ url: bitcoinAnchorBuyUrl(workflow.terms.digest), authorization, idempotencyKey });
  } catch (error) {
    if (error instanceof SwapSubmissionLost) {
      const lost = noteResponseLost(workflow, `payment-lost-${input.attemptId}`, new Date(input.nowMs).toISOString());
      input.journal.saveWorkflow(input.attemptId, lost.workflow);
      return done(input.gate, lost.workflow, { error: "The merchant response was lost. The original payment stays unresolved. Do not send another payment." });
    }
    throw error;
  }
  const parsed = parseDelivery(response.bodyText, response.paymentResponse);
  input.journal.retainMerchantResponse(input.attemptId, {
    body: response.bodyText,
    certId: parsed.certId,
    settlementTx: parsed.settlementTx,
    statusUrl: parsed.statusUrl,
    statusToken: parsed.statusToken,
  });
  if (response.status !== 200 || (parsed.network && parsed.network !== SOLANA_MAINNET_CAIP)) {
    return done(input.gate, input.journal.read()?.workflow ?? workflow, { error: "The merchant rejected this payment. The original authorization stays retained. No replacement payment was created." });
  }
  return settleAndVerify(input, input.journal.read()?.workflow ?? workflow, parsed.settlementTx, parsed.certId);
}

async function settleAndVerify(input: ActionInput, workflow: PurchaseWorkflow, settlementTx: string | null, certId: string | null): Promise<ExecutionResult> {
  if (!workflow.terms || !settlementTx) {
    return done(input.gate, workflow, { error: "The merchant response has no settlement transaction. Success was not displayed." });
  }
  const chain = settlementFromParsedTransaction(settlementTx, await input.transports.settlement(settlementTx), workflow.terms);
  if (!chain) return done(input.gate, workflow, { error: "On-chain settlement does not match this purchase. No replacement payment was created." });
  if (!certId) {
    const missing = notePaymentConfirmedWithoutCertificate(workflow, `settled-${settlementTx}`, new Date(input.nowMs).toISOString(), chain);
    input.journal.saveWorkflow(input.attemptId, missing.workflow);
    return done(input.gate, missing.workflow, { error: "Payment confirmed. The certificate is missing. Do not pay again." });
  }
  return verifyKnown(input, input.journal.read()?.workflow ?? workflow, certId, chain);
}

async function verifyKnown(input: ActionInput, workflow: PurchaseWorkflow, certId: string, settlement: SettlementProof | null): Promise<ExecutionResult> {
  let body: unknown;
  let keys: string[] = [];
  try {
    body = await input.transports.verifyCertificate(certId);
    keys = await input.transports.signingKeys();
  } catch {
    const unavailable = noteCertificate(workflow, `verify-unavailable-${certId}`, new Date(input.nowMs).toISOString(), {
      certId, signedPayload: "{}", signatureHex: "0".repeat(128), publicKeyHex: "0".repeat(64), trustedKeys: [], proof: "unavailable", settlement,
    });
    input.journal.saveWorkflow(input.attemptId, unavailable.workflow);
    return done(input.gate, unavailable.workflow, { error: "The certificate was received and verification is unavailable. It is not a completed Bitcoin anchor." });
  }
  const parsed = parseVerifyBody(body);
  if (!parsed || parsed.certId !== certId) {
    return done(input.gate, workflow, { error: "The certificate response does not match this purchase." });
  }
  const noted = noteCertificate(workflow, `certificate-${certId}`, new Date(input.nowMs).toISOString(), {
    certId,
    signedPayload: parsed.signedPayload,
    signatureHex: parsed.signatureHex,
    publicKeyHex: parsed.publicKeyHex,
    trustedKeys: keys,
    proof: parsed.proof,
    settlement,
  });
  input.journal.saveWorkflow(input.attemptId, noted.workflow);
  return done(input.gate, noted.workflow, noted.workflow.state === "timestamp_proof_pending"
    ? { error: null, purpose: "The certificate is verified and the Bitcoin timestamp is still pending." }
    : {});
}

async function reconcileAction(input: ActionInput, workflow: PurchaseWorkflow): Promise<ExecutionResult> {
  const record = input.journal.read();
  if (record?.swapSubmission && (workflow.state === "swap_submitted_uncertain" || workflow.state === "swap_confirmed")) {
    return reconcileSwap(input, workflow);
  }
  if (workflow.state === "merchant_submission_uncertain" || workflow.state === "payment_confirmed_certificate_missing" || workflow.state === "certificate_verification_unavailable") {
    return reconcilePayment(input, workflow);
  }
  return done(input.gate, workflow, { error: "This attempt has no submitted swap or payment to reconcile." });
}

async function reconcilePayment(input: ActionInput, workflow: PurchaseWorkflow): Promise<ExecutionResult> {
  const record = input.journal.read();
  const stored = record?.merchantResponse;
  if (stored?.certId) return verifyKnown(input, workflow, stored.certId, workflow.terms && stored.settlementTx ? settlementFromParsedTransaction(stored.settlementTx, await input.transports.settlement(stored.settlementTx), workflow.terms) : null);
  if (stored?.statusUrl && stored.statusToken) {
    const status = await input.transports.purchaseStatus(stored.statusUrl, stored.statusToken);
    const certId = status && typeof status === "object" ? certFromStatus(status) : null;
    if (certId) return verifyKnown(input, workflow, certId, null);
  }
  return done(input.gate, workflow, { error: "The original payment is unresolved. No replacement payment was created." });
}

async function verifyAction(input: ActionInput, workflow: PurchaseWorkflow): Promise<ExecutionResult> {
  const certId = workflow.certId ?? input.journal.read()?.merchantResponse?.certId;
  if (!certId || !workflow.terms) return refuse(input.gate, "There is no certificate id for this attempt.", workflow);
  const settlement = workflow.settlementTx
    ? settlementFromParsedTransaction(workflow.settlementTx, await input.transports.settlement(workflow.settlementTx), workflow.terms)
    : null;
  return verifyKnown(input, workflow, certId, settlement);
}

function certFromStatus(status: unknown): string | null {
  const body = status as { certificate?: { cert_id?: unknown }; cert_id?: unknown };
  const certId = typeof body.cert_id === "string" ? body.cert_id : body.certificate?.cert_id;
  return typeof certId === "string" && /^cert_[A-Za-z0-9]+$/.test(certId) ? certId : null;
}

type ActionInput = {
  gate: "off" | "on";
  action: ExecutionAction;
  attemptId: string;
  wallet: string;
  signedTransaction?: Uint8Array;
  nowMs: number;
  journal: PurchaseJournal;
  transports: PurchaseTransports;
};

function refuse(gate: "off" | "on", error: string, workflow?: PurchaseWorkflow): ExecutionResult {
  return { executionGate: gate, ...stopped, error, purpose: null, unsignedTransaction: null, workflow: workflow ? publicWorkflow(workflow) : null };
}

function done(gate: "off" | "on", workflow: PurchaseWorkflow, extra: { error?: string | null; purpose?: string | null; unsignedTransaction?: string | null }): ExecutionResult {
  return {
    executionGate: gate,
    ...stopped,
    error: extra.error ?? workflow.mismatch,
    purpose: extra.purpose ?? null,
    unsignedTransaction: extra.unsignedTransaction ?? null,
    workflow: publicWorkflow(workflow),
  };
}

export function createPurchaseTransports(config: AppConfig, gate: () => "off" | "on", fetchImpl: typeof fetch = fetch): PurchaseTransports {
  const rpc = async (method: string, params: unknown[]) => {
    const response = await fetchImpl(config.solanaRpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.json() as { result?: unknown; error?: { message?: string } };
    if (!response.ok || body.error) {
      const message = body.error?.message ?? `Solana request failed (${response.status}).`;
      if (/already been processed|already processed/i.test(message)) throw new SwapAlreadyProcessed();
      throw new Error(message);
    }
    return body.result;
  };
  return {
    async quoteSwap(quote) {
      const order = await fetchConversionOrder({
        inputMint: WSOL_MINT, outputMint: USDC_MINT, amount: quote.amount, userPublicKey: quote.wallet, wrapAndUnwrapSol: true,
      }, { baseUrl: config.dflowBaseUrl, apiKey: config.dflowApiKey ?? undefined, slippageBps: quote.slippageBps, fetchImpl, syncOnly: true });
      const lastValidBlockHeight = order.quote.lastValidBlockHeight;
      if (!order.transactionBase64 || !order.quote.executionMode || lastValidBlockHeight == null || order.quote.prioritizationFeeLamports == null || order.quote.slippageBps == null) {
        throw new DigitalPurchaseError("DFlow did not return a submittable order.");
      }
      const transaction = decodeTransaction(order.transactionBase64);
      if (!transaction) throw new DigitalPurchaseError("DFlow returned a transaction that could not be read.");
      if (order.quote.executionMode !== "sync") throw new DigitalPurchaseError("DFlow did not return a synchronous order. Nothing was signed or sent.");
      return {
        executionMode: order.quote.executionMode,
        inAmount: order.quote.inAmount.toString(),
        outAmount: order.quote.outAmount.toString(),
        minOutAmount: order.quote.minOutAmount.toString(),
        slippageBps: order.quote.slippageBps,
        prioritizationFeeLamports: order.quote.prioritizationFeeLamports.toString(),
        inputMint: order.quote.inputMint,
        outputMint: order.quote.outputMint,
        lookupTables: parseDisclosedLookupTables(order.lookupTables),
        lastValidBlockHeight,
        blockhash: blockhashOf(transaction),
        transaction,
      };
    },
    async blockHeight() {
      const height = await rpc("getBlockHeight", [{ commitment: "confirmed" }]);
      if (typeof height !== "number") throw new Error("Solana did not return a block height.");
      return height;
    },
    async latestBlockhash() {
      const value = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]) as { value?: { blockhash?: string; lastValidBlockHeight?: number } };
      const blockhash = value?.value?.blockhash;
      const lastValidBlockHeight = value?.value?.lastValidBlockHeight;
      if (!blockhash || typeof lastValidBlockHeight !== "number" || !Number.isSafeInteger(lastValidBlockHeight)) {
        throw new Error("Solana did not return a blockhash.");
      }
      return { blockhash, lastValidBlockHeight };
    },
    async solLamports(owner) {
      const balances = await readSolanaBalances(owner, { rpcUrl: config.solanaRpcUrl, fetchImpl });
      return balances.find((asset) => asset.mint === NATIVE_SOL_MINT)?.amount ?? 0n;
    },
    async usdcAtomic(owner) {
      const balances = await readSolanaBalances(owner, { rpcUrl: config.solanaRpcUrl, fetchImpl });
      return balances.find((asset) => asset.mint === USDC_MINT)?.amount ?? 0n;
    },
    async sendSwap(signed) {
      beginExecution(gate());
      try {
        const signature = await rpc("sendTransaction", [Buffer.from(signed).toString("base64"), { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 0 }]);
        if (typeof signature !== "string") throw new SwapSubmissionLost();
        return signature;
      } catch (error) {
        if (error instanceof SwapAlreadyProcessed) throw error;
        if (error instanceof Error && /timeout|network|fetch/i.test(error.message)) throw new SwapSubmissionLost();
        throw error;
      }
    },
    async signatureStatus(signature) {
      const value = await rpc("getSignatureStatuses", [[signature], { searchTransactionHistory: true }]) as { value?: ({ err?: unknown; confirmationStatus?: string | null } | null)[] };
      const status = value?.value?.[0];
      if (!status) return null;
      return { err: status.err ?? null, confirmationStatus: status.confirmationStatus ?? null };
    },
    async orderStatus(signature) {
      const response = await fetchImpl(`${config.dflowBaseUrl.replace(/\/$/, "")}/order-status?signature=${encodeURIComponent(signature)}`, {
        headers: { accept: "application/json", ...(config.dflowApiKey ? { "x-api-key": config.dflowApiKey } : {}) },
        signal: AbortSignal.timeout(12_000),
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new SwapSubmissionLost();
      const body = await response.json() as { status?: unknown; outAmount?: unknown };
      if (typeof body.status !== "string" || typeof body.outAmount !== "string") return null;
      return { status: body.status, outAmount: body.outAmount };
    },
    async freshTerms(digest) {
      const response = await fetchImpl(bitcoinAnchorBuyUrl(digest), { method: "GET", redirect: "manual", headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
      if (response.status !== 402) throw new DigitalPurchaseError("The merchant did not return fresh terms.");
      const encoded = response.headers.get("payment-required");
      if (!encoded) throw new DigitalPurchaseError("The merchant quote header was missing.");
      return parseSolanaExactTerms(JSON.parse(Buffer.from(encoded, "base64").toString("utf8")), Date.now(), digest);
    },
    async submitPayment(payment) {
      beginExecution(gate());
      const url = new URL(payment.url);
      if (url.origin !== "https://scvd.store" || url.pathname !== "/api/buy/bitcoin_anchor") throw new Error("Unexpected merchant resource.");
      try {
        const response = await fetchImpl(payment.url, {
          method: "GET",
          redirect: "manual",
          headers: {
            accept: "application/json",
            "PAYMENT-SIGNATURE": paymentSignatureHeader(payment.authorization),
            "Idempotency-Key": payment.idempotencyKey,
          },
          signal: AbortSignal.timeout(30_000),
        });
        return { status: response.status, bodyText: await response.text(), paymentResponse: response.headers.get("payment-response") };
      } catch {
        throw new SwapSubmissionLost();
      }
    },
    async signingKeys() {
      const response = await fetchImpl("https://scvd.store/.well-known/scvd-signing-key", { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error("The signing key document was not available.");
      return publishedSigningKeys(await response.json());
    },
    async verifyCertificate(certId) {
      if (!/^cert_[A-Za-z0-9]+$/.test(certId)) throw new Error("The certificate id is not usable.");
      const response = await fetchImpl(`https://scvd.store/api/verify/${certId}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error("Certificate verification is unavailable.");
      return response.json();
    },
    async settlement(signature) {
      return rpc("getTransaction", [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]);
    },
    async purchaseStatus(url, token) {
      const allowed = safeStatusUrl(url, null);
      if (!allowed || !token) throw new Error("The recovery status URL is not the documented merchant status.");
      const response = await fetchImpl(allowed, { headers: { accept: "application/json", authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error("The recovery status was not available.");
      return response.json();
    },
  };
}

function blockhashOf(transaction: Uint8Array): string {
  const message = messageOf(transaction);
  const marker = message[0] ?? 0;
  const versioned = (marker & 128) !== 0;
  let offset = versioned ? 4 : 3;
  const accounts = readCompact(message, offset);
  offset = accounts.next;
  offset += accounts.value * 32;
  return encodeBase58(message.subarray(offset, offset + 32));
}

function readCompact(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let value = 0;
  let shift = 0;
  while (offset < bytes.length) {
    const part = bytes[offset++]!;
    value |= (part & 127) << shift;
    if ((part & 128) === 0) return { value, next: offset };
    shift += 7;
  }
  throw new Error("The transaction account list is truncated.");
}

export function executionStatus(journal: PurchaseJournal | null): ExecutionResult {
  const gate = mainnetExecutionGate();
  const workflow = journal?.read()?.workflow ?? null;
  return { executionGate: gate, ...stopped, error: workflow?.mismatch ?? null, purpose: null, unsignedTransaction: null, workflow: workflow ? publicWorkflow(workflow) : null };
}

export async function executeDigitalPurchase(request: Request, deps: {
  gate: () => "off" | "on";
  journalFor: (id: string) => PurchaseJournal;
  transports: () => PurchaseTransports;
} = {
  gate: () => mainnetExecutionGate(),
  journalFor: localPurchaseJournal,
  transports: () => createPurchaseTransports(readConfig(), () => mainnetExecutionGate()),
}): Promise<Response> {
  const headers = { "cache-control": "no-store" };
  if (!sameOriginRequest(request)) {
    return Response.json({ error: "Use the prepared purchase from SuperTab.", ...stopped, executionGate: deps.gate() }, { status: 403, headers });
  }
  const body = await request.json().catch(() => null) as { action?: unknown; attemptId?: unknown; wallet?: unknown; signedTransaction?: unknown; execute?: unknown; approved?: unknown } | null;
  const gate = deps.gate();
  if (gate !== "on") {
    return Response.json({
      executionGate: "off",
      ...stopped,
      error: new FinancialExecutionDisabled("mainnet purchase execution").message,
    }, { status: 403, headers });
  }
  const action = typeof body?.action === "string" && EXECUTION_ACTIONS.includes(body.action as ExecutionAction) ? body.action as ExecutionAction : null;
  const attemptId = typeof body?.attemptId === "string" ? body.attemptId : "";
  const wallet = typeof body?.wallet === "string" ? body.wallet : "";
  if (!action || !attemptId || !wallet || body?.execute === true || body?.approved === true) {
    return Response.json({ executionGate: gate, ...stopped, error: "A client flag is not spending approval." }, { status: 403, headers });
  }
  let signedTransaction: Uint8Array | undefined;
  if (typeof body?.signedTransaction === "string") {
    const bytes = Buffer.from(body.signedTransaction, "base64");
    if (bytes.length < 65 || bytes.length > 1232) {
      return Response.json({ executionGate: gate, ...stopped, error: "The signed transaction was rejected." }, { status: 400, headers });
    }
    signedTransaction = bytes;
  }
  if (SPENDING_ACTIONS.has(action)) beginExecution(gate);
  try {
    const result = await runPurchaseAttempt({
      gate, action, attemptId, wallet, signedTransaction, nowMs: Date.now(),
      journal: deps.journalFor(attemptId), transports: deps.transports(),
    });
    const status = result.error && !result.workflow ? 400 : 200;
    return Response.json(result, { status, headers });
  } catch (error) {
    if (error instanceof FinancialExecutionDisabled) {
      return Response.json({ executionGate: "off", ...stopped, error: error.message }, { status: 403, headers });
    }
    return Response.json({ executionGate: gate, ...stopped, error: "The attempt could not continue. No replacement payment was created." }, { status: 409, headers });
  }
}

