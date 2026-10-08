import { afterEach, describe, expect, it, vi } from "vitest";
import { readConfig } from "../src/lib/config";
import {
  SessionConflictError,
  SessionStorageError,
  createMemorySessionStore,
  createRemoteSessionStore,
  decodeSnapshot,
  encodeSnapshot,
  isSnapshotExpired,
  snapshotWriteAllowed,
} from "../src/lib/session-snapshot";
import { fixturesEnabled, fixturesMisconfigured } from "../src/lib/shop-fixtures";
import { SESSION_TTL_MS, ShoppingService } from "../src/lib/shopping";
import { createShopBudget } from "../src/lib/shop-budget";

function offlineConfig() {
  return readConfig({
    GEMINI_API_KEY: "",
    SHOPIFY_CATALOG_ENABLED: "false",
    EBAY_CLIENT_ID: "",
    EBAY_CLIENT_SECRET: "",
  });
}

describe("multi-instance shopping sessions", () => {
  it("refuses a stale write from a second ShoppingService and keeps the newer search", async () => {
    const store = createMemorySessionStore();
    const writer = new ShoppingService({ config: offlineConfig(), sessionStore: store });
    const first = await writer.converse(null, "Find me a black polo");
    const rev1 = await store.load(first.sessionId);
    expect(rev1).toBeTruthy();

    const newer = new ShoppingService({ config: offlineConfig(), sessionStore: store });
    const second = await newer.converse(first.sessionId, "navy is fine too");
    expect(second.constraints.colors).toContain("navy");

    const staleStore = {
      async load() { return rev1; },
      async save(id: string, body: string, expectedRevision?: number) {
        return store.save(id, body, expectedRevision);
      },
    };
    const stale = new ShoppingService({ config: offlineConfig(), sessionStore: staleStore });
    await expect(stale.converse(first.sessionId, "make it white")).rejects.toBeInstanceOf(SessionConflictError);

    const check = new ShoppingService({ config: offlineConfig(), sessionStore: store });
    await check.hydrate(first.sessionId, { force: true });
    const latest = check.getSession(first.sessionId);
    expect(latest.constraints.colors).toContain("navy");
    expect(latest.constraints.colors).not.toContain("white");
    expect(latest.messages.filter((message) => message.role === "user").map((message) => message.text))
      .toEqual(["Find me a black polo", "navy is fine too"]);
  });

  it("does not duplicate a turn when the same turnId is retried after a lost response", async () => {
    const store = createMemorySessionStore();
    const service = new ShoppingService({ config: offlineConfig(), sessionStore: store });
    const first = await service.converse(null, "Find me a black polo", { turnId: "turn-1" });
    const again = await service.converse(first.sessionId, "Find me a black polo", { turnId: "turn-1" });
    expect(again.messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(again.sessionId).toBe(first.sessionId);
  });

  it("refuses the same turnId when the message text changed", async () => {
    const store = createMemorySessionStore();
    const service = new ShoppingService({ config: offlineConfig(), sessionStore: store });
    const first = await service.converse(null, "Find me a black polo", { turnId: "turn-2" });
    await expect(service.converse(first.sessionId, "Find me a navy polo", { turnId: "turn-2" }))
      .rejects.toThrow(/no longer matches the accepted request/i);
    const check = new ShoppingService({ config: offlineConfig(), sessionStore: store });
    await check.hydrate(first.sessionId, { force: true });
    expect(check.getSession(first.sessionId).messages.filter((message) => message.role === "user")).toHaveLength(1);
  });

  it("keeps a newer search when a stale review write races it", async () => {
    const previous = {
      fixtures: process.env.SUPERTAB_SHOP_FIXTURES,
      allow: process.env.SUPERTAB_ALLOW_SHOP_FIXTURES,
      vercel: process.env.VERCEL,
      vercelEnv: process.env.VERCEL_ENV,
      deploy: process.env.SUPERTAB_DEPLOYMENT,
    };
    process.env.SUPERTAB_SHOP_FIXTURES = "1";
    process.env.SUPERTAB_ALLOW_SHOP_FIXTURES = "1";
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.SUPERTAB_DEPLOYMENT;
    try {
      const store = createMemorySessionStore();
      const searcher = new ShoppingService({ config: offlineConfig(), sessionStore: store });
      const first = await searcher.converse(null, "Find me a black polo");
      const offerId = first.exact[0]?.id;
      expect(offerId).toBeTruthy();
      const staleRaw = await store.load(first.sessionId);

      const newer = new ShoppingService({ config: offlineConfig(), sessionStore: store });
      await newer.converse(first.sessionId, "navy is fine too");

      const staleStore = {
        async load() { return staleRaw; },
        async save(id: string, body: string, expectedRevision?: number) {
          return store.save(id, body, expectedRevision);
        },
      };
      const staleReview = new ShoppingService({ config: offlineConfig(), sessionStore: staleStore });
      await expect(staleReview.review({
        sessionId: first.sessionId,
        offerId: offerId!,
        walletMode: "none",
      })).rejects.toBeInstanceOf(SessionConflictError);

      const check = new ShoppingService({ config: offlineConfig(), sessionStore: store });
      await check.hydrate(first.sessionId, { force: true });
      const latest = check.getSession(first.sessionId);
      expect(latest.constraints.colors).toContain("navy");
      expect(latest.selectedOfferId).toBeNull();
    } finally {
      restoreEnv("SUPERTAB_SHOP_FIXTURES", previous.fixtures);
      restoreEnv("SUPERTAB_ALLOW_SHOP_FIXTURES", previous.allow);
      restoreEnv("VERCEL", previous.vercel);
      restoreEnv("VERCEL_ENV", previous.vercelEnv);
      restoreEnv("SUPERTAB_DEPLOYMENT", previous.deploy);
    }
  });
});

describe("shopping session restore safety", () => {
  it("does not revive balances, quotes, approvals, or proofs from a stored snapshot", async () => {
    const store = createMemorySessionStore();
    const now = Date.parse("2026-10-08T10:00:00.000Z");
    const writer = new ShoppingService({
      config: offlineConfig(),
      sessionStore: store,
      now: () => new Date(now),
    });
    const search = await writer.converse(null, "Find me a black polo");
    const raw = await store.load(search.sessionId);
    expect(raw).toBeTruthy();
    const parsed = decodeSnapshot(raw!) as {
      version: number;
      revision: number;
      updatedAtMs: number;
      record: Record<string, unknown>;
      excluded: unknown[];
      uncertain: unknown[];
    };
    const expected = parsed.revision;
    parsed.revision = expected + 1;
    parsed.record = {
      ...parsed.record,
      persistedRevision: parsed.revision,
      walletMode: "address",
      walletAddress: "JCVsKd4TMg1fvEs7rjf5YgLYbJfNC8Dwb4x1PchFkGM7",
      walletChallenge: { id: "c1", message: "sign", address: "JCVsKd4TMg1fvEs7rjf5YgLYbJfNC8Dwb4x1PchFkGM7", termsId: "t1", expiresAt: "2099-01-01T00:00:00.000Z", origin: "https://example.test", issuedAtMs: now },
      walletProof: { verifiedAt: "2026-10-08T09:59:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z" },
      balances: [{ mint: "usdc", symbol: "USDC", name: "USDC", amount: 1_000_000n, decimals: 6, usdValue: 1, isUsdc: true, routeKnown: true }],
      balanceSource: "chain",
      balanceReadAtMs: now,
      quote: {
        provider: "dflow",
        inputMint: "sol",
        outputMint: "usdc",
        inAmount: 1n,
        outAmount: 1n,
        minOutAmount: 1n,
        quotedAtMs: now,
        expiresAtMs: now + 60_000,
        requestId: "q1",
        planningMinor: 3999n,
      },
      plan: { fundable: true, quoteFreshness: "live", candidateMint: "sol", gapMinor: 0n, steps: [] },
      state: "AWAITING_SWAP_APPROVAL",
      swapApproval: { at: "2026-10-08T09:59:00.000Z", executed: false },
      purchaseIntent: { termsId: "terms-live", productTitle: "x", variant: null, currency: "USD", merchantReference: "https://x.test", sourceItemId: "1", amountMinor: 3999n, approvedAtMs: now, expiresAtMs: now + 60_000 },
      unsignedTransaction: "prepared",
      transactionVersion: "legacy",
    };
    await store.save(search.sessionId, encodeSnapshot(parsed), expected);

    const reader = new ShoppingService({
      config: offlineConfig(),
      sessionStore: store,
      now: () => new Date(now + 1_000),
    });
    await reader.hydrate(search.sessionId, { force: true });
    const view = reader.getSession(search.sessionId);
    expect(view.purchase?.balanceSource ?? "none").toBe("none");
    expect(view.purchase?.assets ?? []).toEqual([]);
    expect(view.purchase?.unsignedTransaction ?? "not_requested").toBe("not_requested");
    expect(view.purchase?.swapApproval ?? null).toBeNull();
    expect(view.purchase?.walletControl ?? null).toBeNull();
    expect(view.assistantMessage).toBe(search.assistantMessage);
  });

  it("treats a shopping snapshot past the retention window as expired, not as storage failure", async () => {
    const store = createMemorySessionStore();
    const old = Date.parse("2026-10-01T00:00:00.000Z");
    const id = "11111111-1111-4111-8111-111111111111";
    const serviceSeed = new ShoppingService({
      config: offlineConfig(),
      sessionStore: store,
      now: () => new Date(old),
    });
    const created = await serviceSeed.converse(null, "Find me a black polo");
    const raw = await store.load(created.sessionId);
    const parsed = decodeSnapshot(raw!) as { revision: number; updatedAtMs: number; record: { id: string; updatedAtMs: number } };
    parsed.updatedAtMs = old;
    parsed.record.id = id;
    parsed.record.updatedAtMs = old;
    await store.remove?.(created.sessionId);
    await store.save(id, encodeSnapshot(parsed), 0);

    expect(isSnapshotExpired(old, old + SESSION_TTL_MS + 1)).toBe(true);
    const service = new ShoppingService({
      config: offlineConfig(),
      sessionStore: store,
      now: () => new Date(old + SESSION_TTL_MS + 1),
    });
    await expect(service.hydrate(id, { force: true })).rejects.toThrow(/expired/i);
  });

  it("keeps a temporary storage outage distinct from expiry", async () => {
    const service = new ShoppingService({
      config: offlineConfig(),
      sessionStore: {
        async load() { throw new SessionStorageError(); },
        async save() { throw new SessionStorageError(); },
      },
    });
    await expect(service.hydrate("11111111-1111-4111-8111-111111111111", { force: true }))
      .rejects.toBeInstanceOf(SessionStorageError);
  });
});

describe("app/Worker compatibility gates", () => {
  const sessionId = "11111111-1111-4111-8111-111111111111";
  const env = {
    DEVNET_MERCHANT_URL: "https://worker.test",
    SUPERTAB_CONTROL_TOKEN: "local-compat-token-32chars!!!!!!",
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fails closed when the Worker omits shoppingSessions CAS capabilities (new app + legacy Worker)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return Response.json({
          ok: true,
          network: "solana:devnet",
          persistence: "durable-object",
          financialExecution: "disabled",
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }));
    const store = createRemoteSessionStore(env);
    expect(store).toBeTruthy();
    await expect(store!.load(sessionId)).rejects.toBeInstanceOf(SessionStorageError);
    await expect(store!.save(sessionId, "{}", 0)).rejects.toBeInstanceOf(SessionStorageError);
  });

  it("fails closed when the Worker advertises CAS without requireRevisionOnUpdate", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return Response.json({
          ok: true,
          shoppingSessions: { cas: true, delete: true, ttlMs: 1, alarmCleanup: true, requireRevisionOnUpdate: false },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }));
    const store = createRemoteSessionStore(env);
    await expect(store!.load(sessionId)).rejects.toBeInstanceOf(SessionStorageError);
  });

  it("sends revision headers to a compatible Worker and refuses revisionless remote saves", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return Response.json({
          ok: true,
          shoppingSessions: { cas: true, delete: true, ttlMs: 1, alarmCleanup: true, requireRevisionOnUpdate: true },
        });
      }
      if (url.includes("/sessions/") && init?.method === "PUT") {
        const headers = new Headers(init.headers);
        expect(headers.get("x-supertab-revision")).toBe("2");
        return Response.json({ ok: true });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = createRemoteSessionStore(env);
    await store!.save(sessionId, JSON.stringify({ revision: 3 }), 2);
    expect(fetchMock).toHaveBeenCalled();
    await expect(store!.save(sessionId, "{}", undefined)).rejects.toBeInstanceOf(SessionConflictError);
  });
});

