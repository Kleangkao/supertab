/** Purchase orchestration. The HTTP server does not broadcast or submit a payment. */
import { createPublicKey, verify } from "node:crypto";
import {
  certificateCorrelates,
  EXPECTED_AMOUNT_ATOMIC,
  SOL_BASE_FEE_LAMPORTS,
  type SignedCertificateFields,
} from "./digital-purchase";
import { FinancialExecutionDisabled } from "./execution";
import { isUnresolvedWorkflow, type WorkflowStage } from "./purchase-status";
import { USDC_MINT } from "./tokens";
import { verifyEd25519 } from "./wallet-proof";

export interface BoundTerms {
  wallet: string;
  network: "solana:mainnet";
  productId: "bitcoin_anchor";
  digest: string;
  amountAtomic: string;
  recipient: string;
  sponsor: string;
  conversionInputLamports: string | null;
  minimumOutputAtomic: string | null;
  slippageBps: number | null;
  prioritizationFeeLamports: string;
  solCapLamports: string;
  reserveLamports: string;
  merchantExpiresAt: string;
  blockhash: string | null;
  lastValidBlockHeight: number | null;
}

export interface PurchaseWorkflow {
  version: 1;
  id: string;
  state: WorkflowStage;
  terms: BoundTerms | null;
  retainedMessage: string | null;
  conversionSkipped: boolean;
  swapSignature: string | null;
  settlementTx: string | null;
  certId: string | null;
  bitcoinProof: "absent" | "pending" | "confirmed";
  quoteExpired: boolean;
  lifetimeExpired: boolean;
  mismatch: string | null;
  usdcPreserved: boolean;
  paymentAuthorization: "not_stored" | "retained";
  appliedEventIds: string[];
  updatedAt: string;
  swapExecutionMode?: "sync" | "async" | null;
  pendingSwapSignature?: string | null;
  paymentMemo?: string | null;
}

export interface WorkflowStep {
  workflow: PurchaseWorkflow;
  retrySwap: false;
  retryPayment: false;
  replayed: boolean;
  refused: string | null;
}

const stopped = { retrySwap: false as const, retryPayment: false as const };

export function mainnetExecutionGate(env: Record<string, string | undefined> = process.env): "off" | "on" {
  return env.SUPERTAB_MAINNET_EXECUTION === "enabled" ? "on" : "off";
}

/** The route calls this before any adapter. A client flag cannot open it. */
export function beginExecution(gate: "off" | "on"): void {
  if (gate !== "on") throw new FinancialExecutionDisabled("mainnet purchase execution");
}

export function createReview(id: string, nowIso: string): PurchaseWorkflow {
  return {
    version: 1, id, state: "review", terms: null, retainedMessage: null, conversionSkipped: false,
    swapSignature: null, settlementTx: null, certId: null, bitcoinProof: "absent", quoteExpired: false,
    lifetimeExpired: false, mismatch: null, usdcPreserved: false, paymentAuthorization: "not_stored",
    appliedEventIds: [], updatedAt: nowIso, swapExecutionMode: null, pendingSwapSignature: null, paymentMemo: null,
  };
}

export function parseWorkflow(value: unknown): PurchaseWorkflow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as PurchaseWorkflow;
  if (record.version !== 1 || !record.id || !record.state) return null;
  if (record.paymentAuthorization !== "not_stored" && record.paymentAuthorization !== "retained") return null;
  return record;
}

function step(workflow: PurchaseWorkflow, replayed = false, refused: string | null = null): WorkflowStep {
  return { workflow, ...stopped, replayed, refused };
}

function once(workflow: PurchaseWorkflow, eventId: string, nowIso: string): PurchaseWorkflow | WorkflowStep {
  if (workflow.appliedEventIds.includes(eventId)) return step(workflow, true);
  return { ...workflow, appliedEventIds: [...workflow.appliedEventIds, eventId], updatedAt: nowIso };
}

function materialDifference(current: BoundTerms, next: BoundTerms): string | null {
  const fields: (keyof BoundTerms)[] = [
    "wallet", "network", "productId", "digest", "amountAtomic", "recipient", "sponsor",
    "conversionInputLamports", "minimumOutputAtomic", "slippageBps", "prioritizationFeeLamports",
    "solCapLamports", "reserveLamports",
  ];
  const changed = fields.filter((field) => current[field] !== next[field]);
  return changed.length ? `Approval no longer matches: ${changed.join(", ")}.` : null;
}

