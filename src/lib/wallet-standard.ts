import { checkMemoBytes, DEVNET_CHAIN, type DevnetSigningCheck } from "./devnet-memo";
import { describePaymentMismatch, samePaymentMessage, samePaymentWithWalletBudget } from "./payment-message";

export interface StandardWalletAccount {
  address: string;
  chains?: readonly string[];
  features?: readonly string[];
}

export interface StandardWallet {
  name: string;
  accounts: StandardWalletAccount[];
  chains?: readonly string[];
  features: Record<string, unknown>;
}

export interface WalletEventTarget {
  addEventListener(type: string, listener: (event: Event) => void): void;
  dispatchEvent(event: Event): boolean;
}

const registries = new WeakMap<WalletEventTarget, StandardWallet[]>();

export function discoverStandardWallets(target: WalletEventTarget): StandardWallet[] {
  const existing = registries.get(target);
  if (existing) return existing;
  const found: StandardWallet[] = [];
  registries.set(target, found);
  const register = (...wallets: StandardWallet[]) => {
    const added = [...new Set(wallets)].filter(wallet => !found.includes(wallet));
    found.push(...added);
    return () => {
      for (const wallet of added) {
        const index = found.indexOf(wallet);
        if (index >= 0) found.splice(index, 1);
      }
    };
  };
  target.addEventListener("wallet-standard:register-wallet", (event) => {
    const callback = (event as CustomEvent<unknown>).detail;
    if (typeof callback === "function") callback({ register });
  });
  target.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: { register } }));
  return found;
}

export async function connectStandardWallet(wallet: StandardWallet): Promise<{ address: string; account: StandardWalletAccount; canRequestSignature: boolean }> {
  const feature = wallet.features["standard:connect"] as { connect?: () => Promise<{ accounts: StandardWalletAccount[] }> } | undefined;
  const connected = feature?.connect ? await feature.connect() : { accounts: wallet.accounts };
  const account = connected.accounts[0];
  if (!account?.address) throw new Error("The wallet did not provide an address.");
  return {
    address: account.address,
    account,
    canRequestSignature: "solana:signTransaction" in wallet.features,
  };
}

function signingAccount(wallet: StandardWallet, address: string, account?: StandardWalletAccount): StandardWalletAccount | undefined {
  if (account?.address === address) return account;
  return wallet.accounts.find(item => item.address === address);
}

export function supportsWalletMessage(wallet: StandardWallet): boolean {
  const feature = wallet.features["solana:signMessage"] as { signMessage?: unknown } | undefined;
  return typeof feature?.signMessage === "function";
}

export function supportsDevnetSigning(wallet: StandardWallet, address: string, account?: StandardWalletAccount): boolean {
  const feature = wallet.features["solana:signTransaction"] as { signTransaction?: unknown; supportedTransactionVersions?: readonly unknown[] } | undefined;
  const resolved = signingAccount(wallet, address, account);
  return typeof feature?.signTransaction === "function" && feature.supportedTransactionVersions?.includes("legacy") === true
    && wallet.chains?.includes(DEVNET_CHAIN) === true && resolved?.chains?.includes(DEVNET_CHAIN) === true
    && resolved.features?.includes("solana:signTransaction") === true;
}

export async function signDevnetCheck(wallet: StandardWallet, check: DevnetSigningCheck, account?: StandardWalletAccount): Promise<string> {
  if (!supportsDevnetSigning(wallet, check.address, account)) throw new Error("This wallet account does not support legacy devnet signing.");
  if (Date.now() >= Date.parse(check.expiresAt)) throw new Error("The devnet check expired. Prepare it again.");
  const transaction = Uint8Array.from(atob(check.transaction), char => char.charCodeAt(0));
  checkMemoBytes(check, transaction, false);
  const resolved = signingAccount(wallet, check.address, account)!;
  const feature = wallet.features["solana:signTransaction"] as { signTransaction: (input: {
    account: StandardWalletAccount; transaction: Uint8Array; chain: typeof DEVNET_CHAIN;
  }) => Promise<{ signedTransaction: Uint8Array }[]> };
  // Never use solana:signAndSendTransaction or an RPC send method.
  const outputs = await feature.signTransaction({ account: resolved, transaction, chain: DEVNET_CHAIN });
  if (outputs.length !== 1 || !(outputs[0]?.signedTransaction instanceof Uint8Array)) throw new Error("The wallet did not return one signed transaction.");
  checkMemoBytes(check, outputs[0].signedTransaction, true);
  return btoa(String.fromCharCode(...outputs[0].signedTransaction));
}

