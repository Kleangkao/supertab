import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signBytes, generateSolanaKey, type SolanaKey } from "../merchant/keys";
import { bitcoinAnchorDigest, REVIEWED_FEE_PAYER, REVIEWED_MERCHANT_RECIPIENT, SOLANA_MAINNET_CAIP } from "../src/lib/digital-purchase";
import { PurchaseJournal } from "../src/lib/purchase-journal";
import { POST as executePurchase } from "../src/app/api/digital-purchase/execute/route";
import {
  acceptApproval,
  acceptSignedMessage,
  conversionCapIsCoherent,
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
  sendIfGateOpen,
  skipConversion,
  verifyCertificateSignature,
  type BoundTerms,
  type PurchaseWorkflow,
  type SettlementProof,
} from "../src/lib/purchase-workflow";
import { USDC_MINT } from "../src/lib/tokens";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

const shopper = generateSolanaKey();
const digest = bitcoinAnchorDigest();
const message = Uint8Array.from([9, 8, 7, 6]);
const now = "2098-01-01T00:00:00.000Z";
const nowMs = Date.parse("2098-06-01T00:00:00.000Z");

function terms(overrides: Partial<BoundTerms> = {}): BoundTerms {
  const input = 1_000_000n;
  const fee = 100n;
  return {
    wallet: shopper.address,
    network: "solana:mainnet",
    productId: "bitcoin_anchor",
    digest,
    amountAtomic: "1000000",
    recipient: REVIEWED_MERCHANT_RECIPIENT,
    sponsor: REVIEWED_FEE_PAYER,
    conversionInputLamports: input.toString(),
    minimumOutputAtomic: "1000000",
    slippageBps: 50,
    prioritizationFeeLamports: fee.toString(),
    solCapLamports: (input + fee + 5_000n).toString(),
    reserveLamports: "10000000",
    merchantExpiresAt: "2099-01-01T00:00:00.000Z",
    blockhash: null,
    lastValidBlockHeight: null,
    ...overrides,
  };
}

function pack(signatures: Uint8Array[], body: Uint8Array = message): Uint8Array {
  return Uint8Array.from([signatures.length, ...signatures.flatMap((signature) => [...signature]), ...body]);
}

function zeros(): Uint8Array { return new Uint8Array(64); }

function sign(key: SolanaKey, body: Uint8Array = message): Uint8Array {
  return signBytes(key, body);
}

function approved(): PurchaseWorkflow {
  return acceptApproval(createReview("attempt-1", now), "approve", terms(), now, nowMs).workflow;
}

function preparedSwap(): PurchaseWorkflow {
  return prepareSwap(approved(), "prep-swap", now, {
    message, blockhash: "blockhash", lastValidBlockHeight: 50, walletLamports: 30_000_000n,
  }).workflow;
}

function settlement(): SettlementProof {
  return { signature: "settlement-sig", err: null, amountAtomic: "1000000", mint: USDC_MINT, destinationOwner: REVIEWED_MERCHANT_RECIPIENT, sourceOwner: shopper.address };
}

