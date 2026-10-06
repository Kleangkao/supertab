import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { associatedTokenAddress } from "../merchant/ata";
import { generateSolanaKey, signBytes, type SolanaKey } from "../merchant/keys";
import { compile } from "../merchant/transaction";
import { runPurchaseAttempt, createPurchaseTransports, type PurchaseTransports } from "../src/lib/purchase-execution";
import { COMPUTE_BUDGET_PROGRAM, DFLOW_SWAP_PROGRAM } from "../src/lib/conversion-review";
import { bitcoinAnchorBuyUrl, bitcoinAnchorDigest, parseSolanaExactTerms, REVIEWED_FEE_PAYER, REVIEWED_MERCHANT_RECIPIENT, SOLANA_MAINNET_CAIP } from "../src/lib/digital-purchase";
import { PurchaseJournal } from "../src/lib/purchase-journal";
import { acceptApproval, createReview, type BoundTerms } from "../src/lib/purchase-workflow";
import { USDC_MINT, WSOL_MINT } from "../src/lib/tokens";
import { TOKEN_PROGRAM } from "../merchant/product";
import { FinancialExecutionDisabled } from "../src/lib/execution";
import { SwapSubmissionLost } from "../src/lib/swap-adapter";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

const shopper = generateSolanaKey();
const signer = generateSolanaKey();
const digest = bitcoinAnchorDigest();
const now = "2099-01-01T00:00:00.000Z";
const nowMs = Date.parse(now);
const inputLamports = 1_000_000n;
const priority = 1_000n;
const minimum = 1_000_000n;
const output = 1_200_000n;

function journal(): { book: PurchaseJournal; path: string } {
  const directory = mkdtempSync(join(tmpdir(), "supertab-execution-"));
  directories.push(directory);
  const path = join(directory, "attempt.enc");
  return { book: new PurchaseJournal(path, Buffer.alloc(32, 7)), path };
}

function terms(overrides: Partial<BoundTerms> = {}): BoundTerms {
  return {
    wallet: shopper.address,
    network: "solana:mainnet",
    productId: "bitcoin_anchor",
    digest,
    amountAtomic: "1000000",
    recipient: REVIEWED_MERCHANT_RECIPIENT,
    sponsor: REVIEWED_FEE_PAYER,
    conversionInputLamports: inputLamports.toString(),
    minimumOutputAtomic: minimum.toString(),
    slippageBps: 50,
    prioritizationFeeLamports: priority.toString(),
    solCapLamports: (inputLamports + priority + 5_000n).toString(),
    reserveLamports: "10000000",
    merchantExpiresAt: "2099-01-01T00:05:00.000Z",
    blockhash: null,
    lastValidBlockHeight: null,
    ...overrides,
  };
}

function u64(value: bigint): number[] {
  return Array.from({ length: 8 }, (_, index) => Number((value >> BigInt(index * 8)) & 255n));
}

function swapTransaction(): Uint8Array {
  const units = new Uint8Array(5);
  units[0] = 2;
  new DataView(units.buffer).setUint32(1, 200_000, true);
  const price = new Uint8Array(9);
  price[0] = 3;
  new DataView(price.buffer).setBigUint64(1, 5_000n, true);
  const data = Uint8Array.from([...u64(inputLamports), ...u64(output), ...u64(minimum)]);
  return compile({
    blockhash: "11111111111111111111111111111111",
    accounts: [
      { address: shopper.address, signer: true, writable: true },
      { address: associatedTokenAddress(shopper.address, USDC_MINT), signer: false, writable: true },
      ...[WSOL_MINT, USDC_MINT, DFLOW_SWAP_PROGRAM, COMPUTE_BUDGET_PROGRAM, TOKEN_PROGRAM].map((address) => ({ address, signer: false, writable: false })),
    ],
    instructions: [
      { program: COMPUTE_BUDGET_PROGRAM, accounts: [], data: units },
      { program: COMPUTE_BUDGET_PROGRAM, accounts: [], data: price },
      { program: DFLOW_SWAP_PROGRAM, accounts: [], data },
    ],
  }).transaction;
}

function signSlot(transaction: Uint8Array, key: SolanaKey, slot: number): Uint8Array {
  const count = transaction[0] ?? 0;
  const message = transaction.subarray(1 + count * 64);
  const signed = Uint8Array.from(transaction);
  signed.set(signBytes(key, message), 1 + slot * 64);
  return signed;
}

