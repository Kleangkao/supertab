import { createPrivateKey, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { encodeBase58 } from "./base58";

export interface SolanaKey {
  address: string;
  publicKey: Uint8Array;
  seed: Uint8Array;
  privateKey: KeyObject;
}

export function generateSolanaKey(): SolanaKey {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const exportedPublic = publicKey.export({ format: "jwk" });
  const exportedPrivate = privateKey.export({ format: "jwk" });
  if (typeof exportedPublic.x !== "string" || typeof exportedPrivate.d !== "string") {
    throw new Error("Ed25519 key generation did not return a seed.");
  }
  return keyFromParts(Buffer.from(exportedPublic.x, "base64url"), Buffer.from(exportedPrivate.d, "base64url"));
}

export function keyFromParts(publicKey: Uint8Array, seed: Uint8Array): SolanaKey {
  if (publicKey.length !== 32 || seed.length !== 32) throw new Error("Invalid Solana key length.");
  const address = encodeBase58(publicKey);
  const privateKey = createPrivateKey({
    format: "jwk",
    key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(publicKey).toString("base64url"), d: Buffer.from(seed).toString("base64url") },
  });
  return { address, publicKey, seed, privateKey };
}

export function keyFromStored(stored: { address: string; publicKey: string; seed: string }): SolanaKey {
  const key = keyFromParts(Buffer.from(stored.publicKey, "base64"), Buffer.from(stored.seed, "base64"));
  if (key.address !== stored.address) throw new Error("Stored devnet key does not match its address.");
  return key;
}

export function signBytes(key: SolanaKey, message: Uint8Array): Uint8Array {
  const signature = sign(null, message, key.privateKey);
  if (signature.length !== 64) throw new Error("Ed25519 signature had an unexpected length.");
  return signature;
}
