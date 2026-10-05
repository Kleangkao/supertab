import { expect, it } from "vitest";
import { buildSponsoredPaymentPreview } from "../src/lib/sponsored-payment";
import { bitcoinAnchorBuyUrl, parseSolanaExactTerms, REVIEWED_FEE_PAYER, REVIEWED_MERCHANT_RECIPIENT, SOLANA_MAINNET_CAIP, type SolanaExactTerms } from "../src/lib/digital-purchase";
import { USDC_MINT } from "../src/lib/tokens";
import { encodeBase58 } from "../src/lib/base58";
import { associatedTokenAddress } from "../merchant/ata";

const now = Date.parse("2026-10-06T01:00:00Z");
const wallet = "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg";
const terms = parseSolanaExactTerms({ x402Version: 2, resource: { url: bitcoinAnchorBuyUrl() }, accepts: [{
  scheme: "exact", network: SOLANA_MAINNET_CAIP, asset: USDC_MINT, amount: "1000000", payTo: REVIEWED_MERCHANT_RECIPIENT,
  maxTimeoutSeconds: 300, extra: { feePayer: REVIEWED_FEE_PAYER, quotedAt: "2026-10-06T01:00:00Z", memo: "merchant-invoice-fixture" },
}] }, now);
const input = { terms, wallet, attemptId: "fixture-attempt", blockhash: "11111111111111111111111111111111", nowMs: now };

it("encodes a zero-signature v0 payment with isolated sponsor and exact TransferChecked", () => {
  const built = buildSponsoredPaymentPreview(input);
  expect(built.transaction[0]).toBe(2);
  expect([...built.transaction.slice(1, 129)].every(byte => byte === 0)).toBe(true);
  const message = built.message;
  expect([...message.slice(0, 4)]).toEqual([128, 2, 1, 4]);
  const count = message[4];
  const keys = Array.from({ length: count }, (_, i) => encodeBase58(message.slice(5 + i * 32, 37 + i * 32)));
  expect(keys[0]).toBe(REVIEWED_FEE_PAYER);
  expect(keys[1]).toBe(wallet);
  let offset = 5 + count * 32 + 32;
  const instructionCount = message[offset++];
  const instructions = Array.from({ length: instructionCount }, () => {
    const program = keys[message[offset++]];
    const accountsLength = message[offset++];
    const accounts = [...message.slice(offset, offset += accountsLength)].map(i => keys[i]);
    const dataLength = message[offset++];
    const data = message.slice(offset, offset += dataLength);
    return { program, accounts, data };
  });
  expect(instructions).toHaveLength(4);
  expect(instructions.flatMap(i => i.accounts)).not.toContain(REVIEWED_FEE_PAYER);
  expect(instructions[2].accounts).toEqual([associatedTokenAddress(wallet, USDC_MINT), USDC_MINT, associatedTokenAddress(REVIEWED_MERCHANT_RECIPIENT, USDC_MINT), wallet]);
  expect(instructions[2].data[0]).toBe(12);
  expect(new DataView(instructions[2].data.buffer, instructions[2].data.byteOffset).getBigUint64(1, true)).toBe(1_000_000n);
  expect(instructions[2].data[9]).toBe(6);
  expect(new TextDecoder().decode(instructions[3].data)).toBe(terms.memo);
  expect(message[offset]).toBe(0);
  expect(built.shopperSignatureIndex).toBe(1);
});
it("refuses stale or altered terms, sponsor-as-shopper, and oversized memos", () => {
  expect(() => buildSponsoredPaymentPreview({ ...input, nowMs: now + 300_000 })).toThrow(/expired/);
  for (const change of [{ amountAtomic: "2000000" }, { feePayer: wallet }, { payTo: wallet }, { mint: wallet }]) {
    expect(() => buildSponsoredPaymentPreview({ ...input, terms: { ...terms, ...change } as SolanaExactTerms })).toThrow(/changed/);
  }
  expect(() => buildSponsoredPaymentPreview({ ...input, wallet: REVIEWED_FEE_PAYER })).toThrow(/distinct/);
  expect(() => buildSponsoredPaymentPreview({ ...input, terms: { ...terms, memo: "x".repeat(257) } })).toThrow(/memo/);
});