/** SOL cap is conversion input plus its network fees. The 1 USDC total is not added again. */
export function conversionCapIsCoherent(terms: BoundTerms): string | null {
  if (terms.amountAtomic !== EXPECTED_AMOUNT_ATOMIC.toString()) return "The merchant amount is not 1.000000 USDC.";
  if (terms.conversionInputLamports == null) {
    if (terms.solCapLamports !== "0") return "A covered USDC balance has no SOL conversion cap.";
    return null;
  }
  const expected = BigInt(terms.conversionInputLamports) + BigInt(terms.prioritizationFeeLamports) + SOL_BASE_FEE_LAMPORTS;
  const cap = BigInt(terms.solCapLamports);
  if (cap === expected + EXPECTED_AMOUNT_ATOMIC) return "The 1 USDC total was added to the SOL cap.";
  if (cap !== expected) return "The SOL cap does not match the conversion input plus its fees.";
  return null;
}

export function acceptApproval(workflow: PurchaseWorkflow, eventId: string, terms: BoundTerms, nowIso: string, nowMs: number): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  if (isUnresolvedWorkflow(workflow.state)) {
    return step({ ...next, mismatch: "An unresolved attempt cannot be replaced by a new approval." });
  }
  const incoherent = conversionCapIsCoherent(terms);
  if (incoherent) return step({ ...next, state: "review", mismatch: incoherent });
  if (nowMs >= Date.parse(terms.merchantExpiresAt)) {
    return step({ ...next, state: "review", quoteExpired: true, mismatch: "The merchant quote expired. Approval needs a new review." });
  }
  if (workflow.terms) {
    const difference = materialDifference(workflow.terms, terms);
    if (difference) {
      if (workflow.state !== "review") return step({ ...next, mismatch: difference });
      return step({ ...next, state: "review", terms: null, mismatch: difference });
    }
    if (workflow.state !== "review") return step({ ...next, mismatch: null });
  }
  return step({ ...next, state: "approved_terms", terms, mismatch: null, quoteExpired: false });
}

export function invalidateApproval(workflow: PurchaseWorkflow, eventId: string, nextTerms: BoundTerms, nowIso: string): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  if (!workflow.terms) return step(next);
  const difference = materialDifference(workflow.terms, nextTerms);
  if (!difference) return step(next);
  if (workflow.state !== "review") return step({ ...next, mismatch: difference });
  return step({ ...next, state: "review", terms: null, mismatch: difference });
}

export function prepareSwap(workflow: PurchaseWorkflow, eventId: string, nowIso: string, input: {
  message: Uint8Array; blockhash: string; lastValidBlockHeight: number; walletLamports: bigint;
}): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  if (workflow.state !== "approved_terms" || !workflow.terms) return step({ ...next, mismatch: "A swap needs approved terms." });
  if (workflow.terms.conversionInputLamports == null) return step({ ...next, mismatch: "This approval does not include a conversion." });
  const cap = BigInt(workflow.terms.solCapLamports);
  const reserve = BigInt(workflow.terms.reserveLamports);
  if (input.walletLamports < cap + reserve) {
    return step({ ...next, mismatch: "The wallet cannot cover the SOL cap and the reserve." });
  }
  return step({
    ...next,
    state: "swap_prepared",
    retainedMessage: Buffer.from(input.message).toString("base64"),
    terms: { ...workflow.terms, blockhash: input.blockhash, lastValidBlockHeight: input.lastValidBlockHeight },
  });
}

export function skipConversion(workflow: PurchaseWorkflow, eventId: string, nowIso: string, usdcAtomic: bigint): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  if (workflow.state !== "approved_terms" || !workflow.terms) return step({ ...next, mismatch: "Funding still needs approved terms." });
  if (workflow.terms.conversionInputLamports != null) return step({ ...next, mismatch: "This approval still includes a conversion." });
  if (usdcAtomic < EXPECTED_AMOUNT_ATOMIC) return step({ ...next, mismatch: "Confirmed USDC does not cover 1.000000 USDC." });
  return step({ ...next, state: "funding_rechecked", conversionSkipped: true, terms: { ...workflow.terms, solCapLamports: "0", conversionInputLamports: null } });
}