/** Signs one prepared legacy devnet payment. This does not send it. */
export async function signDevnetTransfer(wallet: StandardWallet, address: string, transactionBase64: string, account?: StandardWalletAccount): Promise<string> {
  if (!supportsDevnetSigning(wallet, address, account)) throw new Error("This wallet account does not support legacy devnet signing.");
  const transaction = Uint8Array.from(atob(transactionBase64), (char) => char.charCodeAt(0));
  const signers = transaction[0] ?? 0;
  if (signers < 1 || signers > 2) throw new Error("The checkout transaction does not have one or two signers.");
  const messageAt = 1 + signers * 64;
  const resolved = signingAccount(wallet, address, account)!;
  const feature = wallet.features["solana:signTransaction"] as { signTransaction: (input: {
    account: StandardWalletAccount; transaction: Uint8Array; chain: typeof DEVNET_CHAIN;
  }) => Promise<{ signedTransaction: Uint8Array }[]> };
  const outputs = await feature.signTransaction({ account: resolved, transaction, chain: DEVNET_CHAIN });
  const returned = outputs[0]?.signedTransaction;
  // Extension responses can originate in another realm, where instanceof fails.
  if (outputs.length !== 1 || !ArrayBuffer.isView(returned)
    || Object.prototype.toString.call(returned) !== "[object Uint8Array]") {
    throw new Error("The wallet returned an unsupported signing response. No payment was sent.");
  }
  const signed = Uint8Array.from(returned);
  const exact = signed.length === transaction.length && signed[0] === signers
    && signed.subarray(messageAt).every((byte, index) => byte === transaction[messageAt + index]);
  if (!exact && !samePaymentMessage(transaction, signed) && !samePaymentWithWalletBudget(transaction, signed)) {
    throw new Error(`The wallet changed the payment message (${describePaymentMismatch(transaction, signed)}). No payment was sent. Extra instructions or changed payment terms are not accepted.`);
  }
  if (signed.subarray(1, 65).every((byte) => byte === 0)) {
    throw new Error("The wallet returned an unsigned payment. No payment was sent.");
  }
  return btoa(String.fromCharCode(...signed));
}

/** Explicit nonfinancial signing only; never sign or broadcast a transaction. */
export async function signWalletMessage(wallet: StandardWallet, address: string, message: string, account?: StandardWalletAccount): Promise<string> {
  const resolved = signingAccount(wallet, address, account);
  const feature = wallet.features["solana:signMessage"] as { signMessage?: (input: {
    account: StandardWalletAccount; message: Uint8Array;
  }) => Promise<{ signedMessage: Uint8Array; signature: Uint8Array; signatureType?: string }[]> } | undefined;
  if (!resolved || !feature?.signMessage) throw new Error("Reconnect a wallet that supports message signing.");
  const bytes = new TextEncoder().encode(message);
  const outputs = await feature.signMessage({ account: resolved, message: bytes });
  const output = outputs[0];
  if (outputs.length !== 1 || !output || !(output.signedMessage instanceof Uint8Array) || !(output.signature instanceof Uint8Array)
    || output.signature.length !== 64 || (output.signatureType && output.signatureType !== "ed25519")
    || output.signedMessage.length !== bytes.length || output.signedMessage.some((byte, index) => byte !== bytes[index])) {
    throw new Error("This wallet did not sign the exact control-check message. No approval was recorded.");
  }
  return btoa(String.fromCharCode(...output.signature));
}

/** Account, chain or capability changes invalidate the reviewed wallet terms. */
export function watchStandardWallet(wallet: StandardWallet, invalidate: () => void): () => void {
  const feature = wallet.features["standard:events"] as {
    on?: (event: "change", callback: (change: Record<string, unknown>) => void) => () => void;
  } | undefined;
  if (!feature?.on) return () => {};
  let active = true;
  const off = feature.on("change", change => {
    if (active && ["accounts", "chains", "features"].some(key => Object.hasOwn(change, key))) invalidate();
  });
  return () => { if (!active) return; active = false; off(); };
}
