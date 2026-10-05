/** Unsigned, server-only x402 preview. Never signs or sends a transaction. */
import { createHash } from "node:crypto";
import { associatedTokenAddress } from "../../merchant/ata";
import { compile, MEMO_PROGRAM } from "../../merchant/transaction";
import { TOKEN_PROGRAM } from "../../merchant/product";
import { bitcoinAnchorBuyUrl, EXPECTED_AMOUNT_ATOMIC, REVIEWED_FEE_PAYER, REVIEWED_MERCHANT_RECIPIENT, SOLANA_MAINNET_CAIP, termsAreCurrent, type SolanaExactTerms } from "./digital-purchase";
import { USDC_MINT } from "./tokens";
import { COMPUTE_BUDGET_PROGRAM } from "./conversion-review";

export function buildSponsoredPaymentPreview(input: {
  terms: SolanaExactTerms; wallet: string; attemptId: string;
  blockhash: string; nowMs: number;
}): { transaction: Uint8Array; message: Uint8Array; memo: string; shopperSignatureIndex: 1; sponsorSignatureIndex: 0 } {
  const { terms, wallet } = input;
  if (!termsAreCurrent(terms, input.nowMs)) throw new Error("The merchant quote expired.");
  if (terms.network !== SOLANA_MAINNET_CAIP || terms.mint !== USDC_MINT || terms.amountAtomic !== EXPECTED_AMOUNT_ATOMIC.toString()
    || terms.payTo !== REVIEWED_MERCHANT_RECIPIENT || terms.feePayer !== REVIEWED_FEE_PAYER
    || terms.resourceUrl !== bitcoinAnchorBuyUrl(terms.digest)) throw new Error("The payment terms changed.");
  if (!wallet || wallet === terms.feePayer || wallet === terms.payTo || !input.attemptId) throw new Error("The shopper must be distinct from the sponsor and recipient.");
  const memo = terms.memo ?? createHash("sha256").update(input.attemptId).digest("hex");
  const memoBytes = new TextEncoder().encode(memo);
  if (!memoBytes.length || memoBytes.length > 256) throw new Error("Invalid payment memo.");
  const source = associatedTokenAddress(wallet, terms.mint);
  const destination = associatedTokenAddress(terms.payTo, terms.mint);
  const transfer = new Uint8Array(10);
  transfer[0] = 12;
  new DataView(transfer.buffer).setBigUint64(1, EXPECTED_AMOUNT_ATOMIC, true);
  transfer[9] = 6;
  const units = new Uint8Array(5); units[0] = 2;
  new DataView(units.buffer).setUint32(1, 20_000, true);
  const price = new Uint8Array(9); price[0] = 3;
  // Zero requested priority fee; the sponsor may reject this policy. Not execution proof.
  const built = compile({ blockhash: input.blockhash,
    accounts: [
      { address: terms.feePayer, signer: true, writable: true },
      { address: wallet, signer: true, writable: false },
      { address: source, signer: false, writable: true },
      { address: destination, signer: false, writable: true },
      ...[terms.mint, TOKEN_PROGRAM, COMPUTE_BUDGET_PROGRAM, MEMO_PROGRAM].map(address => ({ address, signer: false, writable: false })),
    ],
    instructions: [
      { program: COMPUTE_BUDGET_PROGRAM, accounts: [], data: units },
      { program: COMPUTE_BUDGET_PROGRAM, accounts: [], data: price },
      { program: TOKEN_PROGRAM, accounts: [source, terms.mint, destination, wallet], data: transfer },
      { program: MEMO_PROGRAM, accounts: [], data: memoBytes },
    ],
  });
  // Version 0, no lookup tables. Both signature slots stay zero.
  const message = Uint8Array.from([128, ...built.message, 0]);
  const transaction = Uint8Array.from([2, ...new Uint8Array(128), ...message]);
  return { transaction, message, memo, shopperSignatureIndex: 1, sponsorSignatureIndex: 0 };
}