export function acceptSignedMessage(workflow: PurchaseWorkflow, eventId: string, nowIso: string, input: {
  signedTransaction: Uint8Array; shopper: string; shopperSlot: 0 | 1; sponsorSlot?: 0;
}): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  const expected = workflow.state === "swap_prepared" ? "swap_signed" : workflow.state === "payment_prepared" ? "payment_signed" : null;
  if (!expected || !workflow.retainedMessage || !workflow.terms) return step({ ...next, mismatch: "There is no prepared transaction to sign." });
  if (expected === "payment_signed" && input.shopperSlot !== 1) {
    return step({ ...next, mismatch: "The shopper signature must be slot 1. The sponsor remains slot 0." });
  }
  if (expected === "swap_signed" && input.shopperSlot !== 0) {
    return step({ ...next, mismatch: "The conversion fee payer must sign slot 0." });
  }
  try {
    assertSignedMessage({
      signedTransaction: input.signedTransaction,
      retainedMessage: Buffer.from(workflow.retainedMessage, "base64"),
      shopper: input.shopper,
      shopperSlot: input.shopperSlot,
      sponsorMustBeAbsent: expected === "payment_signed",
    });
  } catch (error) {
    return step({ ...next, mismatch: error instanceof Error ? error.message : "The signed transaction was rejected." });
  }
  if (workflow.terms.wallet !== input.shopper) return step({ ...next, mismatch: "The signer is not the approved wallet." });
  return step({ ...next, state: expected });
}

export function refreshUnsignedLifetime(workflow: PurchaseWorkflow, eventId: string, nowIso: string, input: {
  message: Uint8Array; blockhash: string; lastValidBlockHeight: number;
}): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  if (workflow.state === "swap_signed" || workflow.state === "payment_signed" || isUnresolvedWorkflow(workflow.state)) {
    return step({ ...next, mismatch: "A signed or submitted transaction was not altered." });
  }
  if ((workflow.state !== "swap_prepared" && workflow.state !== "payment_prepared") || !workflow.terms) {
    return step({ ...next, mismatch: "A fresh lifetime applies only to an unsigned prepared transaction." });
  }
  return step({
    ...next,
    retainedMessage: Buffer.from(input.message).toString("base64"),
    lifetimeExpired: false,
    terms: { ...workflow.terms, blockhash: input.blockhash, lastValidBlockHeight: input.lastValidBlockHeight },
  });
}

export function noteLifetimeExpired(workflow: PurchaseWorkflow, eventId: string, nowIso: string, currentBlockHeight: number): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  const height = workflow.terms?.lastValidBlockHeight;
  if (height == null || currentBlockHeight <= height) return step(next);
  if (workflow.state === "swap_signed" || workflow.state === "payment_signed") {
    return step({ ...next, lifetimeExpired: true, mismatch: "The signed transaction expired. It was not replaced." });
  }
  if (workflow.state === "swap_prepared" || workflow.state === "payment_prepared") {
    return step({ ...next, lifetimeExpired: true, retainedMessage: null, mismatch: "The unsigned lifetime expired. Prepare a fresh transaction for the same approval." });
  }
  return step({ ...next, lifetimeExpired: true });
}

/** Persist the uncertain state before calling the sender. The sender is not invoked when the gate is off. */
export function markSwapSubmitted(workflow: PurchaseWorkflow, eventId: string, nowIso: string): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  if (workflow.state !== "swap_signed") return step({ ...next, mismatch: "A swap can be submitted only after its signature is checked." });
  if (workflow.lifetimeExpired) return step({ ...next, mismatch: "The signed swap expired. No replacement swap was created." });
  return step({ ...next, state: "swap_submitted_uncertain" });
}

export function markMerchantSubmitted(workflow: PurchaseWorkflow, eventId: string, nowIso: string): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  if (workflow.state !== "payment_signed" || workflow.paymentAuthorization !== "retained") {
    return step({ ...next, mismatch: "Persist the original payment authorization before merchant submission." });
  }
  if (workflow.quoteExpired || workflow.lifetimeExpired) {
    return step({ ...next, mismatch: "Expired authorization is not replayed." });
  }
  return step({ ...next, state: "merchant_submission_uncertain" });
}

export function sendIfGateOpen(gate: "off" | "on", send: () => void): void {
  beginExecution(gate);
  send();
}

