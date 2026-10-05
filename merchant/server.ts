import { readFileSync } from "node:fs";
import { associatedTokenAddress } from "./ata";
import { listen } from "./http";
import { keyFromStored } from "./keys";
import { normalizeChainTransaction } from "./normalize";
import { CIRCLE_SOLANA_DEVNET_USDC_MINT } from "./product";
import { confirmedTransaction, devnetRpcUrl, ensureDevnetEndpoint, recentBlockhash, sendSigned } from "./rpc";
import { DevnetMerchant } from "./service";
import { openDurableStore } from "./store";

const port = Number(process.env.MERCHANT_PORT ?? "8787");
const storeFile = process.env.MERCHANT_STORE ?? "data/devnet-merchant.json";
const keysFile = process.env.MERCHANT_KEYS ?? "merchant/secrets/devnet-keys.json";

const merchantKey = loadMerchantKey(keysFile);
const destination = associatedTokenAddress(merchantKey.address, CIRCLE_SOLANA_DEVNET_USDC_MINT);
const merchant = new DevnetMerchant(
  openDurableStore(storeFile),
  merchantKey.address,
  destination,
  async (signature) => normalizeChainTransaction(await confirmedTransaction(signature)),
  recentBlockhash,
  { merchant: merchantKey, send: sendSigned },
);

await ensureDevnetEndpoint();
console.log(`Devnet RPC host ${new URL(devnetRpcUrl()).host} verified as Solana devnet.`);
const server = await listen(merchant, port);
console.log(`Devnet merchant listening at ${server.url}`);

function loadMerchantKey(file: string) {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { merchant?: { address?: unknown; publicKey?: unknown; seed?: unknown } };
  const stored = parsed.merchant;
  if (!stored || typeof stored.address !== "string" || typeof stored.publicKey !== "string" || typeof stored.seed !== "string") {
    throw new Error("Devnet merchant key is missing.");
  }
  return keyFromStored({ address: stored.address, publicKey: stored.publicKey, seed: stored.seed });
}
