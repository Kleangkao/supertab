import { describe, expect, it } from "vitest";
import {
  attemptIdempotencyKey,
  bitcoinAnchorDigest,
  EXPECTED_AMOUNT_ATOMIC,
  REVIEWED_FEE_PAYER,
  REVIEWED_MERCHANT_RECIPIENT,
  SOLANA_MAINNET_CAIP,
} from "../src/lib/digital-purchase";
import {
  applyRecoveryEvent,
  CLAIM_REVIEW,
  createPreparedAttempt,
  persistConnectedAttempt,
  readStoredAttempt,
  rememberPreparedQuote,
  resumeAttempt,
  type AttemptStorage,
  type PurchaseAttempt,
} from "../src/lib/purchase-recovery";
import { USDC_MINT } from "../src/lib/tokens";

const payer = "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg";
const other = "So11111111111111111111111111111111111111112";
const digest = bitcoinAnchorDigest();
const mint = USDC_MINT;
const network = SOLANA_MAINNET_CAIP;

function memory(): AttemptStorage & { raw: string | null } {
  const box = { raw: null as string | null };
  return {
    get raw() { return box.raw; },
    set raw(value: string | null) { box.raw = value; },
    getItem: () => box.raw,
    setItem: (_key, value) => { box.raw = value; },
  };
}

function prepared(wallet = payer): PurchaseAttempt {
  return createPreparedAttempt({
    id: "attempt-1",
    walletSource: "connected",
    walletAddress: wallet,
    digest,
    idempotencyKey: attemptIdempotencyKey({ wallet, digest }),
    amountAtomic: EXPECTED_AMOUNT_ATOMIC.toString(),
    payTo: REVIEWED_MERCHANT_RECIPIENT,
    feePayer: REVIEWED_FEE_PAYER,
    merchantExpiresAt: "2026-10-05T16:00:00.000Z",
    nowIso: "2026-10-05T15:00:00.000Z",
  });
}

function signed(overrides: Record<string, unknown> = {}) {
  return {
    item: "bitcoin_anchor",
    attests: { digest },
    paid_usdc: 1,
    asset: mint,
    network,
    payer,
    settlement_tx: "settlement-1",
    ...overrides,
  };
}

