export interface AppConfig {
  geminiApiKey: string | null;
  geminiModel: string;
  shopifyEnabled: boolean;
  shopifyCatalogUrl: string;
  shopifyProfile: string;
  shopifyShipTo: string;
  shopifyCheckoutToken: string | null;
  shopifyClientId: string | null;
  shopifyClientSecret: string | null;
  shopifyCheckoutOrigins: string[];
  ebayClientId: string | null;
  ebayClientSecret: string | null;
  ebayEnvironment: "production" | "sandbox";
  ebayMarketplaceId: string;
  solanaRpcUrl: string;
  solanaRpcCustom: boolean;
  solanaCluster: string;
  dflowBaseUrl: string;
  dflowApiKey: string | null;
  dflowSlippageBps: number;
  bridgeApiKey: string | null;
  bridgeApiBaseUrl: string;
  bridgeWebhookSecret: string | null;
}

const PUBLIC_SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const DEFAULT_DFLOW = "https://dev-quote-api.dflow.net";

export function readConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const rpc = blankToNull(env.SOLANA_RPC_URL);
  const slippage = Number(env.DFLOW_SLIPPAGE_BPS ?? "50");
  return {
    geminiApiKey: blankToNull(env.GEMINI_API_KEY),
    geminiModel: blankToNull(env.GEMINI_MODEL) ?? "gemini-3.5-flash-lite",
    shopifyEnabled: env.SHOPIFY_CATALOG_ENABLED !== "false",
    shopifyCatalogUrl: blankToNull(env.SHOPIFY_CATALOG_URL) ?? "https://catalog.shopify.com/api/ucp/mcp",
    shopifyProfile: blankToNull(env.SHOPIFY_UCP_PROFILE)
      ?? "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json",
    shopifyShipTo: (blankToNull(env.SHOPIFY_SHIP_TO_COUNTRY) ?? "US").toUpperCase(),
    shopifyCheckoutToken: blankToNull(env.SHOPIFY_CHECKOUT_ACCESS_TOKEN),
    shopifyClientId: blankToNull(env.SHOPIFY_CLIENT_ID),
    shopifyClientSecret: blankToNull(env.SHOPIFY_CLIENT_SECRET),
    shopifyCheckoutOrigins: (env.SHOPIFY_CHECKOUT_ALLOWED_ORIGINS ?? "").split(",").map(value => value.trim()).filter(value => {
      try { const url = new URL(value); return url.protocol === "https:" && url.origin === value && !url.username && !url.password; }
      catch { return false; }
    }),
    ebayClientId: blankToNull(env.EBAY_CLIENT_ID),
    ebayClientSecret: blankToNull(env.EBAY_CLIENT_SECRET),
    ebayEnvironment: env.EBAY_ENVIRONMENT === "sandbox" ? "sandbox" : "production",
    ebayMarketplaceId: blankToNull(env.EBAY_MARKETPLACE_ID) ?? "EBAY_US",
    solanaRpcUrl: rpc ?? PUBLIC_SOLANA_RPC,
    solanaRpcCustom: rpc != null,
    solanaCluster: blankToNull(env.SOLANA_CLUSTER) ?? "mainnet-beta",
    dflowBaseUrl: blankToNull(env.DFLOW_QUOTE_BASE_URL) ?? DEFAULT_DFLOW,
    dflowApiKey: blankToNull(env.DFLOW_API_KEY),
    dflowSlippageBps: Number.isInteger(slippage) && slippage >= 0 && slippage <= 10_000 ? slippage : 50,
    bridgeApiKey: blankToNull(env.BRIDGE_API_KEY),
    bridgeApiBaseUrl: blankToNull(env.BRIDGE_API_BASE_URL) ?? "https://api.sandbox.bridge.xyz",
    bridgeWebhookSecret: blankToNull(env.BRIDGE_WEBHOOK_SECRET),
  };
}

export function assertNoSecrets(report: unknown, secrets: string[]): void {
  const text = JSON.stringify(report);
  for (const secret of secrets) {
    if (secret && text.includes(secret)) {
      throw new Error("A configuration report included a secret.");
    }
  }
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
