export interface GeminiBudget {
  reserve(clientKey: string): Promise<boolean>;
}

const WINDOW_MS = 10 * 60_000;
const PER_CLIENT = 20;
const LOCAL_DAILY = 80;

/** Stops one hosted instance, one client, and the shared daily counter from unbounded Gemini use. */
export function createGeminiBudget(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): GeminiBudget {
  const hits = new Map<string, number[]>();
  let localDay = "";
  let localCount = 0;
  const base = env.DEVNET_MERCHANT_URL?.trim();
  const token = env.SUPERTAB_CONTROL_TOKEN?.trim();
  return {
    async reserve(clientKey) {
      const now = Date.now();
      const day = new Date(now).toISOString().slice(0, 10);
      if (day !== localDay) {
        localDay = day;
        localCount = 0;
      }
      if (localCount >= LOCAL_DAILY) return false;
      const key = clientKey.slice(0, 80) || "unknown";
      const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
      if (recent.length >= PER_CLIENT) {
        hits.set(key, recent);
        return false;
      }
      if (base && token) {
        try {
          const response = await fetchImpl(new URL("/meta/gemini-budget", base), {
            method: "POST",
            headers: { authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(4_000),
          });
          const body = await response.json().catch(() => null) as { allowed?: unknown } | null;
          if (!response.ok || body?.allowed !== true) return false;
        } catch {
          return false;
        }
      }
      localCount += 1;
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}

/**
 * Budget key for process-local shop/Gemini limits.
 * On Vercel, the platform sets x-forwarded-for; clients cannot freely choose an arbitrary
 * trusted key. Shared NAT users may share a key. This is not a global durable quota.
 */
export function shoppingClientKey(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (/^[0-9a-f:.]+$/i.test(vercel) && vercel.length <= 64) return `v:${vercel}`;
  const realIp = request.headers.get("x-real-ip")?.trim() ?? "";
  if (/^[0-9a-f:.]+$/i.test(realIp) && realIp.length <= 64) return `r:${realIp}`;
  // Prefer the right-most forwarded hop when a proxy chain is present; left-most is easiest to spoof.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
  const hop = forwarded.at(-1) ?? "";
  if (/^[0-9a-f:.]+$/i.test(hop) && hop.length <= 64) return `f:${hop}`;
  return "unknown";
}
