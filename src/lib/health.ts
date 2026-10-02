import { bridgeAccess } from "./bridge-rail";
import type { AppConfig } from "./config";
import type { HealthView } from "./view";

export async function buildHealth(
  config: AppConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<HealthView> {
  const [solana, dflow] = await Promise.all([
    probeSolana(config.solanaRpcUrl, fetchImpl),
    probeDflow(config.dflowBaseUrl, config.dflowApiKey, fetchImpl),
  ]);
  return {
    gemini: config.geminiApiKey ? "configured" : "not_configured",
    geminiModel: config.geminiModel,
    shopify: config.shopifyEnabled ? "configured" : "not_configured",
    ebay: config.ebayClientId && config.ebayClientSecret ? "configured" : "not_configured",
    solana,
    dflow,
    cardRail: bridgeAccess(config).access,
    financialExecution: "disabled",
  };
}

async function probeSolana(rpcUrl: string, fetchImpl: typeof fetch): Promise<HealthView["solana"]> {
  try {
    const response = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return "unavailable";
    const body = await response.json() as { result?: string; error?: unknown };
    return body.result === "ok" ? "available" : "unavailable";
  } catch {
    return "unavailable";
  }
}

async function probeDflow(baseUrl: string, apiKey: string | null, fetchImpl: typeof fetch): Promise<HealthView["dflow"]> {
  try {
    const headers: Record<string, string> = { accept: "application/json" };
    if (apiKey) headers["x-api-key"] = apiKey;
    const response = await fetchImpl(
      `${baseUrl.replace(/\/$/, "")}/order?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000&slippageBps=50`,
      { headers, signal: AbortSignal.timeout(6_000) },
    );
    if (!response.ok) return apiKey ? "unavailable" : "not_configured";
    if (!apiKey) return "available";
    const body = await response.json() as { outAmount?: unknown };
    return typeof body.outAmount === "string" && BigInt(body.outAmount) > 0n ? "live_quote" : "authenticated";
  } catch {
    return apiKey ? "unavailable" : "not_configured";
  }
}