export function noteSwapConfirmed(workflow: PurchaseWorkflow, eventId: string, nowIso: string, chain: { err: unknown; signature: string } | null): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  if (workflow.state !== "swap_submitted_uncertain") return step({ ...next, mismatch: "Confirmation requires the original submitted swap." });
  if (!chain || chain.err != null || !chain.signature) {
    return step({ ...next, mismatch: "The swap is not confirmed. No second swap was started." });
  }
  return step({ ...next, state: "swap_confirmed", swapSignature: chain.signature });
}

export function recheckFunding(workflow: PurchaseWorkflow, eventId: string, nowIso: string, usdcAtomic: bigint): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  if (workflow.state !== "swap_confirmed" && workflow.state !== "funding_rechecked") {
    return step({ ...next, mismatch: "Funding is checked from a confirmed balance, not from a quote." });
  }
  if (usdcAtomic < EXPECTED_AMOUNT_ATOMIC) {
    return step({ ...next, usdcPreserved: workflow.state === "swap_confirmed" || workflow.usdcPreserved, mismatch: "Converted USDC stays in the wallet. The merchant payment was not started." });
  }
  return step({ ...next, state: "funding_rechecked", usdcPreserved: false, mismatch: null });
}

export function preparePayment(workflow: PurchaseWorkflow, eventId: string, nowIso: string, nowMs: number, input: {
  message: Uint8Array; blockhash: string; lastValidBlockHeight: number; merchantExpiresAt: string;
}): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  if (workflow.state !== "funding_rechecked" || !workflow.terms) return step({ ...next, mismatch: "Payment waits for a funding recheck." });
  if (nowMs >= Date.parse(input.merchantExpiresAt)) {
    return step({ ...next, quoteExpired: true, mismatch: "The merchant quote expired. No replacement payment was prepared." });
  }
  return step({
    ...next,
    state: "payment_prepared",
    quoteExpired: false,
    retainedMessage: Buffer.from(input.message).toString("base64"),
    terms: { ...workflow.terms, merchantExpiresAt: input.merchantExpiresAt, blockhash: input.blockhash, lastValidBlockHeight: input.lastValidBlockHeight },
  });
}

export function noteResponseLost(workflow: PurchaseWorkflow, eventId: string, nowIso: string): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  if (workflow.state !== "swap_submitted_uncertain" && workflow.state !== "merchant_submission_uncertain") return step(next);
  return step({ ...next, mismatch: "The response is lost. The original attempt stays unresolved." });
}

export function notePaymentConfirmedWithoutCertificate(workflow: PurchaseWorkflow, eventId: string, nowIso: string, settlement: SettlementProof | null): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  if (workflow.state !== "merchant_submission_uncertain" || !workflow.terms) return step(next);
  if (!settlementMatches(settlement, workflow.terms)) {
    return step({ ...next, mismatch: "A success claim without matching on-chain settlement was not accepted." });
  }
  return step({ ...next, state: "payment_confirmed_certificate_missing", settlementTx: settlement!.signature, usdcPreserved: false });
}

export interface SettlementProof {
  signature: string;
  err: null;
  amountAtomic: string;
  mint: string;
  destinationOwner: string;
  sourceOwner: string;
}

export function settlementMatches(proof: SettlementProof | null, terms: BoundTerms): proof is SettlementProof {
  return !!proof && proof.err == null && proof.amountAtomic === terms.amountAtomic && proof.mint === USDC_MINT
    && proof.destinationOwner === terms.recipient && proof.sourceOwner === terms.wallet && proof.signature.length > 0;
}

