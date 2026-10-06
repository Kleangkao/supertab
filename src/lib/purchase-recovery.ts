import { certificateCorrelates, type SignedCertificateFields } from "./digital-purchase";

/** Official contract, read 2026-10-05 from https://scvd.store/agents.md and https://scvd.store/api/claims. Not a live purchase. */
export const RECOVERY_CONTRACT = {
  idempotencyHeader: "Idempotency-Key",
  idempotencyLength: "16-128 characters",
  scope: "Same key, same item, and same paying wallet.",
  window: "A caller-supplied key returns the original result for 24 hours and is documented as no second charge.",
  suggestedKey: "The 402 suggested_key lasts about 60 seconds, plus the previous minute. It is not a secret and does not by itself open a purchase.",
  retryRequires: "The buy flow says to sign one accept and retry with the payment. The key selects a slot for the verified paying wallet and does not open one. A key alone is not documented as a free lookup.",
  quoteExpiry: "A payment quote expiring is not documented as extending or replacing the 24-hour key. An expired quote does not authorize a new payment.",
  claims: "GET https://scvd.store/api/claims says a Solana wallet can list its purchases without a certificate id after signing a single-use challenge. POST /api/claims/challenge with { address }, then signMessage over that exact UTF-8 string, then POST { address, signature } within 300 seconds.",
  claimsNotCalled: "This build does not request the challenge or the signature.",
} as const;

export const CLAIM_REVIEW = {
  enabled: false as const,
  purpose: "List certificates for this wallet if a purchase response is lost.",
  distinguishes: "This would be signMessage on the store's challenge string. It is not a transaction signature and it does not pay.",
  message: "The exact bytes are the single-use challenge from POST /api/claims/challenge. SuperTab has not requested that challenge.",
} as const;

export type AttemptState =
  | "prepared_not_submitted"
  | "submitted_outcome_unknown"
  | "payment_confirmed_certificate_missing"
  | "certificate_verified"
  | "timestamp_proof_pending"
  | "bitcoin_anchoring_verified"
  | "recovery_unavailable";

export interface PurchaseAttempt {
  version: 1;
  id: string;
  state: AttemptState;
  walletSource: "connected" | "read_only";
  walletAddress: string;
  network: "solana:mainnet";
  digest: string;
  idempotencyKey: string;
  amountAtomic: string;
  payTo: string;
  feePayer: string;
  merchantExpiresAt: string;
  certId: string | null;
  settlementTx: string | null;
  quoteExpired: boolean;
  mismatch: string | null;
  paymentAuthorization: "not_stored";
  appliedEventIds: string[];
  updatedAt: string;
}

const STORAGE_KEY = "supertab.bitcoin-anchor-attempt.v1";

export function storageKey(): string {
  return STORAGE_KEY;
}

export function createPreparedAttempt(input: {
  id: string;
  walletSource: "connected" | "read_only";
  walletAddress: string;
  digest: string;
  idempotencyKey: string;
  amountAtomic: string;
  payTo: string;
  feePayer: string;
  merchantExpiresAt: string;
  nowIso: string;
}): PurchaseAttempt {
  return {
    version: 1,
    id: input.id,
    state: "prepared_not_submitted",
    walletSource: input.walletSource,
    walletAddress: input.walletAddress,
    network: "solana:mainnet",
    digest: input.digest,
    idempotencyKey: input.idempotencyKey,
    amountAtomic: input.amountAtomic,
    payTo: input.payTo,
    feePayer: input.feePayer,
    merchantExpiresAt: input.merchantExpiresAt,
    certId: null,
    settlementTx: null,
    quoteExpired: false,
    mismatch: null,
    paymentAuthorization: "not_stored",
    appliedEventIds: [],
    updatedAt: input.nowIso,
  };
}

export type RecoveryEvent =
  | { id: string; type: "response_lost"; nowIso: string }
  | { id: string; type: "payment_confirmed_certificate_missing"; nowIso: string }
  | { id: string; type: "quote_expired"; nowIso: string }
  | { id: string; type: "terms_changed"; nowIso: string; digest: string; walletAddress: string; amountAtomic: string; payTo: string; feePayer: string }
  | { id: string; type: "certificate"; nowIso: string; certId: string; signed: SignedCertificateFields; proof: "pending" | "bitcoin_confirmed" | "absent"; settlementTx: string | null; mint: string; network: string };

