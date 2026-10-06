import type { AppConfig } from "./config";
import {
  attemptIdempotencyKey,
  bitcoinAnchorBuyUrl,
  bitcoinAnchorDigest,
  BITCOIN_ANCHOR_PREIMAGE,
  compareSolCap,
  conversionInputForMinimum,
  DigitalPurchaseError,
  EXPECTED_AMOUNT_ATOMIC,
  merchantUsdcAccount,
  parseSolanaExactTerms,
  PREVIOUS_SOL_CAP_LAMPORTS,
  REVIEWED_MERCHANT_RECIPIENT,
  solSpendCap,
  termsAreCurrent,
  usdcGap,
  type SolanaExactTerms,
} from "./digital-purchase";
import {
  decodeTransaction,
  parseDisclosedLookupTables,
  validateConversionTransaction,
} from "./conversion-review";
import { fetchConversionOrder, DflowRouteError, QUOTE_FRESHNESS_MS, type DflowQuote } from "./dflow";
import { formatFixedMinor } from "./money";
import { DEFAULT_SOL_RESERVE_LAMPORTS, NATIVE_SOL_MINT, USDC_DECIMALS, USDC_MINT, WSOL_MINT } from "./tokens";
import { mainnetExecutionGate } from "./purchase-workflow";
import { isPlausibleAddress, MAINNET_GENESIS_HASH, readSolanaBalances } from "./wallet";

const PROBE_LAMPORTS = 10_000_000n;

export interface PreparedDigitalPurchase {
  paymentPreview?: {
    status: "built_unsigned";
    version: "v0";
    signatureSlots: 2;
    signaturesPresent: 0;
    memo: string;
    lastValidBlockHeight: number;
    detail: string;
  };
  label: "Prepared digital purchase — not paid";
  execution: "disabled";
  signing: "unavailable";
  broadcast: "unavailable";
  orderCreated: false;
  executionReady: false;
  stages: {
    quote: "checked";
    simulation: "not_run";
    signing: "unavailable";
    execution: "disabled";
    delivery: "not_started";
  };
  terms: SolanaExactTerms;
  termsCurrent: boolean;
  payload: {
    preimage: typeof BITCOIN_ANCHOR_PREIMAGE;
    digest: string;
    submitted: "The sha256 digest only. The preimage is not sent.";
    retained: "The store says it keeps the order, the certificate, and the digest. It says it never sees the preimage.";
    returned: "A signed certificate, a patron number, a badge URL, a verify URL, and a proof URL.";
    anchoring: "The certificate can arrive while the OpenTimestamps proof is still pending. Bitcoin confirmation is a later upgrade, not the purchase response.";
  };
  delivery: {
    method: "Digital timestamp service. Not a shipped product and not a Thailand delivery.";
    thailand: "No country restriction is named. This test does not prove shipping to Thailand.";
    orderRead: "A later certificate proves this purchase only when its signed bytes contain bitcoin_anchor, this digest, 1 USDC, the mainnet USDC mint, Solana mainnet, this wallet, and the settlement transaction. Another valid certificate does not.";
    refund: "The store says a failed instant delivery takes no money. A settled payment with no certificate is a defect handled by hand. Nothing here refunds automatically, and this review does not send a letter.";
    recovery: "A caller-supplied Idempotency-Key is documented for 24 hours with the same item, payer, and original payment. This review stores the key and does not store a payment. Listing a lost purchase needs a disabled wallet-message claim.";
  };
  accounts: {
    buyerUsdc: "present" | "missing" | "not_read";
    merchantUsdc: "present" | "missing";
  };
  wallet: {
    status: "read" | "not_read";
    source: "connected" | "read_only" | "not_selected";
    address: string | null;
    network: "solana:mainnet" | null;
    usdcAtomic: string | null;
    usdcDisplay: string | null;
    solLamports: string | null;
    solDisplay: string | null;
  };
  conversion: {
    status: "skipped" | "quoted" | "short" | "not_read";
    inputLamports: string | null;
    inputDisplay: string | null;
    minimumUsdcAtomic: string | null;
    minimumUsdcDisplay: string | null;
    estimatedUsdcDisplay: string | null;
    slippageBps: number | null;
    prioritizationFeeLamports: string | null;
    quotedAt: string | null;
    expiresAt: string | null;
    validation: "checked" | "rejected" | "not_prepared";
    detail: string;
  };
  spend: {
    bounded: boolean;
    merchantUsdcAtomic: string;
    merchantUsdcDisplay: string;
    shopperNetworkFee: "paid by the quoted fee payer" | "not the sponsored shape";
    solLamports: string | null;
    solDisplay: string | null;
    reserveLamports: string;
    previousComparisonLamports: string;
    exceedsPreviousComparison: boolean;
    unusedUsdc: string;
  };
  recovery: {
    executionReady: false;
    idempotencyKey: string | null;
    summary: string;
  };
  readyForApproval: boolean;
  blockers: string[];
  executionGate: "off" | "on";
}