function freshTerms() {
  return parseSolanaExactTerms({
    x402Version: 2,
    resource: { url: bitcoinAnchorBuyUrl(digest) },
    accepts: [{
      scheme: "exact", network: SOLANA_MAINNET_CAIP, asset: USDC_MINT, amount: "1000000", payTo: REVIEWED_MERCHANT_RECIPIENT,
      maxTimeoutSeconds: 300, extra: { feePayer: REVIEWED_FEE_PAYER, quotedAt: now },
    }],
  }, nowMs, digest);
}

function counters() {
  return { send: 0, payment: 0, order: 0, status: 0 };
}

function transports(calls: ReturnType<typeof counters>, overrides: Partial<PurchaseTransports> = {}): PurchaseTransports {
  const unsigned = swapTransaction();
  return {
    quoteSwap: async () => ({
      executionMode: "sync",
      inAmount: inputLamports.toString(),
      outAmount: output.toString(),
      minOutAmount: minimum.toString(),
      slippageBps: 50,
      prioritizationFeeLamports: priority.toString(),
      inputMint: WSOL_MINT,
      outputMint: USDC_MINT,
      lookupTables: [],
      lastValidBlockHeight: 500,
      blockhash: "11111111111111111111111111111111",
      transaction: unsigned,
    }),
    blockHeight: async () => 100,
    latestBlockhash: async () => ({ blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 800 }),
    solLamports: async () => 30_000_000n,
    usdcAtomic: async () => 2_000_000n,
    sendSwap: async () => { calls.send += 1; throw new Error("send was not stubbed"); },
    signatureStatus: async () => { calls.status += 1; return { err: null, confirmationStatus: "confirmed" }; },
    orderStatus: async () => { calls.order += 1; return { status: "closed", outAmount: minimum.toString() }; },
    freshTerms: async () => freshTerms(),
    submitPayment: async () => { calls.payment += 1; throw new Error("payment was not stubbed"); },
    signingKeys: async () => [Buffer.from(signer.publicKey).toString("hex")],
    verifyCertificate: async () => { throw new Error("verify was not stubbed"); },
    settlement: async () => null,
    purchaseStatus: async () => null,
    ...overrides,
  };
}

function seed(id: string, approved: BoundTerms): { book: PurchaseJournal; path: string } {
  const stored = journal();
  stored.book.prepare({
    id, wallet: shopper.address, idempotencyKey: id, requestUrl: bitcoinAnchorBuyUrl(digest),
    requestBody: "", reviewedTerms: "{}", createdAt: now,
  });
  const workflow = acceptApproval(createReview(id, now), "approve", approved, now, nowMs).workflow;
  expect(workflow.state).toBe("approved_terms");
  stored.book.saveWorkflow(id, workflow);
  return stored;
}

