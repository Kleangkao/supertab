/** Bounds catalog searches per client. Gemini has its own budget. */
export interface ShopBudget {
  reserve(clientKey: string): Promise<boolean>;
}

const WINDOW_MS = 10 * 60_000;
const PER_CLIENT = 40;

export function createShopBudget(options?: {
  windowMs?: number;
  perClient?: number;
  now?: () => number;
}): ShopBudget {
  const windowMs = options?.windowMs ?? WINDOW_MS;
  const perClient = options?.perClient ?? PER_CLIENT;
  const now = options?.now ?? Date.now;
  const hits = new Map<string, number[]>();
  return {
    async reserve(clientKey) {
      const at = now();
      const key = clientKey.slice(0, 80) || "unknown";
      const recent = (hits.get(key) ?? []).filter((stamp) => at - stamp < windowMs);
      if (recent.length >= perClient) {
        hits.set(key, recent);
        prune(hits, at, windowMs);
        return false;
      }
      recent.push(at);
      hits.set(key, recent);
      prune(hits, at, windowMs);
      return true;
    },
  };
}

function prune(hits: Map<string, number[]>, at: number, windowMs: number): void {
  for (const [key, stamps] of hits) {
    const keep = stamps.filter((stamp) => at - stamp < windowMs);
    if (keep.length === 0) hits.delete(key);
    else hits.set(key, keep);
  }
}