export async function prepareBitcoinAnchorPurchase(input: {
  walletAddress?: string;
  walletSource?: "connected" | "read_only";
}, deps: {
  config: AppConfig;
  fetchImpl?: typeof fetch;
  now?: () => number;
  readBalances?: typeof readSolanaBalances;
}): Promise<PreparedDigitalPurchase> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const nowMs = deps.now?.() ?? Date.now();
  const digest = bitcoinAnchorDigest();
  const buyUrl = bitcoinAnchorBuyUrl(digest);
  const response = await fetchImpl(buyUrl, {
    method: "GET",
    redirect: "manual",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status !== 402) {
    throw new DigitalPurchaseError("The merchant did not return an unpaid quote.");
  }
  const encoded = response.headers.get("payment-required");
  if (!encoded) throw new DigitalPurchaseError("The merchant quote header was missing.");
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new DigitalPurchaseError("The merchant quote header was not readable.");
  }
  const terms = parseSolanaExactTerms(decoded, nowMs, digest);
  await assertMainnet(deps.config.solanaRpcUrl, fetchImpl);
  const price = BigInt(terms.amountAtomic);
  const merchantAccount = merchantUsdcAccount(terms.payTo);
  const merchantUsdc = await tokenAccountExists(deps.config.solanaRpcUrl, merchantAccount, fetchImpl);
  const blockers: string[] = [];
  if (!termsAreCurrent(terms, nowMs)) blockers.push("The merchant quote has expired.");
  if (terms.amountAtomic !== EXPECTED_AMOUNT_ATOMIC.toString()) blockers.push("The merchant amount is not the reviewed 1.000000 USDC.");
  if (terms.payTo !== REVIEWED_MERCHANT_RECIPIENT) blockers.push("The merchant recipient changed from the reviewed account.");
  if (!merchantUsdc) blockers.push("The merchant USDC account is missing, so this payment cannot be bounded without an account-creation cost.");

  const walletSource: "connected" | "read_only" = input.walletSource === "connected" ? "connected" : "read_only";
  const walletAddress = input.walletAddress?.trim() ?? "";
  if (!walletAddress) {
    return finish(terms, nowMs, blockers.concat("No wallet was read."), {
      buyerUsdc: "not_read",
      merchantUsdc: merchantUsdc ? "present" : "missing",
    }, emptyWallet(), skippedConversion("No wallet was read, so no conversion was requested."), null);
  }
  if (!isPlausibleAddress(walletAddress)) throw new DigitalPurchaseError("That does not look like a Solana address.");
  if (walletAddress === terms.feePayer) {
    blockers.push("The quoted fee payer is this wallet, so the shopper SOL fee is not the sponsored payment this quote describes.");
  }
  const balances = await (deps.readBalances ?? readSolanaBalances)(walletAddress, {
    rpcUrl: deps.config.solanaRpcUrl,
    fetchImpl,
  });
  const usdc = balances.find((asset) => asset.mint === USDC_MINT && asset.decimals === USDC_DECIMALS)?.amount ?? 0n;
  const sol = balances.find((asset) => asset.mint === NATIVE_SOL_MINT)?.amount ?? 0n;
  const buyerUsdc = await tokenAccountExists(deps.config.solanaRpcUrl, merchantUsdcAccount(walletAddress), fetchImpl);
  if (!buyerUsdc) blockers.push("This wallet has no mainnet USDC account. Creating one is an extra SOL cost, so the purchase is not bounded.");
  const wallet = {
    status: "read" as const,
    source: walletSource,
    address: walletAddress,
    network: "solana:mainnet" as const,
    usdcAtomic: usdc.toString(),
    usdcDisplay: `${formatFixedMinor(usdc, USDC_DECIMALS)} USDC`,
    solLamports: sol.toString(),
    solDisplay: `${formatFixedMinor(sol, 9)} SOL`,
  };
  const gap = usdcGap(usdc, price);
  if (gap === 0n) {
    return finish(terms, nowMs, blockers, {
      buyerUsdc: buyerUsdc ? "present" : "missing",
      merchantUsdc: merchantUsdc ? "present" : "missing",
    }, wallet, skippedConversion("Mainnet USDC already covers the merchant total. No conversion was requested."), 0n);
  }
  const spendable = sol > DEFAULT_SOL_RESERVE_LAMPORTS ? sol - DEFAULT_SOL_RESERVE_LAMPORTS : 0n;
  const sized = await sizeSolConversion(gap, spendable, sol, {
    baseUrl: deps.config.dflowBaseUrl,
    apiKey: deps.config.dflowApiKey ?? undefined,
    slippageBps: deps.config.dflowSlippageBps,
    fetchImpl,
  });
  if (!sized) {
    blockers.push("No SOL conversion whose minimum USDC covers the gap without spending the whole wallet.");
    return finish(terms, nowMs, blockers, {
      buyerUsdc: buyerUsdc ? "present" : "missing",
      merchantUsdc: merchantUsdc ? "present" : "missing",
    }, wallet, {
      status: "short",
      inputLamports: null,
      inputDisplay: null,
      minimumUsdcAtomic: null,
      minimumUsdcDisplay: null,
      estimatedUsdcDisplay: null,
      slippageBps: deps.config.dflowSlippageBps,
      prioritizationFeeLamports: null,
      quotedAt: null,
      expiresAt: null,
      validation: "not_prepared",
      detail: "Minimum received did not cover the USDC gap inside the SOL reserve. The whole wallet was not quoted.",
    }, null);
  }
  let order;
  try {
    order = await fetchConversionOrder({
      inputMint: WSOL_MINT,
      outputMint: USDC_MINT,
      amount: sized.inAmount,
      userPublicKey: walletAddress,
      wrapAndUnwrapSol: true,
    }, {
      baseUrl: deps.config.dflowBaseUrl,
      apiKey: deps.config.dflowApiKey ?? undefined,
      slippageBps: deps.config.dflowSlippageBps,
      fetchImpl,
    });
  } catch (error) {
    if (!(error instanceof DflowRouteError)) throw error;
    blockers.push("DFlow did not return a route for the sized conversion. Nothing was swapped.");
    return finish(terms, nowMs, blockers, {
      buyerUsdc: buyerUsdc ? "present" : "missing",
      merchantUsdc: merchantUsdc ? "present" : "missing",
    }, wallet, {
      status: "short",
      inputLamports: sized.inAmount.toString(),
      inputDisplay: `${formatFixedMinor(sized.inAmount, 9)} SOL`,
      minimumUsdcAtomic: sized.minOutAmount.toString(),
      minimumUsdcDisplay: `${formatFixedMinor(sized.minOutAmount, USDC_DECIMALS)} USDC`,
      estimatedUsdcDisplay: null,
      slippageBps: deps.config.dflowSlippageBps,
      prioritizationFeeLamports: null,
      quotedAt: null,
      expiresAt: null,
      validation: "not_prepared",
      detail: "The sizing quote covered the gap, but the wallet-bound route was refused. No transaction was signed.",
    }, null);
  }
  if (order.quote.minOutAmount < gap || order.quote.inAmount !== sized.inAmount) {
    blockers.push("The wallet-bound conversion no longer covers the gap at the quoted input.");
  }
  if (order.quote.slippageBps !== deps.config.dflowSlippageBps) {
    blockers.push("The conversion slippage is not the configured slippage. It was not raised to make the quote fit.");
  }
  const validation = inspectOrder(order, walletAddress);
  if (validation.status !== "checked") blockers.push(validation.explanation);
  const priority = order.quote.prioritizationFeeLamports;
  const cap = priority == null ? null : solSpendCap({
    conversionLamports: order.quote.inAmount,
    prioritizationFeeLamports: priority,
    walletLamports: sol,
  });
  if (!cap || cap.status !== "bounded") {
    blockers.push("SOL fees plus the conversion input are not bounded inside the reserved SOL.");
  }
  return finish(terms, nowMs, blockers, {
    buyerUsdc: buyerUsdc ? "present" : "missing",
    merchantUsdc: merchantUsdc ? "present" : "missing",
  }, wallet, {
    status: order.quote.minOutAmount >= gap ? "quoted" : "short",
    inputLamports: order.quote.inAmount.toString(),
    inputDisplay: `${formatFixedMinor(order.quote.inAmount, 9)} SOL`,
    minimumUsdcAtomic: order.quote.minOutAmount.toString(),
    minimumUsdcDisplay: `${formatFixedMinor(order.quote.minOutAmount, USDC_DECIMALS)} USDC`,
    estimatedUsdcDisplay: `${formatFixedMinor(order.quote.outAmount, USDC_DECIMALS)} USDC`,
    slippageBps: order.quote.slippageBps,
    prioritizationFeeLamports: priority?.toString() ?? null,
    quotedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + QUOTE_FRESHNESS_MS).toISOString(),
    validation: validation.status,
    detail: "Coverage uses minimum received. The unsigned transaction was checked and discarded, so its blockhash is not part of this review.",
  }, cap && cap.status === "bounded" ? cap.lamports : null);
}