describe("purchase execution adapters", () => {
  it("requests a synchronous DFlow route and does not spend while the gate is off", async () => {
    let requested = "";
    const live = createPurchaseTransports({
      solanaRpcUrl: "https://rpc.example", dflowBaseUrl: "https://dflow.example", dflowApiKey: null, dflowSlippageBps: 50,
    } as never, () => "off", async (input) => {
      requested = String(input);
      return new Response(JSON.stringify({ executionMode: "async" }), { status: 200 });
    });
    await expect(live.quoteSwap({ wallet: shopper.address, amount: inputLamports, slippageBps: 50 })).rejects.toThrow(/DFlow/);
    expect(requested).toContain("allowSyncExec=true");
    expect(requested).toContain("allowAsyncExec=false");
  });
  it("makes no spending call when the gate is off", async () => {
    const calls = counters();
    const { book } = seed("st-anchor-gate-off-test", terms());
    const fetchMock = vi.fn();
    const live = createPurchaseTransports({
      solanaRpcUrl: "https://rpc.example", dflowBaseUrl: "https://dflow.example", dflowApiKey: null, dflowSlippageBps: 50,
    } as never, () => "off", fetchMock);
    await expect(live.sendSwap(new Uint8Array(100))).rejects.toBeInstanceOf(FinancialExecutionDisabled);
    await expect(live.submitPayment({ url: bitcoinAnchorBuyUrl(), authorization: "{}", idempotencyKey: "st-anchor-gate-off-test" })).rejects.toBeInstanceOf(FinancialExecutionDisabled);
    await expect(runPurchaseAttempt({
      gate: "off", action: "submit_swap", attemptId: "st-anchor-gate-off-test", wallet: shopper.address, nowMs,
      journal: book, transports: transports(calls),
    })).rejects.toBeInstanceOf(FinancialExecutionDisabled);
    expect(calls.send).toBe(0);
    expect(calls.payment).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits one sync swap, reconciles a lost response, and keeps a second request from sending", async () => {
    const calls = counters();
    const id = "st-anchor-swap-once-test1";
    const { book, path } = seed(id, terms());
    let signature = "";
    const prepared = await runPurchaseAttempt({
      gate: "on", action: "prepare_swap", attemptId: id, wallet: shopper.address, nowMs, journal: book,
      transports: transports(calls),
    });
    expect(prepared.unsignedTransaction).toBeTruthy();
    expect(prepared.workflow?.state).toBe("swap_prepared");
    const unsigned = Buffer.from(prepared.unsignedTransaction ?? "", "base64");
    const signed = signSlot(unsigned, shopper, 0);
    signature = (await import("../src/lib/swap-adapter")).transactionSignature(signed, 0);
    const accepted = await runPurchaseAttempt({
      gate: "on", action: "accept_swap_signature", attemptId: id, wallet: shopper.address, nowMs, journal: book,
      signedTransaction: signed, transports: transports(calls),
    });
    expect(accepted.workflow?.state).toBe("swap_signed");
    expect(accepted.unsignedTransaction).toBeNull();
    let sent = 0;
    const sending = transports(calls, {
      sendSwap: async () => { sent += 1; calls.send += 1; if (sent === 1) throw new SwapSubmissionLost(); return signature; },
      signatureStatus: async () => { calls.status += 1; return null; },
    });
    const lost = await runPurchaseAttempt({
      gate: "on", action: "submit_swap", attemptId: id, wallet: shopper.address, nowMs, journal: book, transports: sending,
    });
    expect(lost.workflow?.state).toBe("swap_submitted_uncertain");
    expect(sent).toBe(1);
    const again = await runPurchaseAttempt({
      gate: "on", action: "submit_swap", attemptId: id, wallet: shopper.address, nowMs, journal: book, transports: sending,
    });
    expect(sent).toBe(1);
    expect(again.retrySwap).toBe(false);
    const restarted = new PurchaseJournal(path, Buffer.alloc(32, 7));
    expect(restarted.read()?.swapSubmission?.signature).toBe(signature);
    expect(restarted.read()?.workflow?.state).toBe("swap_submitted_uncertain");
  });

  it("confirms a sync swap from chain status and preserves USDC when the balance is short", async () => {
    const calls = counters();
    const id = "st-anchor-swap-short-test";
    const { book } = seed(id, terms());
    const prepared = await runPurchaseAttempt({
      gate: "on", action: "prepare_swap", attemptId: id, wallet: shopper.address, nowMs, journal: book, transports: transports(calls),
    });
    const signed = signSlot(Buffer.from(prepared.unsignedTransaction ?? "", "base64"), shopper, 0);
    await runPurchaseAttempt({
      gate: "on", action: "accept_swap_signature", attemptId: id, wallet: shopper.address, nowMs, journal: book,
      signedTransaction: signed, transports: transports(calls),
    });
    const signature = (await import("../src/lib/swap-adapter")).transactionSignature(signed, 0);
    const result = await runPurchaseAttempt({
      gate: "on", action: "submit_swap", attemptId: id, wallet: shopper.address, nowMs, journal: book,
      transports: transports(calls, {
        sendSwap: async () => { calls.send += 1; return signature; },
        usdcAtomic: async () => 4n,
      }),
    });
    expect(calls.send).toBe(1);
    expect(calls.payment).toBe(0);
    expect(result.workflow?.state).toBe("swap_confirmed");
    expect(result.workflow?.usdcPreserved).toBe(true);
    expect(result.error).toMatch(/stays in the wallet/);
  });

  it("rejects an async DFlow order before signing", async () => {
    const calls = counters();
    const id = "st-anchor-async-order-test";
    const { book } = seed(id, terms());
    const quote = transports(calls);
    const original = quote.quoteSwap;
    quote.quoteSwap = async (input) => ({ ...(await original(input)), executionMode: "async" });
    const prepared = await runPurchaseAttempt({
      gate: "on", action: "prepare_swap", attemptId: id, wallet: shopper.address, nowMs, journal: book, transports: quote,
    });
    expect(prepared.workflow?.state).toBe("approved_terms");
    expect(prepared.unsignedTransaction).toBeNull();
    expect(calls.send).toBe(0);
    expect(prepared.error).toMatch(/synchronous/);
    expect(book.read()?.signedSwap).toBeNull();
  });

  it("rejects an altered swap and a payment signed in the sponsor slot", async () => {
    const calls = counters();
    const id = "st-anchor-altered-swap01";
    const { book } = seed(id, terms());
    const prepared = await runPurchaseAttempt({
      gate: "on", action: "prepare_swap", attemptId: id, wallet: shopper.address, nowMs, journal: book, transports: transports(calls),
    });
    const signed = signSlot(Buffer.from(prepared.unsignedTransaction ?? "", "base64"), shopper, 0);
    signed[signed.length - 1] ^= 1;
    const rejected = await runPurchaseAttempt({
      gate: "on", action: "accept_swap_signature", attemptId: id, wallet: shopper.address, nowMs, journal: book, signedTransaction: signed, transports: transports(calls),
    });
    expect(rejected.workflow?.state).toBe("swap_prepared");
    expect(calls.send).toBe(0);
    const paymentBook = seed("st-anchor-bad-payment1", terms({
      conversionInputLamports: null, minimumOutputAtomic: null, slippageBps: null, prioritizationFeeLamports: "0", solCapLamports: "0",
    }));
    const payment = await runPurchaseAttempt({
      gate: "on", action: "prepare_payment", attemptId: "st-anchor-bad-payment1", wallet: shopper.address, nowMs,       journal: paymentBook.book, transports: transports(calls),
    });
    expect(payment.workflow?.state).toBe("payment_prepared");
    const wrongSlot = signSlot(Buffer.from(payment.unsignedTransaction ?? "", "base64"), shopper, 0);
    const refused = await runPurchaseAttempt({
      gate: "on", action: "accept_payment_signature", attemptId: "st-anchor-bad-payment1", wallet: shopper.address, nowMs, journal: paymentBook.book,
      signedTransaction: wrongSlot, transports: transports(calls),
    });
    expect(refused.workflow?.state).toBe("payment_prepared");
    expect(calls.payment).toBe(0);
  });

  it("submits one sponsored payment and leaves a pending Bitcoin proof pending", async () => {
    const calls = counters();
    const id = "st-anchor-payment-cert1";
    const { book } = seed(id, terms({
      conversionInputLamports: null, minimumOutputAtomic: null, slippageBps: null, prioritizationFeeLamports: "0", solCapLamports: "0",
    }));
    const prepared = await runPurchaseAttempt({
      gate: "on", action: "prepare_payment", attemptId: id, wallet: shopper.address, nowMs, journal: book, transports: transports(calls),
    });
    const signed = signSlot(Buffer.from(prepared.unsignedTransaction ?? "", "base64"), shopper, 1);
    await runPurchaseAttempt({
      gate: "on", action: "accept_payment_signature", attemptId: id, wallet: shopper.address, nowMs, journal: book, signedTransaction: signed, transports: transports(calls),
    });
    const payload = JSON.stringify({
      item: "bitcoin_anchor", attests: { digest }, paid_atomic: "1000000", asset: USDC_MINT,
      network: SOLANA_MAINNET_CAIP, payer: shopper.address, settlement_tx: "settlement-signature",
    });
    const signatureHex = Buffer.from(signBytes(signer, Buffer.from(payload, "utf8"))).toString("hex");
    const header = Buffer.from(JSON.stringify({ success: true, transaction: "settlement-signature", network: SOLANA_MAINNET_CAIP }), "utf8").toString("base64");
    let submissions = 0;
    const result = await runPurchaseAttempt({
      gate: "on", action: "submit_payment", attemptId: id, wallet: shopper.address, nowMs, journal: book,
      transports: transports(calls, {
        submitPayment: async (payment) => {
          submissions += 1;
          calls.payment += 1;
          expect(payment.url).toContain("/api/buy/bitcoin_anchor");
          expect(Buffer.from(payment.authorization, "utf8").toString("base64").length).toBeGreaterThan(16);
          const body = JSON.parse(payment.authorization) as { payload: { transaction: string } };
          expect(body.payload.transaction).toBe(Buffer.from(signed).toString("base64"));
          return {
            status: 200,
            bodyText: JSON.stringify({ certificate: { cert_id: "cert_fixtureanchor" }, verify_url: "https://scvd.store/api/verify/cert_fixtureanchor" }),
            paymentResponse: header,
          };
        },
        settlement: async () => ({
          meta: {
            err: null,
            preTokenBalances: [
              { mint: USDC_MINT, owner: shopper.address, uiTokenAmount: { amount: "2000000" } },
              { mint: USDC_MINT, owner: REVIEWED_MERCHANT_RECIPIENT, uiTokenAmount: { amount: "0" } },
            ],
            postTokenBalances: [
              { mint: USDC_MINT, owner: shopper.address, uiTokenAmount: { amount: "1000000" } },
              { mint: USDC_MINT, owner: REVIEWED_MERCHANT_RECIPIENT, uiTokenAmount: { amount: "1000000" } },
            ],
          },
        }),
        verifyCertificate: async () => ({
          algorithm: "ed25519",
          certificate: { cert_id: "cert_fixtureanchor" },
          signed_payload: payload,
          signature: signatureHex,
          public_key: Buffer.from(signer.publicKey).toString("hex"),
          existence: { status: "pending" },
        }),
      }),
    });
    expect(submissions).toBe(1);
    expect(calls.send).toBe(0);
    expect(result.workflow?.state).toBe("timestamp_proof_pending");
    expect(result.workflow?.bitcoinProof).toBe("pending");
    const replay = await runPurchaseAttempt({
      gate: "on", action: "submit_payment", attemptId: id, wallet: shopper.address, nowMs, journal: book, transports: transports(calls),
    });
    expect(submissions).toBe(1);
    expect(replay.retryPayment).toBe(false);
    const explicitReplay = await runPurchaseAttempt({
      gate: "on", action: "replay_payment", attemptId: id, wallet: shopper.address, nowMs, journal: book,
      transports: transports(calls, { submitPayment: async () => { submissions += 1; throw new Error("replay submitted a second payment"); } }),
    });
    expect(submissions).toBe(1);
    expect(explicitReplay.retryPayment).toBe(false);
  });

  it("keeps approved terms when a refreshed sponsor differs", async () => {
    const calls = counters();
    const id = "st-anchor-sponsor-keep1";
    const approved = terms({
      conversionInputLamports: null, minimumOutputAtomic: null, slippageBps: null, prioritizationFeeLamports: "0", solCapLamports: "0",
    });
    const { book } = seed(id, approved);
    const result = await runPurchaseAttempt({
      gate: "on", action: "prepare_payment", attemptId: id, wallet: shopper.address, nowMs, journal: book,
      transports: transports(calls, {
        freshTerms: async () => {
          const quoted = freshTerms();
          return { ...quoted, feePayer: shopper.address };
        },
      }),
    });
    expect(calls.payment).toBe(0);
    expect(result.unsignedTransaction).toBeNull();
    expect(result.workflow?.state).toBe("approved_terms");
    expect(result.workflow?.terms?.sponsor).toBe(REVIEWED_FEE_PAYER);
    expect(book.read()?.workflow?.terms?.sponsor).toBe(REVIEWED_FEE_PAYER);
    expect(() => book.refreshUnsignedReview(id, "rewritten-sponsor", "replacement-preview")).toThrow(/approved/);
    expect(book.read()?.reviewedTerms).not.toBe("rewritten-sponsor");
  });

  it("drops a changed conversion quote without signing or sending", async () => {
    const calls = counters();
    const id = "st-anchor-changed-quote1";
    const { book } = seed(id, terms());
    const result = await runPurchaseAttempt({
      gate: "on", action: "prepare_swap", attemptId: id, wallet: shopper.address, nowMs, journal: book,
      transports: transports(calls, {
        quoteSwap: async () => ({
          ...(await transports(calls).quoteSwap({ wallet: shopper.address, amount: inputLamports, slippageBps: 50 })),
          inAmount: (inputLamports + 1n).toString(),
        }),
      }),
    });
    expect(result.workflow?.state).toBe("approved_terms");
    expect(result.workflow?.terms?.conversionInputLamports).toBe(inputLamports.toString());
    expect(result.unsignedTransaction).toBeNull();
    expect(calls.send).toBe(0);
    expect(result.error).toMatch(/fresh review/);
  });

  it("does not rebuild or send an expired signed swap", async () => {
    const calls = counters();
    const id = "st-anchor-expired-swap1";
    const { book } = seed(id, terms());
    const prepared = await runPurchaseAttempt({
      gate: "on", action: "prepare_swap", attemptId: id, wallet: shopper.address, nowMs, journal: book, transports: transports(calls),
    });
    const signed = signSlot(Buffer.from(prepared.unsignedTransaction ?? "", "base64"), shopper, 0);
    await runPurchaseAttempt({
      gate: "on", action: "accept_swap_signature", attemptId: id, wallet: shopper.address, nowMs, journal: book, signedTransaction: signed, transports: transports(calls),
    });
    const expired = await runPurchaseAttempt({
      gate: "on", action: "submit_swap", attemptId: id, wallet: shopper.address, nowMs, journal: book,
      transports: transports(calls, { blockHeight: async () => 9_000, sendSwap: async () => { calls.send += 1; return "should-not-send"; } }),
    });
    expect(calls.send).toBe(0);
    expect(expired.workflow?.state).toBe("swap_signed");
    expect(expired.workflow?.lifetimeExpired).toBe(true);
    expect(expired.error).toMatch(/not replaced/);
  });

  it("lets only one of two overlapping swap submissions send", async () => {
    const calls = counters();
    const id = "st-anchor-concurrent-sw";
    const { book } = seed(id, terms());
    const prepared = await runPurchaseAttempt({
      gate: "on", action: "prepare_swap", attemptId: id, wallet: shopper.address, nowMs, journal: book, transports: transports(calls),
    });
    const signed = signSlot(Buffer.from(prepared.unsignedTransaction ?? "", "base64"), shopper, 0);
    await runPurchaseAttempt({
      gate: "on", action: "accept_swap_signature", attemptId: id, wallet: shopper.address, nowMs, journal: book, signedTransaction: signed, transports: transports(calls),
    });
    const signature = (await import("../src/lib/swap-adapter")).transactionSignature(signed, 0);
    let sent = 0;
    const sending = transports(calls, {
      sendSwap: async () => { sent += 1; calls.send += 1; await new Promise((resolve) => setTimeout(resolve, 20)); return signature; },
    });
    const [first, second] = await Promise.all([
      runPurchaseAttempt({ gate: "on", action: "submit_swap", attemptId: id, wallet: shopper.address, nowMs, journal: book, transports: sending }),
      runPurchaseAttempt({ gate: "on", action: "submit_swap", attemptId: id, wallet: shopper.address, nowMs, journal: book, transports: sending }),
    ]);
    expect(sent).toBe(1);
    expect([first.workflow?.state, second.workflow?.state]).toContain("funding_rechecked");
  });

  it("keeps a lost merchant response on the original payment", async () => {
    const calls = counters();
    const id = "st-anchor-payment-lost1";
    const { book, path } = seed(id, terms({
      conversionInputLamports: null, minimumOutputAtomic: null, slippageBps: null, prioritizationFeeLamports: "0", solCapLamports: "0",
    }));
    const prepared = await runPurchaseAttempt({
      gate: "on", action: "prepare_payment", attemptId: id, wallet: shopper.address, nowMs, journal: book, transports: transports(calls),
    });
    const signed = signSlot(Buffer.from(prepared.unsignedTransaction ?? "", "base64"), shopper, 1);
    await runPurchaseAttempt({
      gate: "on", action: "accept_payment_signature", attemptId: id, wallet: shopper.address, nowMs, journal: book, signedTransaction: signed, transports: transports(calls),
    });
    let submissions = 0;
    const lost = await runPurchaseAttempt({
      gate: "on", action: "submit_payment", attemptId: id, wallet: shopper.address, nowMs, journal: book,
      transports: transports(calls, { submitPayment: async () => { submissions += 1; calls.payment += 1; throw new SwapSubmissionLost(); } }),
    });
    expect(submissions).toBe(1);
    expect(lost.workflow?.state).toBe("merchant_submission_uncertain");
    expect(lost.error).toMatch(/Do not send another payment/);
    const again = await runPurchaseAttempt({
      gate: "on", action: "submit_payment", attemptId: id, wallet: shopper.address, nowMs, journal: book, transports: transports(calls),
    });
    expect(submissions).toBe(1);
    expect(again.retryPayment).toBe(false);
    const restarted = new PurchaseJournal(path, Buffer.alloc(32, 7));
    expect(restarted.read()?.state).toBe("outcome_unknown");
    expect(restarted.read()?.workflow?.state).toBe("merchant_submission_uncertain");
    const replayed = await runPurchaseAttempt({
      gate: "on", action: "replay_payment", attemptId: id, wallet: shopper.address, nowMs, journal: book,
      transports: transports(calls, {
        submitPayment: async (payment) => {
          submissions += 1;
          expect(payment.idempotencyKey).toBe(id);
          expect(payment.authorization).toContain(Buffer.from(signed).toString("base64"));
          throw new SwapSubmissionLost();
        },
      }),
    });
    expect(submissions).toBe(2);
    expect(replayed.workflow?.state).toBe("merchant_submission_uncertain");
    expect(replayed.retryPayment).toBe(false);
  });

  it("does not treat a different valid certificate as this purchase", async () => {
    const calls = counters();
    const id = "st-anchor-other-cert01";
    const { book } = seed(id, terms({
      conversionInputLamports: null, minimumOutputAtomic: null, slippageBps: null, prioritizationFeeLamports: "0", solCapLamports: "0",
    }));
    const prepared = await runPurchaseAttempt({
      gate: "on", action: "prepare_payment", attemptId: id, wallet: shopper.address, nowMs, journal: book, transports: transports(calls),
    });
    const signed = signSlot(Buffer.from(prepared.unsignedTransaction ?? "", "base64"), shopper, 1);
    await runPurchaseAttempt({
      gate: "on", action: "accept_payment_signature", attemptId: id, wallet: shopper.address, nowMs, journal: book, signedTransaction: signed, transports: transports(calls),
    });
    const payload = JSON.stringify({
      item: "signed_hello", attests: { digest: "0".repeat(64) }, paid_atomic: "0", asset: USDC_MINT,
      network: SOLANA_MAINNET_CAIP, payer: shopper.address, settlement_tx: "other-settlement",
    });
    const signatureHex = Buffer.from(signBytes(signer, Buffer.from(payload, "utf8"))).toString("hex");
    const result = await runPurchaseAttempt({
      gate: "on", action: "submit_payment", attemptId: id, wallet: shopper.address, nowMs, journal: book,
      transports: transports(calls, {
        submitPayment: async () => {
          calls.payment += 1;
          return {
            status: 200,
            bodyText: JSON.stringify({ certificate: { cert_id: "cert_otheritemfixture" } }),
            paymentResponse: Buffer.from(JSON.stringify({ success: true, transaction: "other-settlement", network: SOLANA_MAINNET_CAIP }), "utf8").toString("base64"),
          };
        },
        settlement: async () => ({
          meta: {
            err: null,
            preTokenBalances: [
              { mint: USDC_MINT, owner: shopper.address, uiTokenAmount: { amount: "2000000" } },
              { mint: USDC_MINT, owner: REVIEWED_MERCHANT_RECIPIENT, uiTokenAmount: { amount: "0" } },
            ],
            postTokenBalances: [
              { mint: USDC_MINT, owner: shopper.address, uiTokenAmount: { amount: "1000000" } },
              { mint: USDC_MINT, owner: REVIEWED_MERCHANT_RECIPIENT, uiTokenAmount: { amount: "1000000" } },
            ],
          },
        }),
        verifyCertificate: async () => ({
          algorithm: "ed25519",
          certificate: { cert_id: "cert_otheritemfixture" },
          signed_payload: payload,
          signature: signatureHex,
          public_key: Buffer.from(signer.publicKey).toString("hex"),
          existence: { status: "bounded", existed_by: { block_height: 900_000 }, key_window: "signed_while_current" },
        }),
      }),
    });
    expect(result.workflow?.state).not.toBe("bitcoin_anchor_verified");
    expect(result.workflow?.bitcoinProof).not.toBe("confirmed");
    expect(calls.payment).toBe(1);
  });
});
