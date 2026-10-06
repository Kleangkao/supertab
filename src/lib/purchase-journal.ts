/** Server-only recovery custody. No wallet, network, signing, or send methods. */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isUnresolvedWorkflow, type WorkflowStage } from "./purchase-status";
import { parseWorkflow, type PurchaseWorkflow } from "./purchase-workflow";

export interface OriginalPurchaseRequest {
  id: string;
  wallet: string;
  idempotencyKey: string;
  requestUrl: string;
  requestBody: string;
  reviewedTerms: string;
  unsignedPayment?: string;
  createdAt: string;
}
export interface SwapContext {
  executionMode: "sync" | "async";
  inAmount: string;
  outAmount: string;
  minOutAmount: string;
  slippageBps: number;
  prioritizationFeeLamports: string;
  inputMint: string;
  outputMint: string;
  lookupTables: { address: string; addresses: Record<string, string> }[];
  lastValidBlockHeight: number;
  blockhash: string;
  unsignedTransaction?: string;
}

export interface StoredMerchantResponse {
  body: string;
  certId: string | null;
  settlementTx: string | null;
  statusUrl: string | null;
  statusToken: string | null;
}

interface JournalRecord extends OriginalPurchaseRequest {
  version: 1;
  state: "prepared" | "authorization_retained" | "outcome_unknown";
  paymentAuthorization: string | null;
  workflow: PurchaseWorkflow | null;
  swapContext: SwapContext | null;
  signedSwap: { transaction: string; signature: string } | null;
  swapSubmission: { signature: string; executionMode: "sync" | "async"; transaction: string } | null;
  signedPayment: string | null;
  merchantResponse: StoredMerchantResponse | null;
}

/** One immutable attempt per file. Caller must use a private, ignored data directory.
 * Key must be held separately in server secrets. This is custody, not permission to replay.
 * Synchronous exclusive file lock prevents concurrent processes replacing an attempt.
 */
