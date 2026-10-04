import { associatedTokenAddress } from "./ata";
import { missingFunding } from "./funding";
import { normalizeChainTransaction } from "./normalize";
import { CIRCLE_SOLANA_DEVNET_USDC_MINT, DEVNET_USDC_DECIMALS, TEST_PRODUCT } from "./product";
import { DevnetMerchant } from "./service";
import { MerchantStore } from "./store";
import {
  buildCreateAssociatedTokenAccount,
  buildRefundTransaction,
  signPreparedTransaction,
  signTransaction,
  type BuiltTransaction,
} from "./transaction";
import type { SolanaKey } from "./keys";

const TOKEN_ACCOUNT_SPACE = 165;

export interface ChainRpc {
  getBalance(address: string): Promise<bigint>;
  tokenAccount(address: string): Promise<{ amount: bigint } | null>;
  rent(space: number): Promise<bigint>;
  blockhash(): Promise<string>;
  send(transaction: Uint8Array): Promise<string>;
  getTransaction(signature: string): Promise<unknown | null>;
  pause(): Promise<void>;
}

export type PurchaseRun =
  | { status: "blocked"; missing: "devnet SOL" | "Circle devnet USDC"; lamports: string; usdcMinor: string }
  | { status: "refunded"; orderId: string; paymentSignature: string; refundSignature: string; mint: string };

export async function executeDevnetPurchase(input: {
  payer: SolanaKey;
  merchantWallet: SolanaKey;
  now: number;
  rpc: ChainRpc;
}): Promise<PurchaseRun> {
  const source = associatedTokenAddress(input.payer.address, CIRCLE_SOLANA_DEVNET_USDC_MINT);
  const destination = associatedTokenAddress(input.merchantWallet.address, CIRCLE_SOLANA_DEVNET_USDC_MINT);
  const [lamports, sourceAccount, destinationAccount, rentLamports] = await Promise.all([
    input.rpc.getBalance(input.payer.address),
    input.rpc.tokenAccount(source),
    input.rpc.tokenAccount(destination),
    input.rpc.rent(TOKEN_ACCOUNT_SPACE),
  ]);
  const usdcMinor = sourceAccount?.amount ?? 0n;
  const missing = missingFunding({
    lamports,
    usdcMinor,
    rentLamports,
    missingTokenAccounts: Number(sourceAccount === null) + Number(destinationAccount === null),
  });
  if (missing) return { status: "blocked", missing, lamports: lamports.toString(), usdcMinor: usdcMinor.toString() };

  if (!sourceAccount) await createTokenAccount(input, source, input.payer.address);
  if (!destinationAccount) await createTokenAccount(input, destination, input.merchantWallet.address);

  const store = new MerchantStore();
  const merchant = new DevnetMerchant(
    store,
    input.merchantWallet.address,
    destination,
    async (signature) => normalizeChainTransaction(await input.rpc.getTransaction(signature)),
    () => input.rpc.blockhash(),
  );
  const checkout = await merchant.createCheckout({
    buyer: input.payer.address,
    sourceTokenAccount: source,
    quantity: TEST_PRODUCT.quantity,
    now: input.now,
  });
  const paymentSignature = await input.rpc.send(signPreparedTransaction(checkout.transaction, input.payer));
  await confirmed(input.rpc, paymentSignature);
  const paid = await merchant.confirm(checkout.id, paymentSignature, input.now);
  if (paid.kind !== "order") throw new Error(`Devnet payment did not become an order (${paid.kind}).`);

  const stored = store.checkouts.get(checkout.id);
  if (!stored) throw new Error("Checkout disappeared before refund.");
  const blockhash = await input.rpc.blockhash();
  const refund = buildRefundTransaction({
    feePayer: input.payer.address,
    merchant: input.merchantWallet.address,
    sourceTokenAccount: destination,
    destinationTokenAccount: source,
    mint: CIRCLE_SOLANA_DEVNET_USDC_MINT,
    reference: stored.refundReference,
    amount: stored.totalMinor,
    decimals: DEVNET_USDC_DECIMALS,
    memo: paid.order.id,
    blockhash,
  });
  const refundSignature = await input.rpc.send(signTransaction(refund, [input.payer, input.merchantWallet]));
  await confirmed(input.rpc, refundSignature);
  const refunded = await merchant.refund(paid.order.id, refundSignature);
  return {
    status: "refunded",
    orderId: refunded.id,
    paymentSignature,
    refundSignature,
    mint: CIRCLE_SOLANA_DEVNET_USDC_MINT,
  };
}

async function createTokenAccount(input: { payer: SolanaKey; rpc: ChainRpc }, associated: string, owner: string): Promise<void> {
  const built: BuiltTransaction = buildCreateAssociatedTokenAccount({
    payer: input.payer.address,
    associated,
    owner,
    mint: CIRCLE_SOLANA_DEVNET_USDC_MINT,
    blockhash: await input.rpc.blockhash(),
  });
  const signature = await input.rpc.send(signTransaction(built, [input.payer]));
  await confirmed(input.rpc, signature);
}

async function confirmed(rpc: ChainRpc, signature: string): Promise<void> {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const tx = normalizeChainTransaction(await rpc.getTransaction(signature));
    if (tx?.meta && !tx.meta.err) return;
    if (tx?.meta?.err) throw new Error("Devnet transaction failed.");
    await rpc.pause();
  }
  throw new Error("Devnet transaction was not confirmed.");
}