describe("fixture and resource bounds", () => {
  it("requires an explicit allow flag and still refuses recognized deployments", () => {
    expect(fixturesEnabled({ SUPERTAB_SHOP_FIXTURES: "1" })).toBe(false);
    expect(fixturesEnabled({ SUPERTAB_SHOP_FIXTURES: "1", SUPERTAB_ALLOW_SHOP_FIXTURES: "1" })).toBe(true);
    expect(fixturesEnabled({ SUPERTAB_SHOP_FIXTURES: "1", SUPERTAB_ALLOW_SHOP_FIXTURES: "1", VERCEL: "1" })).toBe(false);
    expect(fixturesEnabled({ SUPERTAB_SHOP_FIXTURES: "1", SUPERTAB_ALLOW_SHOP_FIXTURES: "1", CF_PAGES: "1" })).toBe(false);
    expect(fixturesEnabled({ SUPERTAB_SHOP_FIXTURES: "1", SUPERTAB_ALLOW_SHOP_FIXTURES: "1", NODE_ENV: "production" })).toBe(true);
    expect(fixturesMisconfigured({ SUPERTAB_SHOP_FIXTURES: "1", VERCEL: "1" })).toBe(true);
    expect(fixturesMisconfigured({ SUPERTAB_SHOP_FIXTURES: "1", SUPERTAB_ALLOW_SHOP_FIXTURES: "1" })).toBe(false);
    expect(snapshotWriteAllowed(JSON.stringify({ revision: 3 }), 2)).toBe(false);
  });

  it("treats missing retention timestamps as expired", () => {
    expect(isSnapshotExpired(null, Date.parse("2026-10-08T00:00:00.000Z"))).toBe(true);
    expect(isSnapshotExpired(0, Date.parse("2026-10-08T00:00:00.000Z"))).toBe(true);
  });

  it("limits repeated shopping searches from one client key", async () => {
    const budget = createShopBudget({ windowMs: 60_000, perClient: 2 });
    expect(await budget.reserve("client-a")).toBe(true);
    expect(await budget.reserve("client-a")).toBe(true);
    expect(await budget.reserve("client-a")).toBe(false);
    expect(await budget.reserve("client-b")).toBe(true);
  });

  it("still runs fixture searches when both local test flags are set", async () => {
    const previous = {
      fixtures: process.env.SUPERTAB_SHOP_FIXTURES,
      allow: process.env.SUPERTAB_ALLOW_SHOP_FIXTURES,
      vercel: process.env.VERCEL,
      vercelEnv: process.env.VERCEL_ENV,
      deploy: process.env.SUPERTAB_DEPLOYMENT,
    };
    process.env.SUPERTAB_SHOP_FIXTURES = "1";
    process.env.SUPERTAB_ALLOW_SHOP_FIXTURES = "1";
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.SUPERTAB_DEPLOYMENT;
    try {
      const service = new ShoppingService({
        config: readConfig({
          GEMINI_API_KEY: "",
          SHOPIFY_CATALOG_ENABLED: "false",
          EBAY_CLIENT_ID: "",
          EBAY_CLIENT_SECRET: "",
        }),
      });
      const view = await service.converse(null, "Find me a black polo under $50");
      expect(view.exact.some((offer) => offer.title.includes("Black Torrey Polo"))).toBe(true);
    } finally {
      restoreEnv("SUPERTAB_SHOP_FIXTURES", previous.fixtures);
      restoreEnv("SUPERTAB_ALLOW_SHOP_FIXTURES", previous.allow);
      restoreEnv("VERCEL", previous.vercel);
      restoreEnv("VERCEL_ENV", previous.vercelEnv);
      restoreEnv("SUPERTAB_DEPLOYMENT", previous.deploy);
    }
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value == null) delete process.env[name];
  else process.env[name] = value;
}