describe("purchase workflow fixtures", () => {
  it("keeps the execution gate off unless the server environment says otherwise", () => {
    expect(mainnetExecutionGate({})).toBe("off");
    expect(mainnetExecutionGate({ SUPERTAB_MAINNET_EXECUTION: "enabled" })).toBe("on");
    let sent = false;
    expect(() => sendIfGateOpen("off", () => { sent = true; })).toThrow(/disabled/);
    expect(sent).toBe(false);
  });

  it("rejects a client-shaped approval whose SOL cap double-counts the USDC total", () => {
    const doubled = terms({ solCapLamports: (1_000_000n + 100n + 5_000n + 1_000_000n).toString() });
    expect(conversionCapIsCoherent(doubled)).toMatch(/1 USDC/);
    const refused = acceptApproval(createReview("attempt-1", now), "approve", doubled, now, nowMs);
    expect(refused.workflow.state).toBe("review");
    expect(refused.retrySwap).toBe(false);
    expect(refused.retryPayment).toBe(false);
  });

  it("keeps an approved sponsor when a later quote names a different one", () => {
    const current = approved();
    const changed = invalidateApproval(current, "wallet", terms({ sponsor: "different-sponsor" }), now);
    expect(changed.workflow.state).toBe("approved_terms");
    expect(changed.workflow.terms?.sponsor).toBe(current.terms?.sponsor);
    expect(changed.workflow.mismatch).toMatch(/sponsor/);
    expect(changed.retryPayment).toBe(false);
    const expired = acceptApproval(createReview("attempt-1", now), "stale", terms({ merchantExpiresAt: "2000-01-01T00:00:00.000Z" }), now, nowMs);
    expect(expired.workflow.quoteExpired).toBe(true);
    expect(expired.workflow.state).toBe("review");
  });

  it("checks the shopper signature in slot 1 and leaves the sponsor slot empty", () => {
    let current = preparedSwap();
    current = acceptSignedMessage(current, "swap-sign", now, { signedTransaction: pack([sign(shopper)]), shopper: shopper.address, shopperSlot: 0 }).workflow;
    expect(current.state).toBe("swap_signed");
    current = markSwapSubmitted(current, "swap-submit", now).workflow;
    current = noteSwapConfirmed(current, "swap-ok", now, { err: null, signature: "swap-sig" }).workflow;
    current = recheckFunding(current, "funded", now, 2_000_000n).workflow;
    current = preparePayment(current, "pay-prep", now, nowMs, { message, blockhash: "payhash", lastValidBlockHeight: 80, merchantExpiresAt: "2099-01-01T00:00:00.000Z" }).workflow;
    const wrongSlot = acceptSignedMessage(current, "wrong-slot", now, { signedTransaction: pack([sign(shopper), zeros()]), shopper: shopper.address, shopperSlot: 0 });
    expect(wrongSlot.workflow.state).toBe("payment_prepared");
    expect(wrongSlot.workflow.mismatch).toMatch(/slot 1/);
    const sponsorFilled = acceptSignedMessage(current, "sponsor", now, { signedTransaction: pack([sign(shopper), sign(shopper)]), shopper: shopper.address, shopperSlot: 1 });
    expect(sponsorFilled.workflow.mismatch).toMatch(/sponsor/);
    const mutated = acceptSignedMessage(current, "mutated", now, { signedTransaction: pack([zeros(), sign(shopper)], Uint8Array.from([1])), shopper: shopper.address, shopperSlot: 1 });
    expect(mutated.workflow.mismatch).toMatch(/does not match/);
    const forged = acceptSignedMessage(current, "forged", now, { signedTransaction: pack([zeros(), new Uint8Array(64)]), shopper: shopper.address, shopperSlot: 1 });
    expect(forged.workflow.state).toBe("payment_prepared");
    expect(forged.retryPayment).toBe(false);
    const signed = acceptSignedMessage(current, "pay-sign", now, { signedTransaction: pack([zeros(), sign(shopper)]), shopper: shopper.address, shopperSlot: 1 });
    expect(signed.workflow.state).toBe("payment_signed");
    expect("retainedMessage" in publicWorkflow(signed.workflow)).toBe(false);
  });

  it("does not start another swap or payment after uncertain, failed, or lost outcomes", () => {
    let current = acceptSignedMessage(preparedSwap(), "swap-sign", now, { signedTransaction: pack([sign(shopper)]), shopper: shopper.address, shopperSlot: 0 }).workflow;
    const expired = noteLifetimeExpired(current, "expired-life", now, 90);
    expect(expired.workflow.state).toBe("swap_signed");
    expect(expired.workflow.lifetimeExpired).toBe(true);
    expect(refreshUnsignedLifetime(expired.workflow, "refresh", now, { message, blockhash: "new", lastValidBlockHeight: 99 }).workflow.mismatch).toMatch(/not altered/);
    current = { ...current, terms: current.terms ? { ...current.terms, lastValidBlockHeight: 100 } : null };
    current = markSwapSubmitted(current, "submit", now).workflow;
    const again = markSwapSubmitted(current, "submit", now);
    expect(again.replayed).toBe(true);
    expect(again.workflow).toBe(current);
    const failed = noteSwapConfirmed(current, "fail", now, null);
    expect(failed.workflow.state).toBe("swap_submitted_uncertain");
    expect(failed.retrySwap).toBe(false);
    const lost = noteResponseLost(current, "lost", now);
    expect(lost.workflow.state).toBe("swap_submitted_uncertain");
    expect(lost.retryPayment).toBe(false);
    const confirmed = noteSwapConfirmed(current, "ok", now, { err: null, signature: "swap-sig" }).workflow;
    const short = recheckFunding(confirmed, "short", now, 4n);
    expect(short.workflow.state).toBe("swap_confirmed");
    expect(short.workflow.usdcPreserved).toBe(true);
    expect(short.retrySwap).toBe(false);
    const funded = recheckFunding(confirmed, "funded", now, 2_000_000n).workflow;
    const stalePayment = preparePayment(funded, "stale-pay", now, nowMs, { message, blockhash: "x", lastValidBlockHeight: 1, merchantExpiresAt: "2000-01-01T00:00:00.000Z" });
    expect(stalePayment.workflow.state).toBe("funding_rechecked");
    expect(stalePayment.retryPayment).toBe(false);
  });

  it("restarts an unresolved attempt without creating a replacement payment", () => {
    const submitted = markSwapSubmitted(acceptSignedMessage(preparedSwap(), "swap-sign", now, {
      signedTransaction: pack([sign(shopper)]), shopper: shopper.address, shopperSlot: 0,
    }).workflow, "submit", now).workflow;
    const directory = mkdtempSync(join(tmpdir(), "supertab-workflow-"));
    directories.push(directory);
    const journal = new PurchaseJournal(join(directory, "attempt.enc"), Buffer.alloc(32, 3));
    journal.prepare({
      id: submitted.id, wallet: shopper.address, idempotencyKey: "workflow-key-00000001",
      requestUrl: "https://scvd.store/api/buy/bitcoin_anchor?digest=abc", requestBody: "",
      reviewedTerms: "{}", createdAt: now,
    });
    journal.saveWorkflow(submitted.id, submitted);
    const reopened = new PurchaseJournal(join(directory, "attempt.enc"), Buffer.alloc(32, 3));
    expect(reopened.read()?.workflow?.state).toBe("swap_submitted_uncertain");
    expect(() => reopened.saveWorkflow(submitted.id, createReview(submitted.id, now))).toThrow(/new purchase/);
    expect(readFileSync(join(directory, "attempt.enc"), "utf8")).not.toContain(shopper.address);
    const replaced = invalidateApproval(submitted, "changed", terms({ recipient: shopper.address }), now);
    expect(replaced.workflow.state).toBe("swap_submitted_uncertain");
    expect(replaced.retryPayment).toBe(false);
  });

  it("verifies a certificate signature and leaves Bitcoin proof pending", () => {
    let current = acceptSignedMessage(preparedSwap(), "swap-sign", now, { signedTransaction: pack([sign(shopper)]), shopper: shopper.address, shopperSlot: 0 }).workflow;
    current = markSwapSubmitted(current, "submit", now).workflow;
    current = noteSwapConfirmed(current, "ok", now, { err: null, signature: "swap-sig" }).workflow;
    current = recheckFunding(current, "funded", now, 2_000_000n).workflow;
    current = preparePayment(current, "pay", now, nowMs, { message, blockhash: "h", lastValidBlockHeight: 3, merchantExpiresAt: "2099-01-01T00:00:00.000Z" }).workflow;
    current = acceptSignedMessage(current, "pay-sign", now, { signedTransaction: pack([zeros(), sign(shopper)]), shopper: shopper.address, shopperSlot: 1 }).workflow;
    expect(markMerchantSubmitted(current, "too-soon", now).workflow.mismatch).toMatch(/authorization/);
    current = noteAuthorizationRetained(current, "retain", now).workflow;
    current = markMerchantSubmitted(current, "merchant", now).workflow;
    expect(current.state).toBe("merchant_submission_uncertain");
    const lost = noteResponseLost(current, "lost-pay", now);
    expect(lost.workflow.state).toBe("merchant_submission_uncertain");
    expect(lost.retryPayment).toBe(false);
    const missing = notePaymentConfirmedWithoutCertificate(current, "no-cert", now, settlement());
    expect(missing.workflow.state).toBe("payment_confirmed_certificate_missing");
    const payload = JSON.stringify({
      item: "bitcoin_anchor", attests: { digest }, paid_usdc: 1, asset: USDC_MINT,
      network: SOLANA_MAINNET_CAIP, payer: shopper.address, settlement_tx: "settlement-sig",
    });
    const signatureHex = Buffer.from(signBytes(shopper, Buffer.from(payload))).toString("hex");
    const publicKeyHex = Buffer.from(shopper.publicKey).toString("hex");
    expect(verifyCertificateSignature(payload, signatureHex, publicKeyHex)).toBe(true);
    const unrelated = noteCertificate(missing.workflow, "other", now, {
      certId: "cert_other", signedPayload: payload.replace("bitcoin_anchor", "hello"), signatureHex, publicKeyHex,
      trustedKeys: [publicKeyHex], proof: "pending", settlement: settlement(),
    });
    expect(unrelated.workflow.state).toBe("certificate_verification_unavailable");
    expect(unrelated.retryPayment).toBe(false);
    const pending = noteCertificate(missing.workflow, "pending", now, {
      certId: "cert_this", signedPayload: payload, signatureHex, publicKeyHex,
      trustedKeys: [publicKeyHex], proof: "pending", settlement: settlement(),
    });
    expect(pending.workflow.state).toBe("timestamp_proof_pending");
    expect(pending.workflow.state).not.toBe("bitcoin_anchor_verified");
    const untrusted = noteCertificate(missing.workflow, "untrusted", now, {
      certId: "cert_this", signedPayload: payload, signatureHex, publicKeyHex,
      trustedKeys: ["ab".repeat(32)], proof: "confirmed", settlement: settlement(),
    });
    expect(untrusted.workflow.mismatch).toMatch(/trusted/);
    const anchored = noteCertificate(missing.workflow, "anchored", now, {
      certId: "cert_this", signedPayload: payload, signatureHex, publicKeyHex,
      trustedKeys: [publicKeyHex], proof: "confirmed", settlement: settlement(),
    });
    expect(anchored.workflow.state).toBe("bitcoin_anchor_verified");
    expect(anchored.retrySwap).toBe(false);
    expect(anchored.retryPayment).toBe(false);
  });

  it("keeps converted funds when the balance is short and skips a swap when USDC already covers the total", () => {
    const covered = acceptApproval(createReview("attempt-2", now), "approve", terms({
      conversionInputLamports: null, minimumOutputAtomic: null, slippageBps: null,
      prioritizationFeeLamports: "0", solCapLamports: "0",
    }), now, nowMs).workflow;
    const skipped = skipConversion(covered, "skip", now, 2_000_000n);
    expect(skipped.workflow.state).toBe("funding_rechecked");
    expect(skipped.workflow.conversionSkipped).toBe(true);
    expect(skipConversion(covered, "short", now, 4n).retrySwap).toBe(false);
    const poor = prepareSwap(approved(), "poor", now, { message, blockhash: "b", lastValidBlockHeight: 1, walletLamports: 1n });
    expect(poor.workflow.state).toBe("approved_terms");
    expect(poor.retrySwap).toBe(false);
  });
});

describe("execution route", () => {
  it("rejects a bypass attempt without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const previous = process.env.SUPERTAB_MAINNET_EXECUTION;
    delete process.env.SUPERTAB_MAINNET_EXECUTION;
    try {
      const response = await executePurchase(new Request("http://localhost:3000/api/digital-purchase/execute", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({ execute: true, approved: true, walletSource: "connected" }),
      }));
      expect(response.status).toBe(403);
      const body = await response.json() as { executionGate: string; retrySwap: boolean; retryPayment: boolean; executionReady: boolean };
      expect(body.executionGate).toBe("off");
      expect(body.executionReady).toBe(false);
      expect(body.retrySwap).toBe(false);
      expect(body.retryPayment).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
      process.env.SUPERTAB_MAINNET_EXECUTION = "enabled";
      const opened = await executePurchase(new Request("http://localhost:3000/api/digital-purchase/execute", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({ execute: true }),
      }));
      expect(opened.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (previous == null) delete process.env.SUPERTAB_MAINNET_EXECUTION;
      else process.env.SUPERTAB_MAINNET_EXECUTION = previous;
      vi.unstubAllGlobals();
    }
  });
});
