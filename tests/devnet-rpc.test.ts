import { afterEach, expect, it, vi } from "vitest";
import { DEVNET_GENESIS_HASH, DEVNET_RPC, MAINNET_GENESIS_HASH, resetDevnetEndpointCheck, rpc, recentBlockhash, sendSigned } from "../merchant/rpc";
import { requestDevnetCheckout } from "../src/lib/devnet-merchant-client";
import { buildPaymentTransaction } from "../merchant/transaction";
import { generateSolanaKey } from "../merchant/keys";
import { CIRCLE_SOLANA_DEVNET_USDC_MINT } from "../merchant/product";

it("refuses an expired blockhash before broadcast", async () => {
  resetDevnetEndpointCheck();
  const key = () => generateSolanaKey().address;
  const transaction = buildPaymentTransaction({ buyer: key(), sourceTokenAccount: key(), destinationTokenAccount: key(),
    mint: CIRCLE_SOLANA_DEVNET_USDC_MINT, reference: key(), amount: 1_000_000n, decimals: 6,
    memo: "checkout", blockhash: key() }).transaction;
  const methods: string[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    const method = JSON.parse(String(init?.body)).method as string;
    methods.push(method);
    return Response.json({ result: method === "getGenesisHash" ? DEVNET_GENESIS_HASH : { value: false } });
  };
  await expect(sendSigned(transaction, fetcher)).rejects.toThrow(/blockhash expired/);
  expect(methods).toEqual(["getGenesisHash", "isBlockhashValid"]);
});

const RPC_ENV = ["SOLANA_RPC_URL", "SOLANA_DEVNET_RPC_URL"] as const;
const SAVED_RPC_ENV = Object.fromEntries(RPC_ENV.map((key) => [key, process.env[key]]));

it("reconciles an already processed payment only after successful confirmation", async () => {
  resetDevnetEndpointCheck();
  const key = () => generateSolanaKey().address;
  const transaction = buildPaymentTransaction({ buyer: key(), sourceTokenAccount: key(), destinationTokenAccount: key(),
    mint: CIRCLE_SOLANA_DEVNET_USDC_MINT, reference: key(), amount: 1_000_000n, decimals: 6,
    memo: "checkout", blockhash: key() }).transaction;
  transaction[1] = 1;
  let confirmed = true;
  const fetcher: typeof fetch = async (_url, init) => {
    const method = JSON.parse(String(init?.body)).method;
    if (method === "getGenesisHash") return Response.json({ result: DEVNET_GENESIS_HASH });
    if (method === "isBlockhashValid") return Response.json({ result: { value: true } });
    if (method === "sendTransaction") return Response.json({ error: { message: "Transaction simulation failed: This transaction has already been processed" } });
    return Response.json({ result: { value: [confirmed ? { err: null, confirmationStatus: "finalized" } : null] } });
  };
  expect(await sendSigned(transaction, fetcher)).toBeTruthy();
  confirmed = false;
  await expect(sendSigned(transaction, fetcher)).rejects.toThrow(/confirmation is pending/);
});

afterEach(() => {
  vi.useRealTimers();
  for (const key of RPC_ENV) {
    const saved = SAVED_RPC_ENV[key];
    if (saved === undefined) delete process.env[key];
    else process.env[key] = saved;
  }
  resetDevnetEndpointCheck();
});

it("retries a rate-limited read with a bounded delay", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ error: { message: "Connection rate limits exceeded" } }, { status: 429 }))
    .mockResolvedValueOnce(Response.json({ result: "blockhash" }));
  const result = rpc<string>("getLatestBlockhash", [], fetcher);
  await vi.runAllTimersAsync();
  expect(await result).toBe("blockhash");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("never retries a payment broadcast", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: { message: "Connection rate limits exceeded" } }, { status: 429 }));
  await expect(rpc("sendTransaction", [], fetcher)).rejects.toThrow(/rate limits/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("explains a merchant checkout rate limit without exposing arbitrary error contents", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: "Connection rate limits exceeded" }, { status: 400 }));
  await expect(requestDevnetCheckout("http://127.0.0.1:8787", { buyer: "buyer", sourceTokenAccount: "account", quantity: 1 }, fetcher))
    .rejects.toThrow(/Solana devnet is rate limiting/);
  const secret = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: "payer seed secret-value" }, { status: 400 }));
  await expect(requestDevnetCheckout("http://127.0.0.1:8787", { buyer: "buyer", sourceTokenAccount: "account", quantity: 1 }, secret))
    .rejects.toThrow(/^The devnet merchant did not open a checkout\.$/);
});

it("uses a dedicated devnet URL and never the mainnet shopping RPC", async () => {
  process.env.SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com/?api-key=mainnet-secret";
  delete process.env.SOLANA_DEVNET_RPC_URL;
  let seen = "";
  await rpc("getHealth", [], async (url) => {
    seen = String(url);
    return Response.json({ result: "ok" });
  });
  expect(seen).toBe(DEVNET_RPC);
  expect(seen).not.toContain("mainnet-secret");

  process.env.SOLANA_DEVNET_RPC_URL = "https://user:secret-value@devnet.example.test/rpc";
  await expect(rpc("getHealth", [], async () => Response.json({ result: "ok" }))).rejects.toThrow(/embedded credentials/);
  await expect(rpc("getHealth", [], async () => Response.json({ result: "ok" }))).rejects.not.toThrow(/secret-value/);
});

it("verifies devnet genesis before a read and refuses mainnet without sending a payment", async () => {
  process.env.SOLANA_DEVNET_RPC_URL = "https://devnet.example.test/rpc?api-key=secret-value";
  const methods: string[] = [];
  const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
    methods.push(JSON.parse(String(init?.body)).method as string);
    return Response.json({ result: methods.at(-1) === "getGenesisHash" ? MAINNET_GENESIS_HASH : "blockhash" });
  });
  const refusal = recentBlockhash(fetcher);
  await expect(refusal).rejects.toThrow(/Solana mainnet/);
  await expect(refusal).rejects.not.toThrow(/secret-value/);
  expect(methods).toEqual(["getGenesisHash"]);
  const broadcast = sendSigned(Uint8Array.of(1), fetcher);
  await expect(broadcast).rejects.toThrow(/Solana mainnet/);
  await expect(broadcast).rejects.not.toThrow(/secret-value/);
  expect(methods).toEqual(["getGenesisHash", "getGenesisHash"]);

  resetDevnetEndpointCheck();
  methods.length = 0;
  fetcher.mockImplementation(async (_url, init) => {
    const method = JSON.parse(String(init?.body)).method as string;
    methods.push(method);
    if (String(_url).includes("secret-value") && method === "getGenesisHash") return Response.json({ result: DEVNET_GENESIS_HASH });
    if (method === "getLatestBlockhash") return Response.json({ result: { value: { blockhash: "blockhash" } } });
    return Response.json({ result: "signature" });
  });
  expect(await recentBlockhash(fetcher)).toBe("blockhash");
  expect(await recentBlockhash(fetcher)).toBe("blockhash");
  expect(methods).toEqual(["getGenesisHash", "getLatestBlockhash", "getLatestBlockhash"]);
});
