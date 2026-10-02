import { expect, it } from "vitest";
import { connectStandardWallet, discoverStandardWallets, type StandardWallet } from "../src/lib/wallet-standard";

const wallet: StandardWallet = { name: "Late Solana wallet", accounts: [], features: {} };

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

it("does not use a stale account when connect returns no authorized accounts", async () => {
  await expect(connectStandardWallet({
    name: "Disconnected wallet",
    accounts: [{ address: "old-account" }],
    features: { "standard:connect": { connect: async () => ({ accounts: [] }) } },
  })).rejects.toThrow(/address/);
});