async function sizeSolConversion(
  gap: bigint,
  spendable: bigint,
  walletLamports: bigint,
  options: { baseUrl: string; apiKey?: string; slippageBps: number; fetchImpl: typeof fetch },
): Promise<DflowQuote | null> {
  if (PROBE_LAMPORTS <= 0n || PROBE_LAMPORTS > spendable || PROBE_LAMPORTS >= walletLamports) return null;
  let amount = PROBE_LAMPORTS;
  let covering: DflowQuote | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let order;
    try {
      order = await fetchConversionOrder({
        inputMint: WSOL_MINT,
        outputMint: USDC_MINT,
        amount,
        wrapAndUnwrapSol: true,
      }, options);
    } catch (error) {
      if (!(error instanceof DflowRouteError)) throw error;
      continue;
    }
    const decision = conversionInputForMinimum({
      gapAtomic: gap,
      inAmount: order.quote.inAmount,
      minOutAmount: order.quote.minOutAmount,
      spendableLamports: spendable,
      walletLamports,
    });
    if (order.quote.minOutAmount >= gap) covering = order.quote;
    if (decision.status === "accept") return order.quote.minOutAmount >= gap ? order.quote : covering;
    if (decision.status === "uncovered") return covering;
    amount = decision.amount;
  }
  return covering;
}

