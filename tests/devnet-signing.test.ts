import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decodeBase58 } from "../src/lib/base58";
import { buildMemoTransaction, checkMemoBytes, DEVNET_CHAIN } from "../src/lib/devnet-memo";
import { prepareDevnetCheck, verifyDevnetCheck, DEVNET_CHECK_TTL_MS } from "../src/lib/devnet-signing";
import { signDevnetCheck, supportsDevnetSigning, type StandardWallet } from "../src/lib/wallet-standard";
import { ShoppingService } from "../src/lib/shopping";
import { readConfig } from "../src/lib/config";

const NOW = Date.parse("2026-10-03T00:00:00Z");
const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";
function owner() {
  const keys = generateKeyPairSync("ed25519");
  const bytes = keys.publicKey.export({ type: "spki", format: "der" }).subarray(-32);
  let value = BigInt(`0x${bytes.toString("hex")}`), address = "";
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  while (value > 0n) { address = alphabet[Number(value % 58n)] + address; value /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; address = "1" + address; }
  return { address, sign: (message: Uint8Array) => sign(null, message, keys.privateKey) };
}
const blockhashResponse = () => Response.json({ result: { value: { blockhash: BLOCKHASH, lastValidBlockHeight: 100 } } });

describe("devnet sign-only transaction", () => {
  it("builds one signer, one readonly memo program and one signer-only instruction", () => {
    const signer = owner();
    const bytes = buildMemoTransaction(signer.address, BLOCKHASH, "hello");
    expect(bytes[0]).toBe(1);
    expect([...bytes.subarray(1, 65)]).toEqual(new Array(64).fill(0));
    expect([...bytes.subarray(65, 69)]).toEqual([1, 0, 1, 2]);
    expect(bytes.subarray(69, 101)).toEqual(decodeBase58(signer.address));
    expect([...bytes.subarray(165, 170)]).toEqual([1, 1, 1, 0, 5]);
    expect(new TextDecoder().decode(bytes.subarray(170))).toBe("hello");
    expect(buildMemoTransaction(signer.address, BLOCKHASH, "m".repeat(128))[169]).toBe(128);
    expect(() => buildMemoTransaction(signer.address, BLOCKHASH, "m".repeat(501))).toThrow();
    expect(() => buildMemoTransaction("wrong", BLOCKHASH, "memo")).toThrow();
    expect(decodeBase58("11111111111111111111111111111111")).toEqual(new Uint8Array(32));
  });

  it("uses the fixed public devnet RPC and verifies exact Ed25519 transaction bytes", async () => {
    const signer = owner();
    const check = await prepareDevnetCheck({ address: signer.address, termsId: "review", origin: "https://supertab.test", now: () => NOW,
      fetchImpl: async (url, init) => {
        expect(url).toBe("https://api.devnet.solana.com");
        expect(init?.redirect).toBe("error");
        expect(JSON.parse(String(init?.body)).method).toBe("getLatestBlockhash");
        return blockhashResponse();
      } });
    const signed = Buffer.from(check.transaction, "base64");
    signed.set(signer.sign(signed.subarray(65)), 1);
    expect(() => verifyDevnetCheck(check, signed.toString("base64"), NOW)).not.toThrow();
    expect(() => verifyDevnetCheck(check, signed.toString("base64"), NOW + DEVNET_CHECK_TTL_MS)).toThrow(/expired/);
    const modified = Buffer.from(signed); modified[101] ^= 1;
    expect(() => verifyDevnetCheck(check, modified.toString("base64"), NOW)).toThrow(/differs/);
    const badSignature = Buffer.from(signed); badSignature[1] ^= 1;
    expect(() => verifyDevnetCheck(check, badSignature.toString("base64"), NOW)).toThrow(/control/);
    expect(() => verifyDevnetCheck(check, check.transaction, NOW)).toThrow(/control/);
    expect(() => verifyDevnetCheck(check, "!invalid", NOW)).toThrow(/Invalid/);
    expect(() => checkMemoBytes({ ...check, chain: "solana:mainnet" as typeof DEVNET_CHAIN }, signed, true)).toThrow(/isolated/);
  });

  it("fails closed on unusable devnet responses", async () => {
    const input = { address: owner().address, termsId: "review", origin: "https://supertab.test", now: () => NOW };
    await expect(prepareDevnetCheck({ ...input, fetchImpl: async () => Response.json({ error: { code: -1 } }) })).rejects.toThrow(/blockhash/);
    await expect(prepareDevnetCheck({ ...input, fetchImpl: async () => { throw new Error("offline"); } })).rejects.toThrow(/reached/);
  });

  it("requests only the exact supported devnet transaction and rejects wallet modifications", async () => {
    const signer = owner();
    const check = await prepareDevnetCheck({ address: signer.address, termsId: "review", origin: "https://supertab.test", now: () => Date.now(), fetchImpl: async () => blockhashResponse() });
    const account = { address: signer.address, chains: [DEVNET_CHAIN], features: ["solana:signTransaction"] };
    let calls = 0;
    const wallet: StandardWallet = { name: "Fixture signer", chains: [DEVNET_CHAIN], accounts: [account], features: {
      "solana:signAndSendTransaction": { signAndSendTransaction: () => { throw new Error("No broadcasting"); } },
      "solana:signTransaction": { supportedTransactionVersions: ["legacy"], signTransaction: async (input: { account: typeof account; chain: string; transaction: Uint8Array }) => {
        calls++; expect(input.account).toBe(account); expect(input.chain).toBe(DEVNET_CHAIN);
        const bytes = Uint8Array.from(input.transaction); bytes.set(signer.sign(bytes.subarray(65)), 1);
        return [{ signedTransaction: bytes }];
      } },
    } };
    expect(supportsDevnetSigning(wallet, signer.address)).toBe(true);
    const signed = await signDevnetCheck(wallet, check);
    expect(() => verifyDevnetCheck(check, signed, Date.now())).not.toThrow(); expect(calls).toBe(1);
    account.chains = ["solana:mainnet"];
    await expect(signDevnetCheck(wallet, check)).rejects.toThrow(/support/); expect(calls).toBe(1);
    account.chains = [DEVNET_CHAIN];
    wallet.features["solana:signTransaction"] = { supportedTransactionVersions: ["legacy"], signTransaction: async () => {
      const bytes = Buffer.from(check.transaction, "base64"); bytes[165] = 2; return [{ signedTransaction: bytes }];
    } };
    await expect(signDevnetCheck(wallet, check)).rejects.toThrow(/differs/);
  });
});

