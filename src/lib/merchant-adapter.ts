/** Merchant payment stays an x402 PAYMENT-SIGNATURE. SuperTab does not broadcast it. */
import { associatedTokenAddress } from "../../merchant/ata";
import { MEMO_PROGRAM } from "../../merchant/transaction";
import { TOKEN_PROGRAM } from "../../merchant/product";
import { encodeBase58 } from "./base58";
import { COMPUTE_BUDGET_PROGRAM } from "./conversion-review";
import {
  bitcoinAnchorBuyUrl,
  BITCOIN_ANCHOR_PRODUCT,
  BITCOIN_ANCHOR_PREIMAGE,
  EXPECTED_AMOUNT_ATOMIC,
  SOLANA_MAINNET_CAIP,
  type SolanaExactTerms,
} from "./digital-purchase";
import { assertSignedMessage, type BoundTerms, type SettlementProof } from "./purchase-workflow";
import { USDC_MINT } from "./tokens";

const STORE_ORIGIN = "https://scvd.store";

export function exactTermsFromApproval(terms: BoundTerms, memo: string, nowMs: number): SolanaExactTerms {
  const expiresMs = Date.parse(terms.merchantExpiresAt);
  const maxTimeoutSeconds = Math.max(1, Math.round((expiresMs - nowMs) / 1000));
  return {
    ...BITCOIN_ANCHOR_PRODUCT,
    preimage: BITCOIN_ANCHOR_PREIMAGE,
    digest: terms.digest,
    resourceUrl: bitcoinAnchorBuyUrl(terms.digest),
    scheme: "exact",
    network: SOLANA_MAINNET_CAIP,
    mint: USDC_MINT,
    amountAtomic: terms.amountAtomic,
    amountDisplay: "1.000000 USDC",
    payTo: terms.recipient,
    feePayer: terms.sponsor,
    memo,
    shopperPaysNetworkFee: false,
    quotedAt: new Date(nowMs).toISOString(),
    expiresAt: terms.merchantExpiresAt,
    maxTimeoutSeconds,
    execution: "disabled",
    signing: "unavailable",
    broadcast: "unavailable",
  };
}

export function paymentAuthorization(input: { terms: SolanaExactTerms; signedTransaction: Uint8Array }): string {
  return JSON.stringify({
    x402Version: 2,
    resource: {
      url: input.terms.resourceUrl,
      description: input.terms.productName,
      mimeType: "application/json",
    },
    accepted: {
      scheme: "exact",
      network: input.terms.network,
      amount: input.terms.amountAtomic,
      asset: input.terms.mint,
      payTo: input.terms.payTo,
      maxTimeoutSeconds: input.terms.maxTimeoutSeconds,
      extra: {
        feePayer: input.terms.feePayer,
        ...(input.terms.memo ? { memo: input.terms.memo } : {}),
      },
    },
    payload: { transaction: Buffer.from(input.signedTransaction).toString("base64") },
  });
}

export function paymentSignatureHeader(authorization: string): string {
  return Buffer.from(authorization, "utf8").toString("base64");
}

