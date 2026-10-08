import { timingSafeEqual } from "node:crypto";
import { DurableObject } from "cloudflare:workers";
import { associatedTokenAddress } from "./ata";
import { dispatchMerchant } from "./dispatch";
import { keyFromStored } from "./keys";
import { normalizeChainTransaction } from "./normalize";
import { CIRCLE_SOLANA_DEVNET_USDC_MINT } from "./product";
import { confirmedTransaction, ensureDevnetEndpoint, recentBlockhash, sendSigned } from "./rpc";
import { DevnetMerchant } from "./service";
import { importMerchantSnapshot, MerchantStore } from "./store";

interface Env {
  MERCHANT: DurableObjectNamespace<DevnetMerchantObject>;
  SESSIONS: DurableObjectNamespace<ShoppingSessionObject>;
  GEMINI_BUDGET: DurableObjectNamespace<GeminiBudgetObject>;
  SUPERTAB_CONTROL_TOKEN?: string;
  MERCHANT_KEY_JSON?: string;
  MERCHANT_SNAPSHOT?: string;
  SOLANA_DEVNET_RPC_URL?: string;
  GEMINI_DAILY_LIMIT?: string;
}

const POST_LIMIT = 40;
const POST_WINDOW_MS = 60 * 60 * 1000;
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class DevnetMerchantObject extends DurableObject<Env> {
  private merchant: DevnetMerchant | null = null;
  private devnetReady: Promise<void> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS merchant_snapshot (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        body TEXT NOT NULL
      )`);
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS request_rate (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL
      )`);
      this.merchant = this.openMerchant();
    });
  }

  async stats(): Promise<{ orders: number; checkouts: number; payments: number }> {
    return this.requireMerchant().recordCounts();
  }

  async importIfEmpty(raw: string): Promise<{ imported: boolean; orders: number }> {
    this.applyRpc();
    await this.ensureDevnet();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new Error("Snapshot was refused.");
    }
    const merchant = this.requireMerchant();
    const imported = merchant.importSnapshotIfEmpty(parsed);
    return { imported, orders: merchant.recordCounts().orders };
  }

  async handle(method: string, pathname: string, rawBody: string | null): Promise<{ status: number; json: string }> {
    try {
      this.applyRpc();
      await this.ensureDevnet();
      if (method === "POST" && !this.takePostSlot(Date.now())) {
        return jsonResult(429, { error: "Devnet checkout is temporarily limited. No payment was sent." });
      }
      const body = rawBody == null || rawBody.length === 0 ? null : JSON.parse(rawBody) as unknown;
      const result = await dispatchMerchant(this.requireMerchant(), method, pathname, body);
      return { status: result.status, json: JSON.stringify(result.body) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";
      const status = /not Solana devnet|returned Solana mainnet|returned Solana testnet|key is missing|could not be opened/i.test(message) ? 503 : 400;
      return jsonResult(status, { error: status === 503 ? "The devnet merchant is unavailable." : message });
    }
  }

  private openMerchant(): DevnetMerchant {
    const store = new MerchantStore();
    const existing = this.ctx.storage.sql.exec<{ body: string }>("SELECT body FROM merchant_snapshot WHERE id = 1").toArray();
    try {
      if (existing[0]?.body) importMerchantSnapshot(store, JSON.parse(existing[0].body) as unknown);
      else if (this.env.MERCHANT_SNAPSHOT?.trim()) importMerchantSnapshot(store, JSON.parse(this.env.MERCHANT_SNAPSHOT) as unknown);
    } catch {
      throw new Error("Devnet merchant store could not be opened.");
    }
    store.attachWriter((snapshot) => {
      this.ctx.storage.sql.exec(
        "INSERT INTO merchant_snapshot (id, body) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body",
        JSON.stringify(snapshot),
      );
    });
    if (!existing[0]?.body && store.orders.size > 0) {
      this.ctx.storage.sql.exec("INSERT INTO merchant_snapshot (id, body) VALUES (1, ?)", JSON.stringify(store.exportSnapshot()));
    }
    const key = merchantKey(this.env.MERCHANT_KEY_JSON);
    return new DevnetMerchant(
      store,
      key.address,
      associatedTokenAddress(key.address, CIRCLE_SOLANA_DEVNET_USDC_MINT),
      async (signature) => normalizeChainTransaction(await confirmedTransaction(signature)),
      recentBlockhash,
      { merchant: key, send: sendSigned },
    );
  }

  private requireMerchant(): DevnetMerchant {
    if (!this.merchant) this.merchant = this.openMerchant();
    return this.merchant;
  }

  private applyRpc(): void {
    const rpc = this.env.SOLANA_DEVNET_RPC_URL?.trim();
    if (rpc) process.env.SOLANA_DEVNET_RPC_URL = rpc;
  }

  private async ensureDevnet(): Promise<void> {
    if (!this.devnetReady) {
      this.devnetReady = ensureDevnetEndpoint().catch((error: unknown) => {
        this.devnetReady = null;
        throw error;
      });
    }
    await this.devnetReady;
  }

  private takePostSlot(now: number): boolean {
    const rows = this.ctx.storage.sql.exec<{ window_start: number; count: number }>(
      "SELECT window_start, count FROM request_rate WHERE id = 1",
    ).toArray();
    const current = rows[0] && now - Number(rows[0].window_start) < POST_WINDOW_MS ? rows[0] : null;
    const windowStart = current ? Number(current.window_start) : now;
    const count = current ? Number(current.count) : 0;
    if (count >= POST_LIMIT) return false;
    this.ctx.storage.sql.exec(
      "INSERT INTO request_rate (id, window_start, count) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET window_start = excluded.window_start, count = excluded.count",
      windowStart,
      count + 1,
    );
    return true;
  }
}

