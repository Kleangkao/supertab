import { readFileSync } from "node:fs";
import { associatedTokenAddress } from "./ata";
import { listen } from "./http";
import { normalizeChainTransaction } from "./normalize";
import { CIRCLE_SOLANA_DEVNET_USDC_MINT } from "./product";
import { confirmedTransaction, recentBlockhash } from "./rpc";
import { DevnetMerchant } from "./service";
import { openDurableStore } from "./store";

const port = Number(process.env.MERCHANT_PORT ?? "8787");
const storeFile = process.env.MERCHANT_STORE ?? "data/devnet-merchant.json";
const keysFile = process.env.MERCHANT_KEYS ?? "merchant/secrets/devnet-keys.json";

const address = merchantAddress(keysFile);
const destination = associatedTokenAddress(address, CIRCLE_SOLANA_DEVNET_USDC_MINT);
const merchant = new DevnetMerchant(
  openDurableStore(storeFile),
  address,
  destination,
  async (signature) => normalizeChainTransaction(await confirmedTransaction(signature)),
  recentBlockhash,
);

const server = await listen(merchant, port);
console.log(`Devnet merchant listening at ${server.url}`);

function merchantAddress(file: string): string {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { merchant?: { address?: unknown } };
  const value = parsed.merchant?.address;
  if (typeof value !== "string" || value.length < 32 || value.length > 50) {
    throw new Error("Devnet merchant address is missing.");
  }
  return value;
}
