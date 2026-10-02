import { createPublicKey, randomUUID, verify } from "node:crypto";
import { decodeBase58, isPlausibleAddress } from "./wallet";

export const WALLET_PROOF_TTL_MS = 5 * 60_000;
export interface WalletChallenge {
  id: string;
  message: string;
  address: string;
  termsId: string;
  expiresAt: string;
}

export function createWalletChallenge(input: { address: string; termsId: string; sessionId: string; origin: string; nowMs: number }): WalletChallenge {
  if (!isPlausibleAddress(input.address)) throw new Error("Connect a valid Solana wallet first.");
  const origin = new URL(input.origin);
  if (origin.origin !== input.origin || !["http:", "https:"].includes(origin.protocol)) throw new Error("Invalid application origin.");
  const id = randomUUID();
  const expiresAt = new Date(input.nowMs + WALLET_PROOF_TTL_MS).toISOString();
  return { id, address: input.address, termsId: input.termsId, expiresAt,
    message: ["SuperTab wallet control check", `App: ${input.origin}`, `Wallet: ${input.address}`,
      "This message proves wallet control only. It does not approve a purchase, swap, payment, allowance or transaction.",
      `Session: ${input.sessionId}`, `Review: ${input.termsId}`, `Nonce: ${id}`, `Expires: ${expiresAt}`].join("\n") };
}

/** The exact server challenge is verified. Arbitrary client messages are never trusted. */
export function verifyWalletChallenge(challenge: WalletChallenge, input: {
  challengeId: string; address: string; termsId: string; signature: string; nowMs: number;
}): void {
  if (input.challengeId !== challenge.id || input.address !== challenge.address || input.termsId !== challenge.termsId
    || input.nowMs >= Date.parse(challenge.expiresAt)) throw new Error("This wallet check expired or the review changed. Request a new check.");
  if (!/^[A-Za-z0-9+/]{86}==$/.test(input.signature)) throw new Error("The wallet returned an invalid signature.");
  const bytes = decodeBase58(challenge.address);
  if (!bytes || bytes.length !== 32) throw new Error("Invalid wallet address.");
  const key = createPublicKey({ format: "der", type: "spki",
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(bytes)]) });
  if (!verify(null, Buffer.from(challenge.message, "utf8"), key, Buffer.from(input.signature, "base64"))) {
    throw new Error("The signature does not prove control of this wallet.");
  }
}
