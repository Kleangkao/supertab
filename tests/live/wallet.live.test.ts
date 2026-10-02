import { describe, expect, it } from "vitest";
import { USDC_MINT } from "../../src/lib/tokens";
import { createReadOnlyWallet } from "../../src/lib/wallet";

const live = process.env.SUPERTAB_LIVE === "1";

/** Public address cited in Solana docs. Read-only. No key is involved. */
const PUBLIC_ADDRESS = "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg";

describe.skipIf(!live)("live Solana balance read", () => {
  it("reads SOL and token accounts and refuses to sign", async () => {
    const wallet = createReadOnlyWallet({
      rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
      customRpc: Boolean(process.env.SOLANA_RPC_URL),
      timeoutMs: 20_000,
    });
    const balances = await wallet.getBalances(PUBLIC_ADDRESS);
    const sol = balances.find((asset) => asset.kind === "native");
    const usdc = balances.find((asset) => asset.isUsdc);
    expect(wallet.getAddress()).toBeNull();
    expect(wallet.prepareTransaction().status).toBe("disabled");
    expect(wallet.requestSignature().status).toBe("disabled");
    expect(sol?.amount).toBeGreaterThan(0n);
    expect(sol?.decimals).toBe(9);
    expect(usdc?.mint).toBe(USDC_MINT);
    expect(usdc?.decimals).toBe(6);
    for (const asset of balances) {
      expect(typeof asset.amount).toBe("bigint");
    }
  });
});