async function fixture(onDevnet?: () => Promise<Response>) {
  const signer = owner();
  let nowMs = NOW;
  const methods: string[] = [];
  const service = new ShoppingService({ config: readConfig({ SHOPIFY_CATALOG_ENABLED: "true", SOLANA_RPC_URL: "https://rpc.test" }), now: () => new Date(nowMs),
    fetchImpl: async (url, init) => {
      const body = JSON.parse(String(init?.body));
      if (String(url) === "https://api.devnet.solana.com") { methods.push(body.method); return onDevnet ? onDevnet() : blockhashResponse(); }
      if (String(url).includes("rpc.test")) return Response.json({ result: body.method === "getBalance" ? { value: 0 } : { value: [] } });
      return Response.json({ result: { structuredContent: { products: [{ id: "polo", title: "Black polo", variants: [{
        id: "gid://shopify/ProductVariant/1", title: "Black polo", price: { amount: 1000, currency: "USD" }, availability: { available: true },
      }] }] } } });
    } });
  const search = await service.converse(null, "Black polo under $50");
  const selection = { sessionId: search.sessionId, offerId: search.exact[0]!.id, walletMode: "connected" as const, address: signer.address };
  const review = await service.review(selection);
  const termsId = review.purchase!.termsId;
  const challenge = service.requestWalletCheck(search.sessionId, termsId, "https://supertab.test");
  service.confirmWalletCheck(search.sessionId, termsId, challenge.id, signer.sign(Buffer.from(challenge.message)).toString("base64"));
  return { service, signer, selection, termsId, methods, expire: () => { nowMs += DEVNET_CHECK_TTL_MS; } };
}

describe("devnet session boundary", () => {
  it("cannot publish an old preparation after a newer wallet clear", async () => {
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const { service, selection, termsId } = await fixture(async () => { entered(); await blocked; return blockhashResponse(); });
    const pending = service.prepareDevnetSigning(selection.sessionId, termsId, "https://supertab.test");
    const rejected = expect(pending).rejects.toThrow(/changed/);
    await started;
    await service.review({ ...selection, walletMode: "none" });
    release(); await rejected;
    expect(service.getSession(selection.sessionId).purchase).toMatchObject({ walletMode: "none", walletControl: null, devnetSigning: null });
  });
  it("requires wallet proof, consumes every attempt, and preserves all real purchase states", async () => {
    const { service, signer, selection, termsId, methods } = await fixture();
    const check = await service.prepareDevnetSigning(selection.sessionId, termsId, "https://supertab.test");
    const signed = Buffer.from(check.transaction, "base64"); signed.set(signer.sign(signed.subarray(65)), 1);
    const result = service.confirmDevnetSigning(selection.sessionId, termsId, check.id, signed.toString("base64"));
    expect(result.purchase).toMatchObject({ devnetSigning: { chain: DEVNET_CHAIN, broadcast: false }, purchaseApproval: "required",
      swapApproval: null, orderStatus: "ORDER_NOT_CREATED", financialExecution: "disabled" });
    expect(JSON.stringify(result)).not.toContain(signed.toString("base64"));
    expect(JSON.stringify(result)).not.toContain(check.transaction);
    expect(methods).toEqual(["getLatestBlockhash"]);
    expect(() => service.confirmDevnetSigning(selection.sessionId, termsId, check.id, signed.toString("base64"))).toThrow(/current/);
    await service.review({ ...selection, walletMode: "address" });
    await expect(service.prepareDevnetSigning(selection.sessionId, termsId, "https://supertab.test")).rejects.toThrow(/control/);
    expect(service.getSession(selection.sessionId).purchase!.devnetSigning).toBeNull();
  });

  it("rejects expired, replaced and obsolete review checks", async () => {
    const { service, signer, selection, termsId, expire } = await fixture();
    const check = await service.prepareDevnetSigning(selection.sessionId, termsId, "https://supertab.test");
    const signed = Buffer.from(check.transaction, "base64"); signed.set(signer.sign(signed.subarray(65)), 1);
    await service.prepareDevnetSigning(selection.sessionId, termsId, "https://supertab.test");
    expect(() => service.confirmDevnetSigning(selection.sessionId, termsId, check.id, signed.toString("base64"))).toThrow(/current/);
    const fresh = await service.prepareDevnetSigning(selection.sessionId, termsId, "https://supertab.test");
    const valid = Buffer.from(fresh.transaction, "base64"); valid.set(signer.sign(valid.subarray(65)), 1);
    expire(); expect(() => service.confirmDevnetSigning(selection.sessionId, termsId, fresh.id, valid.toString("base64"))).toThrow(/expired/);
    const old = await service.prepareDevnetSigning(selection.sessionId, termsId, "https://supertab.test");
    await service.review(selection);
    expect(() => service.confirmDevnetSigning(selection.sessionId, termsId, old.id, valid.toString("base64"))).toThrow(/control/);
  });
});
