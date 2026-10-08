import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
import {
  androidWalletRegistration,
  classifyWalletFailure,
  clearShoppingSessionId,
  isAndroidShell,
  readShoppingSessionId,
  SHOPPING_SESSION_KEY,
  walletFailureMessage,
  writeShoppingSessionId,
  type StorageLike,
} from "../src/lib/android-shell";

function memory(): StorageLike & { dump(): Map<string, string> } {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
    dump: () => data,
  };
}

it("restores a shopping session from local storage after session storage is empty", () => {
  const session = memory();
  const local = memory();
  writeShoppingSessionId(session, local, "session-1");
  session.removeItem(SHOPPING_SESSION_KEY);
  expect(readShoppingSessionId(session, local)).toBe("session-1");
  clearShoppingSessionId(session, local);
  expect(readShoppingSessionId(session, local)).toBeNull();
});

it("keeps the shell session mirror in both stores", () => {
  const session = memory();
  const local = memory();
  local.setItem(SHOPPING_SESSION_KEY, "kept");
  runInNewContext(readFileSync("android/app/src/main/assets/session-mirror.js", "utf8"), {
    sessionStorage: session,
    localStorage: local,
  });
  expect(session.getItem(SHOPPING_SESSION_KEY)).toBe("kept");
  session.setItem(SHOPPING_SESSION_KEY, "next");
  expect(local.getItem(SHOPPING_SESSION_KEY)).toBe("next");
  session.removeItem(SHOPPING_SESSION_KEY);
  expect(local.getItem(SHOPPING_SESSION_KEY)).toBeNull();
});

it("recognizes the Android shell and describes wallet cancellation without a send", () => {
  expect(isAndroidShell("Mozilla/5.0 Solana Mobile Web Shell")).toBe(true);
  expect(isAndroidShell("Mozilla/5.0")).toBe(false);
  expect(classifyWalletFailure(new Error("User rejected the request"))).toBe("cancelled");
  expect(walletFailureMessage("cancelled")).toMatch(/Nothing was signed or sent/);
  expect(classifyWalletFailure(new Error("ERROR_WALLET_NOT_FOUND"))).toBe("unavailable");
  expect(walletFailureMessage("failed")).toMatch(/Nothing was signed or sent/);
});

it("uses SuperTab's https identity and does not request a send", () => {
  expect(androidWalletRegistration("https://supertab-main.vercel.app/shop")).toEqual({
    appIdentity: { name: "SuperTab", uri: "https://supertab-main.vercel.app", icon: "favicon.ico" },
    chains: ["solana:mainnet", "solana:devnet"],
  });
  expect(() => androidWalletRegistration("http://10.0.2.2:3000")).toThrow(/https/);
  const source = [
    readFileSync("src/lib/mobile-wallet.ts", "utf8"),
    readFileSync("src/lib/mwa-bootstrap.ts", "utf8"),
    readFileSync("src/components/shop-app.tsx", "utf8"),
  ].join("\n");
  expect(source).not.toContain("signAndSendTransaction");
});

it("keeps SuperTab's application id and hosted origin out of the Sudoku shell", () => {
  const properties = readFileSync("android/gradle.properties", "utf8");
  expect(properties).toContain("SUPERTAB_APPLICATION_ID=app.supertab.shop");
  expect(properties).toContain("SUPERTAB_MOBILE_URL=https://supertab-main.vercel.app/");
  expect(properties).not.toMatch(/APPLICATION_ID=.*sudoku/i);
  expect(properties).not.toMatch(/MOBILE_URL=.*sudoku/i);
  const signing = readFileSync("android/app/build.gradle.kts", "utf8");
  expect(signing).toContain("SUPERTAB_KEYSTORE_PATH");
  expect(signing).not.toContain("SOLANA_MOBILE_KEYSTORE");
});