export function noteCertificate(workflow: PurchaseWorkflow, eventId: string, nowIso: string, input: {
  certId: string;
  signedPayload: string;
  signatureHex: string;
  publicKeyHex: string;
  trustedKeys: string[];
  proof: "pending" | "confirmed" | "unavailable";
  settlement: SettlementProof | null;
}): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  if (!workflow.terms) return step({ ...next, mismatch: "A certificate needs the original approved terms." });
  if (workflow.state !== "merchant_submission_uncertain" && workflow.state !== "payment_confirmed_certificate_missing" && workflow.state !== "certificate_verification_unavailable") {
    return step({ ...next, mismatch: "A certificate does not replace an unsent payment." });
  }
  if (!input.trustedKeys.map((key) => key.toLowerCase()).includes(input.publicKeyHex.toLowerCase())) {
    return step({ ...next, state: "certificate_verification_unavailable", mismatch: "The signing key is not in the trusted key document." });
  }
  let payload: SignedCertificateFields;
  try {
    if (!verifyCertificateSignature(input.signedPayload, input.signatureHex, input.publicKeyHex)) {
      return step({ ...next, state: "certificate_verification_unavailable", mismatch: "The certificate signature does not verify." });
    }
    payload = JSON.parse(input.signedPayload) as SignedCertificateFields;
  } catch {
    return step({ ...next, state: "certificate_verification_unavailable", mismatch: "Certificate verification is unavailable. No replacement payment was created." });
  }
  const settlementTx = input.settlement?.signature ?? workflow.settlementTx;
  const correlated = certificateCorrelates(payload, {
    digest: workflow.terms.digest,
    payer: workflow.terms.wallet,
    amountAtomic: workflow.terms.amountAtomic,
    mint: USDC_MINT,
    network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    settlementTx,
  });
  if (!correlated.correlates || !settlementMatches(input.settlement, workflow.terms)) {
    return step({ ...next, state: "certificate_verification_unavailable", certId: null, mismatch: correlated.gaps.join(" ") || "On-chain settlement does not match this purchase." });
  }
  if (input.proof === "unavailable") {
    return step({ ...next, state: "certificate_verification_unavailable", mismatch: "The certificate body was not independently verified." });
  }
  const proved = input.proof === "confirmed";
  return step({
    ...next,
    state: proved ? "bitcoin_anchor_verified" : "timestamp_proof_pending",
    certId: input.certId,
    settlementTx,
    bitcoinProof: proved ? "confirmed" : "pending",
    mismatch: null,
  });
}

export function verifyCertificateSignature(signedPayload: string, signatureHex: string, publicKeyHex: string): boolean {
  if (!/^[0-9a-f]{128}$/i.test(signatureHex) || !/^[0-9a-f]{64}$/i.test(publicKeyHex)) return false;
  const key = createPublicKey({
    format: "der",
    type: "spki",
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicKeyHex, "hex")]),
  });
  return verify(null, Buffer.from(signedPayload, "utf8"), key, Buffer.from(signatureHex, "hex"));
}

export function boundTermsFromStoredReview(json: string, wallet: string): BoundTerms | null {
  try {
    const parsed = JSON.parse(json) as {
      terms?: { digest?: unknown; amountAtomic?: unknown; payTo?: unknown; feePayer?: unknown; expiresAt?: unknown };
      conversion?: { status?: unknown; inputLamports?: unknown; minimumUsdcAtomic?: unknown; slippageBps?: unknown; prioritizationFeeLamports?: unknown };
      spend?: { solLamports?: unknown; reserveLamports?: unknown };
    };
    const posted = readBoundTerms({
      wallet,
      digest: parsed.terms?.digest,
      amountAtomic: parsed.terms?.amountAtomic,
      recipient: parsed.terms?.payTo,
      sponsor: parsed.terms?.feePayer,
      merchantExpiresAt: parsed.terms?.expiresAt,
      conversionInputLamports: parsed.conversion?.status === "skipped" ? null : parsed.conversion?.inputLamports,
      minimumOutputAtomic: parsed.conversion?.status === "skipped" ? null : parsed.conversion?.minimumUsdcAtomic,
      slippageBps: parsed.conversion?.status === "skipped" ? null : parsed.conversion?.slippageBps,
      prioritizationFeeLamports: parsed.conversion?.prioritizationFeeLamports ?? "0",
      solCapLamports: parsed.spend?.solLamports,
      reserveLamports: parsed.spend?.reserveLamports,
    });
    return posted;
  } catch {
    return null;
  }
}

export function readBoundTerms(value: unknown): BoundTerms | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const text = (key: string) => typeof body[key] === "string" ? body[key] as string : null;
  const nullable = (key: string) => body[key] == null ? null : typeof body[key] === "string" ? body[key] as string : null;
  const slippage = body.slippageBps == null ? null : typeof body.slippageBps === "number" ? body.slippageBps : null;
  if (body.network != null && body.network !== "solana:mainnet") return null;
  if (body.productId != null && body.productId !== "bitcoin_anchor") return null;
  const wallet = text("wallet");
  const digest = text("digest");
  const amountAtomic = text("amountAtomic");
  const recipient = text("recipient");
  const sponsor = text("sponsor");
  const merchantExpiresAt = text("merchantExpiresAt");
  const solCapLamports = text("solCapLamports");
  const reserveLamports = text("reserveLamports");
  const prioritizationFeeLamports = text("prioritizationFeeLamports");
  if (!wallet || !digest || !amountAtomic || !recipient || !sponsor || !merchantExpiresAt || !solCapLamports || !reserveLamports || !prioritizationFeeLamports) return null;
  if (body.conversionInputLamports != null && typeof body.conversionInputLamports !== "string") return null;
  if (body.minimumOutputAtomic != null && typeof body.minimumOutputAtomic !== "string") return null;
  if (body.slippageBps != null && typeof body.slippageBps !== "number") return null;
  return {
    wallet, network: "solana:mainnet", productId: "bitcoin_anchor", digest, amountAtomic, recipient, sponsor,
    conversionInputLamports: nullable("conversionInputLamports"),
    minimumOutputAtomic: nullable("minimumOutputAtomic"),
    slippageBps: slippage,
    prioritizationFeeLamports, solCapLamports, reserveLamports, merchantExpiresAt,
    blockhash: null, lastValidBlockHeight: null,
  };
}