export class PurchaseJournal {
  private readonly key: Buffer;
  constructor(private readonly path: string, key: Uint8Array) {
    if (key.byteLength !== 32) throw new Error("Recovery encryption requires a 32-byte key.");
    this.key = Buffer.from(key);
  }
  read(): JournalRecord | null {
    if (!existsSync(this.path)) return null;
    const envelope = JSON.parse(readFileSync(this.path, "utf8"));
    if (envelope.version !== 1) throw new Error("Unsupported recovery journal.");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(envelope.iv, "base64"));
    decipher.setAAD(Buffer.from("supertab-purchase-journal-v1"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
    const record = JSON.parse(plaintext.toString("utf8")) as JournalRecord;
    if (record.version !== 1 || !record.id || !record.wallet || !["prepared", "authorization_retained", "outcome_unknown"].includes(record.state)) {
      throw new Error("Invalid recovery record. Do not start another payment.");
    }
    if (record.workflow != null && !parseWorkflow(record.workflow)) {
      throw new Error("Invalid recovery record. Do not start another payment.");
    }
    return {
      ...record,
      workflow: record.workflow ?? null,
      swapContext: record.swapContext ?? null,
      signedSwap: record.signedSwap ?? null,
      swapSubmission: record.swapSubmission ?? null,
      signedPayment: record.signedPayment ?? null,
      merchantResponse: record.merchantResponse ?? null,
    };
  }
  prepare(request: OriginalPurchaseRequest): void {
    this.update(() => {
      if (this.read()) throw new Error("An attempt already exists. Do not replace its original request.");
      if (!request.id || !request.wallet || request.idempotencyKey.length < 16 || request.idempotencyKey.length > 128) throw new Error("Invalid attempt identifiers.");
      const url = new URL(request.requestUrl);
      if (url.origin !== "https://scvd.store" || url.pathname !== "/api/buy/bitcoin_anchor") throw new Error("Unexpected purchase resource.");
      return {
        ...request, version: 1, state: "prepared", paymentAuthorization: null, workflow: null,
        swapContext: null, signedSwap: null, swapSubmission: null, signedPayment: null, merchantResponse: null,
      };
    });
  }
  saveSwapContext(id: string, context: SwapContext): void {
    this.update(() => {
      const record = this.match(id);
      if (record.swapSubmission || record.signedSwap) throw new Error("A signed swap was not replaced.");
      if (record.workflow && record.workflow.state !== "approved_terms" && record.workflow.state !== "swap_prepared") {
        throw new Error("A fresh swap applies only before it is signed.");
      }
      return { ...record, swapContext: context };
    });
  }
  retainSignedSwap(id: string, signed: { transaction: string; signature: string }, workflow: PurchaseWorkflow): void {
    const parsed = parseWorkflow(workflow);
    if (!parsed || parsed.state !== "swap_signed" || parsed.id !== id) throw new Error("The signed swap does not match this attempt.");
    this.update(() => {
      const record = this.match(id);
      if (record.swapSubmission) throw new Error("This attempt already submitted a swap.");
      if (record.signedSwap && record.signedSwap.signature !== signed.signature) throw new Error("This attempt already has a different signed swap.");
      if (parsed.terms && parsed.terms.wallet !== record.wallet) throw new Error("Workflow wallet does not match the stored attempt.");
      return { ...record, signedSwap: signed, workflow: parsed };
    });
  }
  claimSwapSubmission(id: string, workflow: PurchaseWorkflow): { duplicate: boolean; transaction: string; signature: string; executionMode: "sync" | "async" } {
    const parsed = parseWorkflow(workflow);
    if (!parsed || parsed.id !== id || parsed.state !== "swap_submitted_uncertain") throw new Error("Persist the uncertain swap before submission.");
    let outcome: { duplicate: boolean; transaction: string; signature: string; executionMode: "sync" | "async" } | null = null;
    this.update(() => {
      const record = this.match(id);
      if (!record.signedSwap || !record.swapContext) throw new Error("The signed swap is not in custody.");
      if (record.swapSubmission) {
        if (record.swapSubmission.signature !== record.signedSwap.signature) throw new Error("This attempt already has a different swap.");
        outcome = { duplicate: true, transaction: record.swapSubmission.transaction, signature: record.swapSubmission.signature, executionMode: record.swapSubmission.executionMode };
        return record;
      }
      if (record.workflow?.state !== "swap_signed") throw new Error("A swap can be submitted only after its signature is checked.");
      outcome = { duplicate: false, transaction: record.signedSwap.transaction, signature: record.signedSwap.signature, executionMode: record.swapContext.executionMode };
      return {
        ...record,
        workflow: parsed,
        swapSubmission: { signature: record.signedSwap.signature, executionMode: record.swapContext.executionMode, transaction: record.signedSwap.transaction },
      };
    });
    if (!outcome) throw new Error("The swap claim was not recorded.");
    return outcome;
  }
  retainSignedPayment(id: string, authorization: string, signedTransaction: string, workflow: PurchaseWorkflow): void {
    const parsed = parseWorkflow(workflow);
    if (!parsed || parsed.id !== id || parsed.state !== "payment_signed" || parsed.paymentAuthorization !== "retained") {
      throw new Error("Authorization is retained only for the signed payment.");
    }
    this.update(() => {
      const record = this.match(id);
      if (record.state === "outcome_unknown" || record.merchantResponse) throw new Error("Cannot replace the original payment authorization.");
      if (record.paymentAuthorization && record.paymentAuthorization !== authorization) throw new Error("Cannot replace the original payment authorization.");
      if (!authorization || authorization.length > 100_000 || !signedTransaction) throw new Error("Invalid payment authorization.");
      if (parsed.terms && parsed.terms.wallet !== record.wallet) throw new Error("Workflow wallet does not match the stored attempt.");
      return { ...record, state: "authorization_retained", paymentAuthorization: authorization, signedPayment: signedTransaction, workflow: parsed };
    });
  }
  claimMerchantSubmission(id: string, workflow: PurchaseWorkflow): { duplicate: boolean; authorization: string } {
    const parsed = parseWorkflow(workflow);
    if (!parsed || parsed.id !== id || parsed.state !== "merchant_submission_uncertain") throw new Error("Persist the original payment before merchant submission.");
    let outcome: { duplicate: boolean; authorization: string } | null = null;
    this.update(() => {
      const record = this.match(id);
      if (!record.paymentAuthorization) throw new Error("Persist original authorization before submission.");
      if (record.state === "outcome_unknown") {
        outcome = { duplicate: true, authorization: record.paymentAuthorization };
        return record;
      }
      if (record.state !== "authorization_retained" || record.workflow?.state !== "payment_signed") {
        throw new Error("Persist original authorization before submission.");
      }
      outcome = { duplicate: false, authorization: record.paymentAuthorization };
      return { ...record, state: "outcome_unknown", workflow: parsed };
    });
    if (!outcome) throw new Error("The payment claim was not recorded.");
    return outcome;
  }
  retainMerchantResponse(id: string, response: StoredMerchantResponse): void {
    this.update(() => {
      const record = this.match(id);
      if (record.state !== "outcome_unknown" && record.workflow?.state !== "merchant_submission_uncertain" && record.workflow?.state !== "payment_confirmed_certificate_missing" && record.workflow?.state !== "certificate_verification_unavailable") {
        throw new Error("A merchant response belongs to the submitted attempt.");
      }
      if (record.merchantResponse && record.merchantResponse.body !== response.body) throw new Error("The original merchant response was not replaced.");
      return { ...record, merchantResponse: record.merchantResponse ?? response };
    });
  }
  retainAuthorization(id: string, authorization: string): void {
    this.update(() => {
      const record = this.match(id);
      if (record.state !== "prepared" || record.paymentAuthorization !== null) throw new Error("Cannot replace the original payment authorization.");
      if (!authorization || authorization.length > 100_000) throw new Error("Invalid payment authorization.");
      return { ...record, state: "authorization_retained", paymentAuthorization: authorization };
    });
  }
  retainCheckedSwap(id: string, context: SwapContext & { unsignedTransaction: string }): void {
    if (!context.unsignedTransaction || context.executionMode !== "sync") throw new Error("Only a synchronous unsigned order can be retained.");
    this.update(() => {
      const record = this.match(id);
      if (record.signedSwap || record.swapSubmission || record.signedPayment) throw new Error("A signed or submitted conversion was not refreshed.");
      if (record.workflow && record.workflow.state !== "review" && record.workflow.state !== "approved_terms" && record.workflow.state !== "swap_prepared") {
        throw new Error("A signed or submitted conversion was not refreshed.");
      }
      return { ...record, swapContext: context };
    });
  }
  refreshUnsignedReview(id: string, reviewedTerms: string, unsignedPayment: string): void {
    this.update(() => {
      const record = this.match(id);
      if (record.workflow && record.workflow.state !== "review") throw new Error("Cannot refresh an approved attempt.");
      if (record.signedSwap || record.swapSubmission) throw new Error("Cannot refresh an approved attempt.");
      if (record.state !== "prepared" || record.paymentAuthorization) throw new Error("Cannot refresh a submitted or authorized attempt.");
      return { ...record, reviewedTerms, unsignedPayment };
    });
  }
  saveWorkflow(id: string, workflow: PurchaseWorkflow): void {
    const parsed = parseWorkflow(workflow);
    if (!parsed || parsed.id !== id) throw new Error("Workflow does not match this attempt.");
    const serialized = JSON.stringify(parsed);
    if (/"authorization"\s*:/.test(serialized) || serialized.includes("transactionBase64")) {
      throw new Error("Workflow records cannot store payment authorization.");
    }
    this.update(() => {
      const record = this.match(id);
      if (parsed.terms && parsed.terms.wallet !== record.wallet) throw new Error("Workflow wallet does not match the stored attempt.");
      const existing = record.workflow;
      if (existing && isUnresolvedWorkflow(existing.state as WorkflowStage) && parsed.state === "review") {
        throw new Error("An unresolved attempt cannot become a new purchase.");
      }
      return { ...record, workflow: parsed };
    });
  }
  markSubmitted(id: string): void {
    this.update(() => {
      const record = this.match(id);
      if (!record.paymentAuthorization) throw new Error("Persist original authorization before submission.");
      return { ...record, state: "outcome_unknown" };
    });
  }
  private match(id: string): JournalRecord {
    const record = this.read();
    if (!record || record.id !== id) throw new Error("Attempt does not match.");
    return record;
  }
  private update(change: () => JournalRecord): void {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const lock = `${this.path}.lock`;
    // A leftover lock after a crash fails closed; it is never automatically stolen.
    writeFileSync(lock, "locked", { flag: "wx", mode: 0o600 });
    try {
      const record = change();
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", this.key, iv);
      cipher.setAAD(Buffer.from("supertab-purchase-journal-v1"));
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(record), "utf8"), cipher.final()]);
      const temporary = `${this.path}.${randomBytes(8).toString("hex")}.tmp`;
      writeFileSync(temporary, JSON.stringify({ version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") }), { flag: "wx", mode: 0o600 });
      renameSync(temporary, this.path);
    } finally {
      // Only this process's acquired lock is removed.
      unlinkLock(lock);
    }
  }
}

function unlinkLock(path: string) { unlinkSync(path); }

/** Local desktop custody only; not suitable for an ephemeral deployment filesystem. */
export function localPurchaseJournal(id: string): PurchaseJournal {
  const secrets = join(process.cwd(), "merchant", "secrets");
  mkdirSync(secrets, { recursive: true, mode: 0o700 });
  const keyPath = join(secrets, "purchase-recovery.key");
  try { writeFileSync(keyPath, randomBytes(32), { flag: "wx", mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  const filename = createHash("sha256").update(id).digest("hex");
  return new PurchaseJournal(join(process.cwd(), "data", "purchase-recovery", `${filename}.enc`), readFileSync(keyPath));
}
