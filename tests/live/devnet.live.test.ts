import { expect, it } from "vitest";
import { prepareDevnetCheck } from "../../src/lib/devnet-signing";
import { checkMemoBytes } from "../../src/lib/devnet-memo";

it.skipIf(process.env.SUPERTAB_LIVE !== "1")("devnet parses the prepared memo and reports its fee without signing or broadcasting", async () => {
  const check = await prepareDevnetCheck({ address: "JCVsKd4TMg1fvEs7rjf5YgLYbJfNC8Dwb4x1PchFkGM7", termsId: "live-format-check",
    origin: "http://127.0.0.1:3000", now: () => Date.now() });
  const bytes = Buffer.from(check.transaction, "base64");
  checkMemoBytes(check, bytes, false);
  const response = await fetch("https://api.devnet.solana.com", {
    method: "POST", redirect: "error", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getFeeForMessage", params: [bytes.subarray(65).toString("base64"), { commitment: "confirmed" }] }),
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.json() as { error?: unknown; result?: { value?: number | null } };
  expect(response.ok).toBe(true); expect(body.error).toBeUndefined();
  expect(body.result?.value).toBeTypeOf("number");
  expect(body.result!.value).toBeGreaterThan(0);
});
