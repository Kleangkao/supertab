import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWalletChallenge, verifyWalletChallenge, WALLET_PROOF_TTL_MS } from "../src/lib/wallet-proof";
import { signWalletMessage, supportsWalletMessage, type StandardWallet } from "../src/lib/wallet-standard";
import { readConfig } from "../src/lib/config";
import { ShoppingService } from "../src/lib/shopping";

const NOW = Date.parse("2026-10-03T00:00:00Z");
function signer() {
  const keys = generateKeyPairSync("ed25519");
  const bytes = keys.publicKey.export({ type: "spki", format: "der" }).subarray(-32);
  let value = BigInt(`0x${bytes.toString("hex")}`), address = "";
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  while (value > 0n) { address = alphabet[Number(value % 58n)] + address; value /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; address = "1" + address; }
  return { address, signature: (message: string) => sign(null, Buffer.from(message), keys.privateKey).toString("base64") };
}

describe("wallet message proof", () => {
  it("verifies a real Ed25519 signature, binding the address, review, nonce and deadline", () => {
    const owner = signer();
    const challenge = createWalletChallenge({ address: owner.address, sessionId: "session", termsId: "review", origin: "https://supertab.test", nowMs: NOW });
    const input = { address: owner.address, termsId: "review", challengeId: challenge.id, signature: owner.signature(challenge.message), nowMs: NOW };
    expect(challenge.message).toContain("does not approve a purchase");
    expect(challenge.message).toContain("App: https://supertab.test");
    expect(() => verifyWalletChallenge(challenge, input)).not.toThrow();
    for (const patch of [{ address: signer().address }, { termsId: "other" }, { challengeId: "other" },
      { nowMs: NOW + WALLET_PROOF_TTL_MS }, { signature: owner.signature(challenge.message + " changed") },
      { signature: signer().signature(challenge.message) }, { signature: "invalid" }]) {
      expect(() => verifyWalletChallenge(challenge, { ...input, ...patch })).toThrow();
    }
  });

  it("calls only message signing with the selected wallet account and rejects modified output", async () => {
    const owner = signer();
    const account = { address: owner.address };
    const wallet: StandardWallet = { name: "Test signer", accounts: [account], features: {
      "solana:signTransaction": { signTransaction: () => { throw new Error("Transaction signing must not run"); } },
      "solana:signMessage": { signMessage: async (input: { account: typeof account; message: Uint8Array }) => {
        expect(input.account).toBe(account);
        return [{ signedMessage: input.message, signature: Uint8Array.from(Buffer.from(owner.signature(new TextDecoder().decode(input.message)), "base64")), signatureType: "ed25519" }];
      } } },
    };
    expect(supportsWalletMessage(wallet)).toBe(true);
    expect(await signWalletMessage(wallet, owner.address, "message")).toBe(owner.signature("message"));
    await expect(signWalletMessage(wallet, "another account", "message")).rejects.toThrow(/Reconnect/);
    wallet.features["solana:signMessage"] = { signMessage: async () => [{ signedMessage: new Uint8Array([1]), signature: new Uint8Array(64) }] };
    await expect(signWalletMessage(wallet, owner.address, "message")).rejects.toThrow(/exact/);
    wallet.features["solana:signMessage"] = { signMessage: async () => { throw new Error("User rejected"); } };
    await expect(signWalletMessage(wallet, owner.address, "message")).rejects.toThrow(/rejected/);
    delete wallet.features["solana:signMessage"];
    expect(supportsWalletMessage(wallet)).toBe(false);
  });
});