export function publicWorkflow(workflow: PurchaseWorkflow): Omit<PurchaseWorkflow, "retainedMessage"> & {
  executionGate: "off" | "on"; executionReady: false; retrySwap: false; retryPayment: false;
} {
  const visible: Omit<PurchaseWorkflow, "retainedMessage"> = {
    version: workflow.version, id: workflow.id, state: workflow.state, terms: workflow.terms,
    conversionSkipped: workflow.conversionSkipped, swapSignature: workflow.swapSignature,
    settlementTx: workflow.settlementTx, certId: workflow.certId, bitcoinProof: workflow.bitcoinProof,
    quoteExpired: workflow.quoteExpired, lifetimeExpired: workflow.lifetimeExpired, mismatch: workflow.mismatch,
    usdcPreserved: workflow.usdcPreserved, paymentAuthorization: workflow.paymentAuthorization,
    appliedEventIds: workflow.appliedEventIds, updatedAt: workflow.updatedAt,
    swapExecutionMode: workflow.swapExecutionMode ?? null,
    pendingSwapSignature: workflow.pendingSwapSignature ?? null,
    paymentMemo: workflow.paymentMemo ?? null,
  };
  return { ...visible, ...stopped, executionGate: mainnetExecutionGate(), executionReady: false };
}

export function resumeWorkflow(stored: PurchaseWorkflow | null, wallet: string): { current: PurchaseWorkflow | null; foreign: boolean } {
  if (!stored) return { current: null, foreign: false };
  if (stored.terms && stored.terms.wallet !== wallet) return { current: null, foreign: true };
  return { current: stored, foreign: false };
}

export function assertSignedMessage(input: {
  signedTransaction: Uint8Array;
  retainedMessage: Uint8Array;
  shopper: string;
  shopperSlot: number;
  sponsorMustBeAbsent: boolean;
}): void {
  const parsed = splitSignatures(input.signedTransaction);
  if (!bytesEqual(parsed.message, input.retainedMessage)) throw new Error("The signed message does not match the retained transaction.");
  if (input.sponsorMustBeAbsent) {
    const sponsor = parsed.signatures[0];
    if (!sponsor || sponsor.some((byte) => byte !== 0)) throw new Error("The sponsor signature slot is not empty.");
  }
  const signature = parsed.signatures[input.shopperSlot];
  if (!signature) throw new Error("The shopper signature slot is missing.");
  verifyEd25519(input.shopper, parsed.message, signature);
}

export function noteAuthorizationRetained(workflow: PurchaseWorkflow, eventId: string, nowIso: string): WorkflowStep {
  const next = once(workflow, eventId, nowIso);
  if ("workflow" in next) return next;
  if (workflow.state !== "payment_signed") return step({ ...next, mismatch: "Authorization is retained only for the signed payment." });
  return step({ ...next, paymentAuthorization: "retained" });
}

function splitSignatures(bytes: Uint8Array): { signatures: Uint8Array[]; message: Uint8Array } {
  if (bytes.length < 65 || bytes[0]! < 1 || bytes[0]! > 4) throw new Error("The transaction signature list is not usable.");
  const count = bytes[0]!;
  const end = 1 + count * 64;
  if (bytes.length <= end) throw new Error("The transaction signature list is truncated.");
  const signatures = Array.from({ length: count }, (_, index) => bytes.subarray(1 + index * 64, 1 + (index + 1) * 64));
  return { signatures, message: bytes.subarray(end) };
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  return left.every((byte, index) => byte === right[index]);
}