export function assertSponsoredPayment(input: {
  signed: Uint8Array;
  retainedMessage: Uint8Array;
  shopper: string;
  recipient: string;
  sponsor: string;
}): void {
  assertSignedMessage({
    signedTransaction: input.signed,
    retainedMessage: input.retainedMessage,
    shopper: input.shopper,
    shopperSlot: 1,
    sponsorMustBeAbsent: true,
  });
  const message = input.signed.subarray(1 + input.signed[0]! * 64);
  if (message[0] !== 128) throw new Error("The merchant payment is not the reviewed versioned transaction.");
  const required = message[1] ?? 0;
  if (required !== 2) throw new Error("The merchant payment does not have the shopper and sponsor signature slots.");
  const accounts = message[4] ?? 0;
  const keys = Array.from({ length: accounts }, (_, index) => encodeBase58(message.subarray(5 + index * 32, 37 + index * 32)));
  if (keys[0] !== input.sponsor || keys[1] !== input.shopper) throw new Error("The merchant payment signers are not the approved sponsor and shopper.");
  let offset = 5 + accounts * 32 + 32;
  const instructionCount = message[offset++] ?? 0;
  const instructions = Array.from({ length: instructionCount }, () => {
    const program = keys[message[offset++] ?? 0];
    const accountCount = message[offset++] ?? 0;
    const accountIndexes = [...message.subarray(offset, offset + accountCount)];
    offset += accountCount;
    const dataLength = message[offset++] ?? 0;
    const data = message.subarray(offset, offset + dataLength);
    offset += dataLength;
    return { program, accounts: accountIndexes.map((index) => keys[index] ?? ""), data };
  });
  if (instructions.some((instruction) => instruction.accounts.includes(input.sponsor))) {
    throw new Error("The sponsor is an instruction account.");
  }
  const transfer = instructions.find((instruction) => instruction.program === TOKEN_PROGRAM && instruction.data[0] === 12);
  if (!transfer || transfer.data.length !== 10) throw new Error("The merchant payment is not one exact transfer.");
  const amount = new DataView(transfer.data.buffer, transfer.data.byteOffset, transfer.data.byteLength).getBigUint64(1, true);
  if (amount !== EXPECTED_AMOUNT_ATOMIC || transfer.data[9] !== 6) throw new Error("The transfer is not exactly 1.000000 USDC.");
  const source = associatedTokenAddress(input.shopper, USDC_MINT);
  const destination = associatedTokenAddress(input.recipient, USDC_MINT);
  if (transfer.accounts[0] !== source || transfer.accounts[1] !== USDC_MINT || transfer.accounts[2] !== destination || transfer.accounts[3] !== input.shopper) {
    throw new Error("The transfer accounts do not match this wallet, mint, and recipient.");
  }
  if (!instructions.every((instruction) => instruction.program === COMPUTE_BUDGET_PROGRAM || instruction.program === TOKEN_PROGRAM || instruction.program === MEMO_PROGRAM)) {
    throw new Error("The merchant payment includes an unexpected instruction.");
  }
}

export function publishedSigningKeys(document: unknown): string[] {
  if (!document || typeof document !== "object") return [];
  const body = document as { public_key?: unknown; key_history?: { retired?: unknown } };
  const keys = [body.public_key, ...retiredKeys(body.key_history?.retired)];
  return keys.filter((key): key is string => typeof key === "string" && /^[0-9a-f]{64}$/i.test(key));
}

function retiredKeys(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => entry && typeof entry === "object" ? (entry as { public_key?: unknown }).public_key : null);
}

export function certificateProof(existence: unknown): "pending" | "confirmed" | "unavailable" {
  if (!existence || typeof existence !== "object") return "pending";
  const body = existence as { status?: unknown; existed_by?: { block_height?: unknown }; key_window?: unknown };
  if (body.key_window === "bound_after_retirement" || body.status === "failed") return "unavailable";
  if (body.status === "bounded" && typeof body.existed_by?.block_height === "number" && body.existed_by.block_height > 0) return "confirmed";
  if (body.status === "pending" || body.status === "none" || body.status == null) return "pending";
  return "unavailable";
}

export function parseVerifyBody(body: unknown): {
  certId: string;
  signedPayload: string;
  signatureHex: string;
  publicKeyHex: string;
  proof: "pending" | "confirmed" | "unavailable";
} | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const certificate = record.certificate && typeof record.certificate === "object" ? record.certificate as { cert_id?: unknown } : {};
  const certId = typeof certificate.cert_id === "string" ? certificate.cert_id : "";
  if (!/^cert_[A-Za-z0-9]+$/.test(certId)) return null;
  if (record.algorithm !== "ed25519") return null;
  if (typeof record.signed_payload !== "string" || typeof record.signature !== "string" || typeof record.public_key !== "string") return null;
  return {
    certId,
    signedPayload: record.signed_payload,
    signatureHex: record.signature,
    publicKeyHex: record.public_key,
    proof: certificateProof(record.existence),
  };
}