export function applyRecoveryEvent(attempt: PurchaseAttempt, event: RecoveryEvent): {
  attempt: PurchaseAttempt;
  retrySwap: false;
  retryPayment: false;
  replayed: boolean;
} {
  const stopped = { retrySwap: false as const, retryPayment: false as const };
  if (attempt.appliedEventIds.includes(event.id)) {
    return { attempt, ...stopped, replayed: true };
  }
  const next: PurchaseAttempt = {
    ...attempt,
    appliedEventIds: [...attempt.appliedEventIds, event.id],
    updatedAt: event.nowIso,
  };
  if (event.type === "response_lost") {
    if (!attempt.certId && attempt.state !== "payment_confirmed_certificate_missing") {
      next.state = "submitted_outcome_unknown";
    }
    return { attempt: next, ...stopped, replayed: false };
  }
  if (event.type === "payment_confirmed_certificate_missing") {
    if (attempt.state !== "bitcoin_anchoring_verified" && attempt.state !== "certificate_verified" && attempt.state !== "timestamp_proof_pending") {
      next.state = "payment_confirmed_certificate_missing";
    }
    return { attempt: next, ...stopped, replayed: false };
  }
  if (event.type === "quote_expired") {
    next.quoteExpired = true;
    if (attempt.state === "prepared_not_submitted") next.state = "prepared_not_submitted";
    return { attempt: next, ...stopped, replayed: false };
  }
  if (event.type === "terms_changed") {
    const same = event.digest === attempt.digest
      && event.walletAddress === attempt.walletAddress
      && event.amountAtomic === attempt.amountAtomic
      && event.payTo === attempt.payTo
      && event.feePayer === attempt.feePayer;
    if (!same) next.mismatch = "The payload, wallet, amount, recipient, or sponsor does not match the stored attempt.";
    return { attempt: next, ...stopped, replayed: false };
  }
  const correlated = certificateCorrelates(event.signed, {
    digest: attempt.digest,
    payer: attempt.walletAddress,
    amountAtomic: attempt.amountAtomic,
    mint: event.mint,
    network: event.network,
    settlementTx: event.settlementTx,
  });
  if (!correlated.correlates) {
    next.state = "recovery_unavailable";
    next.mismatch = correlated.gaps.join(" ");
    return { attempt: next, ...stopped, replayed: false };
  }
  next.certId = event.certId;
  next.settlementTx = event.settlementTx;
  next.mismatch = null;
  next.state = event.proof === "bitcoin_confirmed"
    ? "bitcoin_anchoring_verified"
    : event.proof === "pending"
      ? "timestamp_proof_pending"
      : "certificate_verified";
  return { attempt: next, ...stopped, replayed: false };
}

/** A new quote must not replace an unresolved submitted attempt or become a second payment. */
export function rememberPreparedQuote(existing: PurchaseAttempt | null, prepared: PurchaseAttempt, serverRefreshedUnsignedReview = false): {
  attempt: PurchaseAttempt;
  keptExisting: boolean;
  reason: string | null;
} {
  if (!existing) return { attempt: prepared, keptExisting: false, reason: null };
  const unresolved = existing.state === "submitted_outcome_unknown"
    || existing.state === "payment_confirmed_certificate_missing"
    || existing.state === "timestamp_proof_pending"
    || existing.state === "recovery_unavailable";
  if (unresolved) {
    return {
      attempt: existing,
      keptExisting: true,
      reason: "An unresolved attempt is already stored. A new quote does not start another swap or payment.",
    };
  }
  if (existing.state === "prepared_not_submitted"
    && existing.walletAddress === prepared.walletAddress
    && existing.digest === prepared.digest) {
    const sameTerms = existing.amountAtomic === prepared.amountAtomic
      && existing.payTo === prepared.payTo
      && existing.feePayer === prepared.feePayer;
    // The quote endpoint permits this only before approval or signing. Browser
    // recovery metadata is not spending authority; retain the same attempt key.
    if (serverRefreshedUnsignedReview && existing.id === prepared.id
      && existing.idempotencyKey === prepared.idempotencyKey
      && existing.amountAtomic === prepared.amountAtomic && existing.payTo === prepared.payTo
      && !existing.certId && !existing.settlementTx && !existing.mismatch) {
      return { attempt: prepared, keptExisting: false, reason: null };
    }
    if (!sameTerms) {
      return {
        attempt: existing,
        keptExisting: true,
        reason: "The new quote changes the amount, recipient, or sponsor. The stored attempt was not replaced and no payment was started.",
      };
    }
    return {
      attempt: { ...existing, merchantExpiresAt: prepared.merchantExpiresAt, updatedAt: prepared.updatedAt },
      keptExisting: true,
      reason: null,
    };
  }
  if (existing.walletAddress !== prepared.walletAddress) {
    return {
      attempt: existing,
      keptExisting: true,
      reason: "The stored attempt belongs to a different wallet and was not replaced.",
    };
  }
  return { attempt: prepared, keptExisting: false, reason: null };
}

export function resumeAttempt(stored: PurchaseAttempt | null, walletAddress: string): {
  current: PurchaseAttempt | null;
  foreign: boolean;
} {
  if (!stored) return { current: null, foreign: false };
  if (stored.walletAddress !== walletAddress) return { current: null, foreign: true };
  if (stored.state === "bitcoin_anchoring_verified") return { current: stored, foreign: false };
  return { current: stored, foreign: false };
}

export interface AttemptStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function parseStoredAttempt(raw: string | null): PurchaseAttempt | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PurchaseAttempt;
    if (parsed?.version !== 1 || parsed.paymentAuthorization !== "not_stored") return null;
    if (typeof parsed.idempotencyKey !== "string" || parsed.idempotencyKey.length < 16) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readStoredAttempt(storage: AttemptStorage): PurchaseAttempt | null {
  return parseStoredAttempt(storage.getItem(STORAGE_KEY));
}

const attemptListeners = new Set<() => void>();
let attemptSnapshot: string | null = null;
let attemptSnapshotReady = false;

export function subscribeAttempts(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  attemptListeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    attemptListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function readAttemptSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (attemptSnapshotReady && raw === attemptSnapshot) return attemptSnapshot;
  attemptSnapshot = raw;
  attemptSnapshotReady = true;
  return attemptSnapshot;
}

export function readAttemptServerSnapshot(): null {
  return null;
}

export function writeStoredAttempt(storage: AttemptStorage, attempt: PurchaseAttempt): void {
  if (attempt.paymentAuthorization !== "not_stored") return;
  storage.setItem(STORAGE_KEY, JSON.stringify(attempt));
  attemptSnapshot = JSON.stringify(attempt);
  attemptSnapshotReady = true;
  for (const listener of attemptListeners) listener();
}

export function persistConnectedAttempt(attempt: PurchaseAttempt, storage: AttemptStorage): boolean {
  if (attempt.walletSource !== "connected") return false;
  writeStoredAttempt(storage, attempt);
  return true;
}
