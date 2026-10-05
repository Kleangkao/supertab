import { readFileSync } from "node:fs";
import { createServer } from "vite";

loadDedicatedDevnetRpc();

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
await vite.ssrLoadModule("/merchant/server.ts");

function loadDedicatedDevnetRpc() {
  if (process.env.SOLANA_DEVNET_RPC_URL?.trim()) return;
  let text = "";
  try {
    text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("SOLANA_DEVNET_RPC_URL=")) continue;
    const value = trimmed.slice("SOLANA_DEVNET_RPC_URL=".length).trim().replace(/^["']|["']$/g, "");
    if (value) process.env.SOLANA_DEVNET_RPC_URL = value;
  }
}