export function parseDelivery(bodyText: string, paymentResponseHeader: string | null): {
  certId: string | null;
  statusUrl: string | null;
  statusToken: string | null;
  settlementTx: string | null;
  network: string | null;
} {
  let body: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch { /* The raw text is still retained by the caller. */ }
  const certificate = body.certificate && typeof body.certificate === "object" ? body.certificate as { cert_id?: unknown } : {};
  const recovery = body.recovery && typeof body.recovery === "object" ? body.recovery as Record<string, unknown> : {};
  const certId = typeof certificate.cert_id === "string" ? certificate.cert_id : certIdFromUrl(typeof body.verify_url === "string" ? body.verify_url : null);
  const purchaseId = text(body.purchase_id) ?? text(recovery.purchase_id);
  const statusUrl = safeStatusUrl(text(body.status_url) ?? text(recovery.status_url), purchaseId);
  const statusToken = text(body.status_token) ?? text(recovery.status_token);
  const header = parsePaymentResponse(paymentResponseHeader);
  return { certId, statusUrl, statusToken, settlementTx: header.transaction, network: header.network };
}

export function settlementFromParsedTransaction(signature: string, value: unknown, terms: BoundTerms): SettlementProof | null {
  if (!value || typeof value !== "object") return null;
  const meta = (value as { meta?: { err?: unknown; preTokenBalances?: unknown; postTokenBalances?: unknown } }).meta;
  if (!meta || meta.err != null || !Array.isArray(meta.preTokenBalances) || !Array.isArray(meta.postTokenBalances)) return null;
  const before = balanceFor(meta.preTokenBalances, terms.wallet) ;
  const after = balanceFor(meta.postTokenBalances, terms.wallet);
  const merchantBefore = balanceFor(meta.preTokenBalances, terms.recipient);
  const merchantAfter = balanceFor(meta.postTokenBalances, terms.recipient);
  if (before == null || after == null || merchantBefore == null || merchantAfter == null) return null;
  const spent = before - after;
  const received = merchantAfter - merchantBefore;
  if (spent !== EXPECTED_AMOUNT_ATOMIC || received !== EXPECTED_AMOUNT_ATOMIC) return null;
  return {
    signature,
    err: null,
    amountAtomic: EXPECTED_AMOUNT_ATOMIC.toString(),
    mint: USDC_MINT,
    destinationOwner: terms.recipient,
    sourceOwner: terms.wallet,
  };
}

export function safeStatusUrl(url: string | null, purchaseId: string | null): string | null {
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.origin !== STORE_ORIGIN || !parsed.pathname.startsWith("/api/purchase-status/")) return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }
  if (purchaseId && /^[A-Za-z0-9_-]{8,80}$/.test(purchaseId)) return `${STORE_ORIGIN}/api/purchase-status/${purchaseId}`;
  return null;
}

function certIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const certId = parsed.pathname.split("/").at(-1) ?? "";
    return parsed.origin === STORE_ORIGIN && /^cert_[A-Za-z0-9]+$/.test(certId) ? certId : null;
  } catch {
    return null;
  }
}

function parsePaymentResponse(header: string | null): { transaction: string | null; network: string | null } {
  if (!header) return { transaction: null, network: null };
  try {
    const json = Buffer.from(header, "base64").toString("utf8");
    const parsed = JSON.parse(json) as { transaction?: unknown; network?: unknown };
    return {
      transaction: typeof parsed.transaction === "string" ? parsed.transaction : null,
      network: typeof parsed.network === "string" ? parsed.network : null,
    };
  } catch {
    return { transaction: null, network: null };
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function balanceFor(entries: unknown[], owner: string): bigint | null {
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { owner?: unknown; mint?: unknown; uiTokenAmount?: { amount?: unknown } };
    if (row.owner !== owner || row.mint !== USDC_MINT) continue;
    if (typeof row.uiTokenAmount?.amount !== "string" || !/^\d+$/.test(row.uiTokenAmount.amount)) return null;
    return BigInt(row.uiTokenAmount.amount);
  }
  return null;
}