function finish(
  terms: SolanaExactTerms,
  nowMs: number,
  blockers: string[],
  accounts: PreparedDigitalPurchase["accounts"],
  wallet: PreparedDigitalPurchase["wallet"],
  conversion: PreparedDigitalPurchase["conversion"],
  solLamports: bigint | null,
): PreparedDigitalPurchase {
  const solCap = conversion.status === "skipped"
    ? (wallet.status === "read" ? 0n : null)
    : solLamports;
  if (wallet.source === "read_only") {
    blockers.push("A read-only demo wallet can explore this quote. It cannot produce an approval package.");
  }
  const comparison = solCap == null ? null : compareSolCap(solCap);
  if (comparison?.exceedsPrevious) {
    blockers.push(`The SOL cap is ${formatFixedMinor(solCap ?? 0n, 9)} SOL, above the previous comparison of ${formatFixedMinor(PREVIOUS_SOL_CAP_LAMPORTS, 9)} SOL. The earlier figure is not a spending authorization.`);
  }
  const conversionCurrent = !conversion.expiresAt || nowMs < Date.parse(conversion.expiresAt);
  if (!conversionCurrent) blockers.push("The conversion quote has expired.");
  const unique = [...new Set(blockers)];
  const current = termsAreCurrent(terms, nowMs) && conversionCurrent;
  const bounded = unique.length === 0 && current && solCap != null;
  const sponsored = terms.feePayer !== wallet.address;
  return {
    label: "Prepared digital purchase — not paid",
    execution: "disabled",
    signing: "unavailable",
    broadcast: "unavailable",
    orderCreated: false,
    executionReady: false,
    stages: {
      quote: "checked",
      simulation: "not_run",
      signing: "unavailable",
      execution: "disabled",
      delivery: "not_started",
    },
    terms,
    termsCurrent: current,
    payload: {
      preimage: BITCOIN_ANCHOR_PREIMAGE,
      digest: terms.digest,
      submitted: "The sha256 digest only. The preimage is not sent.",
      retained: "The store says it keeps the order, the certificate, and the digest. It says it never sees the preimage.",
      returned: "A signed certificate, a patron number, a badge URL, a verify URL, and a proof URL.",
      anchoring: "The certificate can arrive while the OpenTimestamps proof is still pending. Bitcoin confirmation is a later upgrade, not the purchase response.",
    },
    delivery: {
      method: "Digital timestamp service. Not a shipped product and not a Thailand delivery.",
      thailand: "No country restriction is named. This test does not prove shipping to Thailand.",
      orderRead: "A later certificate proves this purchase only when its signed bytes contain bitcoin_anchor, this digest, 1 USDC, the mainnet USDC mint, Solana mainnet, this wallet, and the settlement transaction. Another valid certificate does not.",
      refund: "The store says a failed instant delivery takes no money. A settled payment with no certificate is a defect handled by hand. Nothing here refunds automatically, and this review does not send a letter.",
      recovery: "A caller-supplied Idempotency-Key is documented for 24 hours with the same item, payer, and original payment. This review stores the key and does not store a payment. Listing a lost purchase needs a disabled wallet-message claim.",
    },
    accounts,
    wallet,
    conversion,
    spend: {
      bounded: bounded && solCap != null,
      merchantUsdcAtomic: terms.amountAtomic,
      merchantUsdcDisplay: terms.amountDisplay,
      shopperNetworkFee: sponsored ? "paid by the quoted fee payer" : "not the sponsored shape",
      solLamports: solCap?.toString() ?? null,
      solDisplay: solCap == null ? null : `${formatFixedMinor(solCap, 9)} SOL`,
      reserveLamports: DEFAULT_SOL_RESERVE_LAMPORTS.toString(),
      previousComparisonLamports: PREVIOUS_SOL_CAP_LAMPORTS.toString(),
      exceedsPreviousComparison: comparison?.exceedsPrevious ?? false,
      unusedUsdc: conversion.status === "skipped"
        ? "No conversion. The 1 USDC payment is not added again as SOL. USDC above the merchant total stays in the wallet."
        : "The SOL cap is the conversion input plus its network fees. The 1 USDC merchant total is what that conversion funds, not a second spend. USDC above that payment stays in the wallet.",
    },
    recovery: {
      executionReady: false,
      idempotencyKey: wallet.address ? attemptIdempotencyKey({ wallet: wallet.address, digest: terms.digest }) : null,
      summary: wallet.source === "connected"
        ? "Execution is unavailable. The idempotency key is stored for a later same-payment retry. No payment is retained, and the claim signature is disabled."
        : "This is a read-only exploration. It is not an approval package and it is not stored as a recoverable payment.",
    },
    readyForApproval: bounded,
    blockers: unique,
    executionGate: mainnetExecutionGate(),
  };
}

