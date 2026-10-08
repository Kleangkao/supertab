import { beforeEach, describe, expect, it, vi } from "vitest";

const budgetState = { remaining: 2 };

vi.mock("@/lib/shopping", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/shopping")>("../src/lib/shopping");
  const view = {
    sessionId: "11111111-1111-4111-8111-111111111111",
    assistantMessage: "ok",
    constraintsLabel: "polo",
    constraints: { productQuery: "polo", colors: [], sizes: [], maxPriceCents: null, condition: "any", shipToCountry: null },
    messages: [],
    exact: [],
    uncertain: [],
    excluded: [],
    providers: [],
    gemini: "not_configured" as const,
    selectedOfferId: null,
    purchase: null,
  };
  return {
    ...actual,
    getShoppingService: () => ({
      async hydrate() { /* no-op */ },
      getSession() { return view; },
      async converse(_sessionId: string | null, message: string) {
        return { ...view, assistantMessage: message, messages: [{ role: "user" as const, text: message }, { role: "assistant" as const, text: "ok" }] };
      },
      async forget() { /* no-op */ },
    }),
  };
});

vi.mock("@/lib/shop-budget", () => ({
  createShopBudget: () => ({
    async reserve() {
      if (budgetState.remaining <= 0) return false;
      budgetState.remaining -= 1;
      return true;
    },
  }),
}));

describe("shop API bounds", () => {
  beforeEach(() => {
    budgetState.remaining = 2;
    vi.resetModules();
  });

  it("rejects cross-origin shopping mutations and accepts same-origin searches until the budget is spent", async () => {
    const { POST, GET } = await import("../src/app/api/shop/route");
    const foreign = await POST(new Request("http://127.0.0.1:3000/api/shop", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example", host: "127.0.0.1:3000" },
      body: JSON.stringify({ message: "Find me a black polo" }),
    }));
    expect(foreign.status).toBe(403);

    const ok = await POST(new Request("http://127.0.0.1:3000/api/shop", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" },
      body: JSON.stringify({ message: "Find me a black polo" }),
    }));
    expect(ok.status).toBe(200);

    const second = await POST(new Request("http://127.0.0.1:3000/api/shop", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" },
      body: JSON.stringify({ message: "Find me navy polo" }),
    }));
    expect(second.status).toBe(200);

    const limited = await POST(new Request("http://127.0.0.1:3000/api/shop", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" },
      body: JSON.stringify({ message: "Find me white polo" }),
    }));
    expect(limited.status).toBe(429);

    const restore = await GET(new Request("http://127.0.0.1:3000/api/shop?sessionId=11111111-1111-4111-8111-111111111111"));
    expect(restore.status).toBe(200);
  });
});
