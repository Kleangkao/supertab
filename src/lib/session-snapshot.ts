const MARK = "__bigint";

/** Shopping snapshots stay available for one day, then are treated as expired. */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface SessionStore {
  load(id: string): Promise<string | null>;
  save(id: string, body: string, expectedRevision?: number): Promise<void>;
  remove?(id: string): Promise<void>;
}

export class SessionStorageError extends Error {
  constructor() {
    super("Shopping session storage is temporarily unavailable.");
    this.name = "SessionStorageError";
  }
}

export class SessionConflictError extends Error {
  constructor() {
    super("This search was updated somewhere else. Refresh before trying again.");
    this.name = "SessionConflictError";
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super("This shopping session expired. Start a new search.");
    this.name = "SessionExpiredError";
  }
}

export function snapshotRevision(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { revision?: unknown };
    return typeof parsed.revision === "number" && Number.isInteger(parsed.revision) && parsed.revision >= 0 ? parsed.revision : 0;
  } catch {
    return 0;
  }
}

export function snapshotUpdatedAt(raw: string | null): number | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { updatedAtMs?: unknown; record?: { updatedAtMs?: unknown } };
    const value = parsed.updatedAtMs ?? parsed.record?.updatedAtMs;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function isSnapshotExpired(updatedAtMs: number | null, nowMs: number, ttlMs = SESSION_TTL_MS): boolean {
  // Missing retention metadata is treated as epoch 0 so pre-migration rows expire.
  const stamp = updatedAtMs ?? 0;
  return nowMs - stamp > ttlMs;
}

export function snapshotWriteAllowed(currentRaw: string | null, expectedRevision: number): boolean {
  return snapshotRevision(currentRaw) === expectedRevision;
}

export function encodeSnapshot(value: unknown): string {
  return JSON.stringify(value, (_key, item) => typeof item === "bigint" ? { [MARK]: item.toString() } : item);
}

export function decodeSnapshot(text: string): unknown {
  return JSON.parse(text, (_key, item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const record = item as Record<string, unknown>;
    const encoded = record[MARK];
    if (typeof encoded === "string" && /^-?\d+$/.test(encoded) && Object.keys(record).length === 1) return BigInt(encoded);
    return item;
  });
}

/** In-process CAS store for multi-instance tests. Not used in production. */
export function createMemorySessionStore(): SessionStore {
  const bodies = new Map<string, string>();
  return {
    async load(id) {
      return bodies.get(id) ?? null;
    },
    async save(id, body, expectedRevision) {
      if (typeof expectedRevision === "number") {
        const current = bodies.get(id) ?? null;
        if (!snapshotWriteAllowed(current, expectedRevision)) throw new SessionConflictError();
      }
      bodies.set(id, body);
    },
    async remove(id) {
      bodies.delete(id);
    },
  };
}

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isShoppingSessionId(id: string): boolean {
  return SESSION_ID.test(id);
}

type ShoppingSessionCapabilities = {
  cas: boolean;
  delete: boolean;
  alarmCleanup: boolean;
  requireRevisionOnUpdate: boolean;
};

/** Persists one shopping session on the hosted merchant. Local runs keep the in-memory session. */
export function createRemoteSessionStore(env: Record<string, string | undefined> = process.env): SessionStore | null {
  const base = env.DEVNET_MERCHANT_URL?.trim();
  const token = env.SUPERTAB_CONTROL_TOKEN?.trim();
  if (!base || !token) return null;
  let capabilities: ShoppingSessionCapabilities | null | undefined;
  async function requireCompatibleWorker(): Promise<void> {
    if (capabilities !== undefined) {
      if (!capabilities?.cas || !capabilities.requireRevisionOnUpdate) throw new SessionStorageError();
      return;
    }
    try {
      const response = await fetch(new URL("/health", base), {
        cache: "no-store",
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) {
        capabilities = null;
        throw new SessionStorageError();
      }
      const json = await response.json() as {
        shoppingSessions?: Partial<ShoppingSessionCapabilities> | null;
      };
      const shopping = json.shoppingSessions;
      capabilities = shopping && shopping.cas === true && shopping.requireRevisionOnUpdate === true
        ? {
          cas: true,
          delete: shopping.delete === true,
          alarmCleanup: shopping.alarmCleanup === true,
          requireRevisionOnUpdate: true,
        }
        : null;
    } catch (error) {
      capabilities = null;
      if (error instanceof SessionStorageError) throw error;
      throw new SessionStorageError();
    }
    if (!capabilities) throw new SessionStorageError();
  }
  return {
    async load(id) {
      if (!SESSION_ID.test(id)) return null;
      await requireCompatibleWorker();
      try {
        const response = await fetch(new URL(`/sessions/${id}`, base), {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(4_000),
        });
        if (response.status === 404 || response.status === 410) return null;
        if (!response.ok) throw new SessionStorageError();
        return response.text();
      } catch (error) {
        if (error instanceof SessionStorageError) throw error;
        throw new SessionStorageError();
      }
    },
    async save(id, body, expectedRevision) {
      if (!SESSION_ID.test(id)) return;
      await requireCompatibleWorker();
      if (typeof expectedRevision !== "number") throw new SessionConflictError();
      const headers: Record<string, string> = {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-supertab-revision": String(expectedRevision),
      };
      try {
        const response = await fetch(new URL(`/sessions/${id}`, base), {
          method: "PUT",
          headers,
          body,
          signal: AbortSignal.timeout(4_000),
        });
        if (response.status === 409) throw new SessionConflictError();
        if (!response.ok) throw new SessionStorageError();
      } catch (error) {
        if (error instanceof SessionStorageError || error instanceof SessionConflictError) throw error;
        throw new SessionStorageError();
      }
    },
    async remove(id) {
      if (!SESSION_ID.test(id)) return;
      await requireCompatibleWorker();
      try {
        const response = await fetch(new URL(`/sessions/${id}`, base), {
          method: "DELETE",
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(4_000),
        });
        if (response.status === 404) return;
        if (!response.ok) throw new SessionStorageError();
      } catch (error) {
        if (error instanceof SessionStorageError) throw error;
        throw new SessionStorageError();
      }
    },
  };
}