async function connectedSession() {
  const owner = signer();
  let nowMs = NOW;
  const service = new ShoppingService({ config: readConfig({ SHOPIFY_CATALOG_ENABLED: "true", SOLANA_RPC_URL: "https://rpc.test" }),
    now: () => new Date(nowMs), fetchImpl: async (input, init) => {
      if (String(input).includes("rpc.test")) {
        const body = JSON.parse(String(init?.body));
        return Response.json({ result: body.method === "getBalance" ? { value: 0 } : { value: [] } });
      }
      return Response.json({ result: { structuredContent: { products: [{ id: "polo", title: "Black polo", variants: [{
        id: "gid://shopify/ProductVariant/1", title: "Black polo", price: { amount: 1000, currency: "USD" },
        availability: { available: true }, checkout_url: "https://merchant.test/cart/1:1",
      }] }] } } });
    } });
  const search = await service.converse(null, "Find a black polo under $50");
  const selection = { sessionId: search.sessionId, offerId: search.exact[0]!.id, walletMode: "connected" as const, address: owner.address };
  const view = await service.review(selection);
  return { owner, service, selection, view, advance: () => { nowMs += WALLET_PROOF_TTL_MS; } };
}

describe("wallet control service boundary", () => {
  it("records proof only after verification, consumes challenges, and never approves payment or swap", async () => {
    const { service, selection, view, owner, advance } = await connectedSession();
    const terms = view.purchase!.termsId;
    const challenge = service.requestWalletCheck(selection.sessionId, terms, "https://supertab.test");
    const signature = owner.signature(challenge.message);
    const confirmed = service.confirmWalletCheck(selection.sessionId, terms, challenge.id, signature);
    expect(confirmed.purchase).toMatchObject({ walletControl: { verifiedAt: new Date(NOW).toISOString() },
      purchaseApproval: "required", swapApproval: null, financialExecution: "disabled", orderStatus: "ORDER_NOT_CREATED" });
    expect(JSON.stringify(confirmed)).not.toContain(signature);
    expect(JSON.stringify(confirmed)).not.toContain(challenge.id);
    expect(() => service.confirmWalletCheck(selection.sessionId, terms, challenge.id, signature)).toThrow(/current/);
    advance(); expect(service.getSession(selection.sessionId).purchase!.walletControl).toBeNull();
  });

  it("rejects replaced, invalid, expired and obsolete-review challenges and clears proof on wallet refresh", async () => {
    const { service, selection, view, owner, advance } = await connectedSession();
    const terms = view.purchase!.termsId;
    const first = service.requestWalletCheck(selection.sessionId, terms, "https://supertab.test");
    const second = service.requestWalletCheck(selection.sessionId, terms, "https://supertab.test");
    expect(first.id).not.toBe(second.id);
    expect(() => service.confirmWalletCheck(selection.sessionId, terms, first.id, owner.signature(first.message))).toThrow();
    expect(() => service.confirmWalletCheck(selection.sessionId, terms, second.id, owner.signature(second.message))).toThrow();
    const invalid = service.requestWalletCheck(selection.sessionId, terms, "https://supertab.test");
    expect(() => service.confirmWalletCheck(selection.sessionId, terms, invalid.id, signer().signature(invalid.message))).toThrow(/control/);
    expect(service.getSession(selection.sessionId).purchase!.walletControl).toBeNull();
    const stale = service.requestWalletCheck(selection.sessionId, terms, "https://supertab.test");
    advance(); expect(() => service.confirmWalletCheck(selection.sessionId, terms, stale.id, owner.signature(stale.message))).toThrow(/expired/);
    const old = service.requestWalletCheck(selection.sessionId, terms, "https://supertab.test");
    const refreshed = await service.review(selection);
    expect(() => service.confirmWalletCheck(selection.sessionId, terms, old.id, owner.signature(old.message))).toThrow(/current/);
    const fresh = service.requestWalletCheck(selection.sessionId, refreshed.purchase!.termsId, "https://supertab.test");
    service.confirmWalletCheck(selection.sessionId, refreshed.purchase!.termsId, fresh.id, owner.signature(fresh.message));
    const cleared = await service.review({ ...selection, walletMode: "none" });
    expect(cleared.purchase!.walletControl).toBeNull();
    expect(() => service.requestWalletCheck(selection.sessionId, cleared.purchase!.termsId, "https://supertab.test")).toThrow(/Reconnect/);
  });
});