const SHOPPING_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export class ShoppingSessionObject extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS session (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        body TEXT NOT NULL,
        updated_at_ms INTEGER
      )`);
      try {
        this.ctx.storage.sql.exec("ALTER TABLE session ADD COLUMN updated_at_ms INTEGER");
      } catch {
        /* Column already exists on newer deployments. */
      }
    });
  }

  async getBody(): Promise<string | null> {
    const row = this.loadRow();
    if (!row) return null;
    if (this.isExpired(row.updatedAtMs)) {
      await this.clearBody();
      return null;
    }
    return row.body;
  }

  async putBody(body: string, expectedRevision: number | null = null): Promise<void> {
    if (body.length === 0 || body.length > 180_000) throw new Error("Shopping session could not be saved.");
    let row = this.loadRow();
    if (row && this.isExpired(row.updatedAtMs)) {
      await this.clearBody();
      row = null;
    }
    const revision = row ? snapshotRevisionOf(row.body) : 0;
    // Existing rows require an explicit CAS header. Missing headers used to
    // last-write-wins and silently bypass atomic protection.
    if (row && expectedRevision == null) throw new Error("revision-required");
    if (expectedRevision != null && revision !== expectedRevision) throw new Error("revision-conflict");
    const updatedAt = snapshotUpdatedAtOf(body) ?? Date.now();
    this.ctx.storage.sql.exec(
      "INSERT INTO session (id, body, updated_at_ms) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body, updated_at_ms = excluded.updated_at_ms",
      body,
      updatedAt,
    );
    await this.ctx.storage.setAlarm(updatedAt + SHOPPING_SESSION_TTL_MS);
  }

  async clearBody(): Promise<void> {
    this.ctx.storage.sql.exec("DELETE FROM session WHERE id = 1");
    await this.ctx.storage.deleteAlarm();
  }

  /** Deletes abandoned shopping snapshots after TTL even when no shopper reads again. */
  async alarm(): Promise<void> {
    const row = this.loadRow();
    if (!row) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    if (this.isExpired(row.updatedAtMs)) {
      await this.clearBody();
      return;
    }
    await this.ctx.storage.setAlarm(row.updatedAtMs + SHOPPING_SESSION_TTL_MS);
  }

  private loadRow(): { body: string; updatedAtMs: number } | null {
    const rows = this.ctx.storage.sql.exec<{ body: string; updated_at_ms: number | null }>(
      "SELECT body, updated_at_ms FROM session WHERE id = 1",
    ).toArray();
    const row = rows[0];
    if (!row) return null;
    const fromColumn = typeof row.updated_at_ms === "number" ? row.updated_at_ms : null;
    const fromBody = snapshotUpdatedAtOf(row.body);
    // Missing retention metadata is treated as epoch 0 so old rows expire.
    return { body: row.body, updatedAtMs: fromColumn ?? fromBody ?? 0 };
  }

  private isExpired(updatedAtMs: number): boolean {
    return Date.now() - updatedAtMs > SHOPPING_SESSION_TTL_MS;
  }
}

export class GeminiBudgetObject extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS budget (
        day TEXT PRIMARY KEY,
        used INTEGER NOT NULL
      )`);
    });
  }

  async reserve(day: string, limit: number): Promise<boolean> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(limit) || limit < 1 || limit > 500) return false;
    const rows = this.ctx.storage.sql.exec<{ used: number }>("SELECT used FROM budget WHERE day = ?", day).toArray();
    const used = rows[0] ? Number(rows[0].used) : 0;
    if (used >= limit) return false;
    this.ctx.storage.sql.exec(
      "INSERT INTO budget (day, used) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET used = excluded.used",
      day,
      used + 1,
    );
    return true;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        ok: true,
        network: "solana:devnet",
        persistence: "durable-object",
        financialExecution: "disabled",
        shoppingSessions: {
          cas: true,
          delete: true,
          ttlMs: SHOPPING_SESSION_TTL_MS,
          alarmCleanup: true,
          requireRevisionOnUpdate: true,
        },
      });
    }
    if (!authorized(request, env.SUPERTAB_CONTROL_TOKEN)) return Response.json({ error: "Unauthorized." }, { status: 401 });
    if (request.method === "GET" && url.pathname === "/meta/ledger") {
      const stats = await env.MERCHANT.getByName("ledger").stats();
      return Response.json({ network: "solana:devnet", persistence: "durable-object", ...stats });
    }
    if (request.method === "POST" && url.pathname === "/meta/import-snapshot") {
      const raw = await request.text();
      if (raw.length > 40_000) return Response.json({ error: "Snapshot was refused." }, { status: 413 });
      try {
        return Response.json(await env.MERCHANT.getByName("ledger").importIfEmpty(raw));
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const safe = /devnet|mainnet|testnet|unavailable|refused|could not be opened/i.test(message) && !/https?:|api-key|secret|seed/i.test(message);
        return Response.json({ error: safe ? message : "Snapshot was refused." }, { status: safe ? 503 : 400 });
      }
    }
    if (request.method === "POST" && url.pathname === "/meta/gemini-budget") {
      const limit = Number(env.GEMINI_DAILY_LIMIT ?? "120");
      const allowed = await env.GEMINI_BUDGET.getByName("gemini").reserve(new Date().toISOString().slice(0, 10), limit);
      return Response.json({ allowed });
    }
    const session = url.pathname.match(/^\/sessions\/([^/]+)$/);
    if (session) {
      if (!SESSION_ID.test(session[1] ?? "")) {
        return Response.json({ error: "Shopping session not found." }, { status: 404 });
      }
      const stub = env.SESSIONS.getByName(session[1]!.toLowerCase());
      if (request.method === "GET") {
        const body = await stub.getBody();
        if (body == null) return Response.json({ error: "Shopping session not found." }, { status: 404 });
        return new Response(body, { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
      }
      if (request.method === "DELETE") {
        await stub.clearBody();
        return Response.json({ ok: true });
      }
      if (request.method === "PUT") {
        const body = await request.text();
        if (body.length > 180_000) return Response.json({ error: "Shopping session could not be saved." }, { status: 413 });
        const header = request.headers.get("x-supertab-revision");
        const expected = header == null || header === "" ? null : Number(header);
        if (expected != null && !Number.isInteger(expected)) return Response.json({ error: "Shopping session could not be saved." }, { status: 400 });
        try {
          await stub.putBody(body, expected);
        } catch (error) {
          if (error instanceof Error && error.message === "revision-conflict") {
            return Response.json({ error: "This search was updated somewhere else. Refresh before trying again." }, { status: 409 });
          }
          if (error instanceof Error && error.message === "revision-required") {
            return Response.json({ error: "This shopping session requires a revision header. Redeploy the matching app." }, { status: 409 });
          }
          if (error instanceof Error && error.message === "Shopping session could not be saved.") {
            return Response.json({ error: error.message }, { status: 400 });
          }
          throw error;
        }
        return Response.json({ ok: true });
      }
      return Response.json({ error: "Not found." }, { status: 404 });
    }
    if (request.method !== "GET" && request.method !== "POST") return Response.json({ error: "Not found." }, { status: 404 });
    const rawBody = request.method === "GET" ? null : await request.text();
    if (rawBody && rawBody.length > 4_000) return Response.json({ error: "Request is too large." }, { status: 400 });
    const result = await env.MERCHANT.getByName("ledger").handle(request.method, url.pathname, rawBody);
    return new Response(result.json, { status: result.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  },
};

function snapshotRevisionOf(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { revision?: unknown };
    return typeof parsed.revision === "number" && Number.isInteger(parsed.revision) && parsed.revision >= 0 ? parsed.revision : 0;
  } catch {
    return 0;
  }
}

function snapshotUpdatedAtOf(raw: string | null): number | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { updatedAtMs?: unknown; record?: { updatedAtMs?: unknown } };
    const value = parsed.updatedAtMs ?? parsed.record?.updatedAtMs;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function merchantKey(raw: string | undefined) {
  if (!raw?.trim()) throw new Error("Devnet merchant key is missing.");
  let parsed: { merchant?: { address?: unknown; publicKey?: unknown; seed?: unknown }; address?: unknown; publicKey?: unknown; seed?: unknown };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("Devnet merchant key is missing.");
  }
  const stored = parsed.merchant ?? parsed;
  if (typeof stored.address !== "string" || typeof stored.publicKey !== "string" || typeof stored.seed !== "string") {
    throw new Error("Devnet merchant key is missing.");
  }
  return keyFromStored({ address: stored.address, publicKey: stored.publicKey, seed: stored.seed });
}

function authorized(request: Request, token: string | undefined): boolean {
  if (!token || token.length < 16) return false;
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function jsonResult(status: number, body: unknown): { status: number; json: string } {
  return { status, json: JSON.stringify(body) };
}
