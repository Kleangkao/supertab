import { expect, it } from "vitest";
import { connectStandardWallet, discoverStandardWallets, signWalletMessage, supportsDevnetSigning, watchStandardWallet, type StandardWallet } from "../src/lib/wallet-standard";

const wallet: StandardWallet = { name: "Late Solana wallet", accounts: [], features: {} };

it("invalidates account, network and capability changes and ignores events after cleanup", () => {
  let listener: (change: Record<string, unknown>) => void = () => {};
  let invalidations = 0;
  let cleanups = 0;
  const off = watchStandardWallet({ ...wallet, features: { "standard:events": {
    on: (event: string, callback: typeof listener) => {
      expect(event).toBe("change"); listener = callback;
      return () => { cleanups++; };
    },
  } } }, () => { invalidations++; });
  listener({}); listener({ name: "renamed" });
  expect(invalidations).toBe(0);
  listener({ accounts: [] }); listener({ chains: ["solana:devnet"] }); listener({ features: {} });
  expect(invalidations).toBe(3);
  off(); off(); listener({ accounts: [{ address: "another" }] });
  expect(invalidations).toBe(3);
  expect(cleanups).toBe(1);
});

it("supports wallets without the optional events feature", () => {
  expect(() => watchStandardWallet(wallet, () => { throw new Error("unexpected event"); })()).not.toThrow();
});

it("discovers a wallet registered after the app using the standard callback event", () => {
  const target = new EventTarget();
  const found = discoverStandardWallets(target);
  target.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", {
    detail: ({ register }: { register: (...wallets: StandardWallet[]) => unknown }) => register(wallet),
  }));
  expect(found).toEqual([wallet]);
  expect(discoverStandardWallets(target)).toBe(found);
});

it("deduplicates wallet registration and supports unregister", () => {
  const target = new EventTarget();
  const found = discoverStandardWallets(target);
  let unregister: (() => void) | undefined;
  target.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", {
    detail: ({ register }: { register: (...wallets: StandardWallet[]) => () => void }) => {
      unregister = register(wallet, wallet);
    },
  }));
  expect(found).toHaveLength(1);
  unregister!();
  expect(found).toHaveLength(0);
});

it("signs with the account returned by connect when the wallet account list stays empty", async () => {
  const account = { address: "connected-account", chains: ["solana:devnet"], features: ["solana:signMessage", "solana:signTransaction"] };
  let signedWith = "";
  const wallet: StandardWallet = {
    name: "Connect-only wallet", accounts: [], chains: ["solana:devnet"],
    features: {
      "standard:connect": { connect: async () => ({ accounts: [account] }) },
      "solana:signMessage": { signMessage: async (input: { account: { address: string }; message: Uint8Array }) => {
        signedWith = input.account.address;
        return [{ signedMessage: input.message, signature: new Uint8Array(64), signatureType: "ed25519" }];
      } },
      "solana:signTransaction": { signTransaction: async () => [], supportedTransactionVersions: ["legacy"] },
    },
  };
  const connected = await connectStandardWallet(wallet);
  expect(connected.account).toBe(account);
  expect(supportsDevnetSigning(wallet, account.address)).toBe(false);
  expect(supportsDevnetSigning(wallet, account.address, connected.account)).toBe(true);
  expect(await signWalletMessage(wallet, account.address, "control", connected.account)).toHaveLength(88);
  expect(signedWith).toBe("connected-account");
});

it("does not use a stale account when connect returns no authorized accounts", async () => {
  await expect(connectStandardWallet({
    name: "Disconnected wallet",
    accounts: [{ address: "old-account" }],
    features: { "standard:connect": { connect: async () => ({ accounts: [] }) } },
  })).rejects.toThrow(/address/);
});