describe("purchase recovery fixtures", () => {
  it("keeps one idempotency key for the wallet and digest", () => {
    const first = attemptIdempotencyKey({ wallet: payer, digest });
    const second = attemptIdempotencyKey({ wallet: payer, digest });
    expect(second).toBe(first);
    expect(first.length).toBeGreaterThanOrEqual(16);
    expect(first.length).toBeLessThanOrEqual(128);
    expect(attemptIdempotencyKey({ wallet: other, digest })).not.toBe(first);
  });

  it("labels the claim review as a disabled message, not a transaction", () => {
    expect(CLAIM_REVIEW.enabled).toBe(false);
    expect(CLAIM_REVIEW.distinguishes).toMatch(/signMessage/);
    expect(CLAIM_REVIEW.distinguishes).toMatch(/not a transaction/);
    expect(CLAIM_REVIEW.message).toMatch(/has not requested/);
  });

  it("does not pay again when the response is lost before a certificate id", () => {
    const lost = applyRecoveryEvent(prepared(), { id: "lost", type: "response_lost", nowIso: "2026-10-05T15:01:00.000Z" });
    expect(lost.attempt.state).toBe("submitted_outcome_unknown");
    expect(lost.attempt.certId).toBeNull();
    expect(lost.retryPayment).toBe(false);
    expect(lost.retrySwap).toBe(false);
    expect(lost.attempt.paymentAuthorization).toBe("not_stored");
    expect(JSON.stringify(lost.attempt)).not.toMatch(/transactionBase64|PAYMENT-SIGNATURE|privateKey/);
  });

  it("keeps a confirmed payment that has no certificate", () => {
    const confirmed = applyRecoveryEvent(prepared(), {
      id: "confirmed",
      type: "payment_confirmed_certificate_missing",
      nowIso: "2026-10-05T15:02:00.000Z",
    });
    expect(confirmed.attempt.state).toBe("payment_confirmed_certificate_missing");
    expect(confirmed.retryPayment).toBe(false);
    expect(confirmed.retrySwap).toBe(false);
  });

  it("treats a duplicate recovery request as the same attempt", () => {
    const first = applyRecoveryEvent(prepared(), { id: "lost", type: "response_lost", nowIso: "2026-10-05T15:01:00.000Z" });
    const second = applyRecoveryEvent(first.attempt, { id: "lost", type: "response_lost", nowIso: "2026-10-05T15:05:00.000Z" });
    expect(second.replayed).toBe(true);
    expect(second.attempt).toBe(first.attempt);
    expect(second.attempt.appliedEventIds).toEqual(["lost"]);
    expect(second.retryPayment).toBe(false);
    expect(second.retrySwap).toBe(false);
  });

  it("does not start a payment when the merchant quote expires during recovery", () => {
    const lost = applyRecoveryEvent(prepared(), { id: "lost", type: "response_lost", nowIso: "2026-10-05T15:01:00.000Z" }).attempt;
    const expired = applyRecoveryEvent(lost, { id: "expired", type: "quote_expired", nowIso: "2026-10-05T16:01:00.000Z" });
    expect(expired.attempt.state).toBe("submitted_outcome_unknown");
    expect(expired.attempt.quoteExpired).toBe(true);
    expect(expired.retryPayment).toBe(false);
    expect(expired.retrySwap).toBe(false);
    const replacement = rememberPreparedQuote(expired.attempt, prepared());
    expect(replacement.keptExisting).toBe(true);
    expect(replacement.attempt.id).toBe(expired.attempt.id);
    expect(replacement.reason).toMatch(/does not start another/);
  });

  it("rejects a changed payload, wallet, amount, recipient, or sponsor", () => {
    const attempt = prepared();
    const changed = applyRecoveryEvent(attempt, {
      id: "changed",
      type: "terms_changed",
      nowIso: "2026-10-05T15:03:00.000Z",
      digest: "ab".repeat(32),
      walletAddress: other,
      amountAtomic: "2000000",
      payTo: other,
      feePayer: other,
    });
    expect(changed.attempt.state).toBe("prepared_not_submitted");
    expect(changed.attempt.digest).toBe(digest);
    expect(changed.attempt.walletAddress).toBe(payer);
    expect(changed.attempt.amountAtomic).toBe("1000000");
    expect(changed.attempt.payTo).toBe(REVIEWED_MERCHANT_RECIPIENT);
    expect(changed.attempt.feePayer).toBe(REVIEWED_FEE_PAYER);
    expect(changed.attempt.mismatch).toMatch(/does not match/);
    expect(changed.retryPayment).toBe(false);
    expect(changed.retrySwap).toBe(false);
  });

  it("resumes an unresolved attempt after a restart and does not replace it", () => {
    const storage = memory();
    const lost = applyRecoveryEvent(prepared(), { id: "lost", type: "response_lost", nowIso: "2026-10-05T15:01:00.000Z" }).attempt;
    expect(persistConnectedAttempt(lost, storage)).toBe(true);
    const restored = readStoredAttempt(storage);
    const resumed = resumeAttempt(restored, payer);
    expect(resumed.foreign).toBe(false);
    expect(resumed.current?.state).toBe("submitted_outcome_unknown");
    const again = rememberPreparedQuote(resumed.current, prepared());
    expect(again.keptExisting).toBe(true);
    expect(again.attempt.idempotencyKey).toBe(lost.idempotencyKey);
    expect(again.attempt.state).toBe("submitted_outcome_unknown");
  });

  it("does not accept a certificate for a different purchase", () => {
    const lost = applyRecoveryEvent(prepared(), { id: "lost", type: "response_lost", nowIso: "2026-10-05T15:01:00.000Z" }).attempt;
    const mismatched = applyRecoveryEvent(lost, {
      id: "wrong-cert",
      type: "certificate",
      nowIso: "2026-10-05T15:04:00.000Z",
      certId: "cert_other",
      signed: signed({ item: "hello" }),
      proof: "pending",
      settlementTx: "settlement-1",
      mint,
      network,
    });
    expect(mismatched.attempt.state).toBe("recovery_unavailable");
    expect(mismatched.attempt.certId).toBeNull();
    expect(mismatched.attempt.mismatch).toMatch(/bitcoin_anchor/);
    expect(mismatched.retryPayment).toBe(false);
    expect(mismatched.retrySwap).toBe(false);
  });

  it("keeps a valid certificate while the Bitcoin proof is pending", () => {
    const pending = applyRecoveryEvent(prepared(), {
      id: "cert",
      type: "certificate",
      nowIso: "2026-10-05T15:04:00.000Z",
      certId: "cert_this",
      signed: signed(),
      proof: "pending",
      settlementTx: "settlement-1",
      mint,
      network,
    });
    expect(pending.attempt.state).toBe("timestamp_proof_pending");
    expect(pending.attempt.certId).toBe("cert_this");
    expect(pending.attempt.state).not.toBe("bitcoin_anchoring_verified");
    expect(pending.retryPayment).toBe(false);
    expect(pending.retrySwap).toBe(false);
  });

  it("does not store a read-only attempt or continue another wallet", () => {
    const storage = memory();
    const exploration = { ...prepared(), walletSource: "read_only" as const };
    expect(persistConnectedAttempt(exploration, storage)).toBe(false);
    expect(readStoredAttempt(storage)).toBeNull();
    persistConnectedAttempt(prepared(), storage);
    expect(resumeAttempt(readStoredAttempt(storage), other).foreign).toBe(true);
    expect(resumeAttempt(readStoredAttempt(storage), other).current).toBeNull();
    expect(readStoredAttempt(storage)?.walletAddress).toBe(payer);
  });
});
