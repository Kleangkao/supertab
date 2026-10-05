import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { PurchaseJournal } from "../src/lib/purchase-journal";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "supertab-journal-"));
  directories.push(directory);
  const path = join(directory, "attempt.enc");
  const key = Buffer.alloc(32, 7);
  const terms = { id: "attempt-test", wallet: "buyer", idempotencyKey: "one-stable-key-for-recovery", requestUrl: "https://scvd.store/api/buy/bitcoin_anchor?digest=test", requestBody: "", reviewedTerms: "fixture-original-terms", createdAt: "2026-10-06T00:00:00Z" };
  return { path, key, terms, journal: new PurchaseJournal(path, key) };
}
it("persists original request before submission and keeps authorization encrypted through restart", () => {
  const { path, key, terms, journal } = fixture();
  journal.prepare(terms);
  expect(journal.read()?.state).toBe("prepared");
  journal.refreshUnsignedReview(terms.id, "fresh-terms", "unsigned-fixture");
  expect(journal.read()?.unsignedPayment).toBe("unsigned-fixture");
  journal.retainAuthorization(terms.id, "fixture-payment-authorization");
  expect(() => journal.refreshUnsignedReview(terms.id, "new-terms", "replacement")).toThrow(/refresh/);
  journal.markSubmitted(terms.id);
  const reopened = new PurchaseJournal(path, key);
  expect(reopened.read()?.state).toBe("outcome_unknown");
  expect(reopened.read()?.paymentAuthorization).toBe("fixture-payment-authorization");
  expect(readFileSync(path, "utf8")).not.toContain("fixture-payment-authorization");
  expect(() => reopened.prepare({ ...terms, id: "another-attempt" })).toThrow(/already/);
  expect(() => reopened.retainAuthorization(terms.id, "replacement")).toThrow(/replace/);
});
it("fails closed before submission without retained authorization or with a wrong key", () => {
  const { path, terms, journal } = fixture();
  journal.prepare(terms);
  expect(() => journal.markSubmitted(terms.id)).toThrow(/authorization/);
  expect(() => new PurchaseJournal(path, Buffer.alloc(32, 8)).read()).toThrow();
  expect(() => new PurchaseJournal(path, Buffer.alloc(16))).toThrow(/32/);
});
it("does not replace terms, and corruption never becomes a new attempt", () => {
  const { path, terms, journal } = fixture();
  journal.prepare(terms);
  expect(() => journal.prepare({ ...terms, wallet: "other" })).toThrow(/already/);
  expect(() => journal.markSubmitted("other")).toThrow(/match/);
  expect(journal.read()?.state).toBe("prepared");
  writeFileSync(path, "corrupt");
  expect(() => journal.read()).toThrow();
  expect(() => journal.prepare(terms)).toThrow();
});