function skippedConversion(detail: string): PreparedDigitalPurchase["conversion"] {
  return {
    status: "skipped",
    inputLamports: null,
    inputDisplay: null,
    minimumUsdcAtomic: null,
    minimumUsdcDisplay: null,
    estimatedUsdcDisplay: null,
    slippageBps: null,
    prioritizationFeeLamports: null,
    quotedAt: null,
    expiresAt: null,
    validation: "not_prepared",
    detail,
  };
}

function emptyWallet(): PreparedDigitalPurchase["wallet"] {
  return { status: "not_read", source: "not_selected", address: null, network: null, usdcAtomic: null, usdcDisplay: null, solLamports: null, solDisplay: null };
}

function inspectOrder(order: Awaited<ReturnType<typeof fetchConversionOrder>>, payer: string): { status: "checked" | "rejected"; explanation: string } {
  if (!order.transactionBase64) {
    return { status: "rejected", explanation: "DFlow did not return an unsigned transaction for this wallet." };
  }
  const transaction = decodeTransaction(order.transactionBase64);
  if (!transaction) return { status: "rejected", explanation: "DFlow returned a transaction that could not be read." };
  try {
    const result = validateConversionTransaction({
      transaction,
      payer,
      inputMint: order.quote.inputMint,
      outputMint: order.quote.outputMint,
      inAmount: order.quote.inAmount,
      outAmount: order.quote.outAmount,
      minOutAmount: order.quote.minOutAmount,
      lookupTables: parseDisclosedLookupTables(order.lookupTables),
      prioritizationFeeLamports: order.quote.prioritizationFeeLamports,
      executionMode: order.quote.executionMode,
    });
    return { status: result.status === "checked" ? "checked" : "rejected", explanation: result.explanation };
  } catch (error) {
    return { status: "rejected", explanation: error instanceof Error ? error.message : "The unsigned transaction could not be checked." };
  }
}

async function assertMainnet(rpcUrl: string, fetchImpl: typeof fetch): Promise<void> {
  const genesis = await rpcValue<string>(rpcUrl, "getGenesisHash", [], fetchImpl);
  if (genesis !== MAINNET_GENESIS_HASH) {
    throw new DigitalPurchaseError("Shopping funding requires Solana mainnet. This RPC reports a different network.");
  }
}

async function tokenAccountExists(rpcUrl: string, address: string, fetchImpl: typeof fetch): Promise<boolean> {
  const result = await rpcValue<{ value?: unknown }>(rpcUrl, "getAccountInfo", [address, { encoding: "base64" }], fetchImpl);
  return result?.value != null;
}

async function rpcValue<T>(rpcUrl: string, method: string, params: unknown[], fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new DigitalPurchaseError("Solana did not answer the account read.");
  const body = await response.json() as { error?: { message?: string }; result?: T };
  if (body.error || body.result == null) throw new DigitalPurchaseError("Solana did not answer the account read.");
  return body.result;
}
