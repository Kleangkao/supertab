/** Server-only recovery custody. No wallet, network, signing, or send methods. */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface OriginalPurchaseRequest {
  id: string;
  wallet: string;
  idempotencyKey: string;
  requestUrl: string;
  requestBody: string;
  reviewedTerms: string;
  createdAt: string;
}
interface JournalRecord extends OriginalPurchaseRequest {
  version: 1;
  state: "prepared" | "authorization_retained" | "outcome_unknown";
  paymentAuthorization: string | null;
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
    return record;
  }
  prepare(request: OriginalPurchaseRequest): void {
    this.update(() => {
      if (this.read()) throw new Error("An attempt already exists. Do not replace its original request.");
      if (!request.id || !request.wallet || request.idempotencyKey.length < 16 || request.idempotencyKey.length > 128) throw new Error("Invalid attempt identifiers.");
      const url = new URL(request.requestUrl);
      if (url.origin !== "https://scvd.store" || url.pathname !== "/api/buy/bitcoin_anchor") throw new Error("Unexpected purchase resource.");
      return { ...request, version: 1, state: "prepared", paymentAuthorization: null };
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
