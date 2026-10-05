import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps the actual connect handler free of control challenges and signatures", () => {
  const source = readFileSync(new URL("../src/components/shop-app.tsx", import.meta.url), "utf8");
  const handler = source.split("async function connectWallet(")[1].split("async function checkWalletControl(")[0];
  expect(handler).not.toContain('fetch("/api/wallet/control"');
  expect(handler).not.toContain("signWalletMessage(");
  expect(source).not.toContain("sign a control message before you shop");
});
