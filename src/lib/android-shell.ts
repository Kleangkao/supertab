export const SHOPPING_SESSION_KEY = "supertab.shopping-session.v1";
export const ANDROID_SHELL_MARKER = "Solana Mobile Web Shell";
export const MOBILE_WALLET_NAME = "Mobile Wallet Adapter";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function isAndroidShell(userAgent: string): boolean {
  return userAgent.includes(ANDROID_SHELL_MARKER);
}

export function readShoppingSessionId(sessionStore: StorageLike | null, localStore: StorageLike | null): string | null {
  return read(sessionStore) ?? read(localStore);
}

export function writeShoppingSessionId(sessionStore: StorageLike | null, localStore: StorageLike | null, sessionId: string): void {
  write(sessionStore, sessionId);
  write(localStore, sessionId);
}

export function clearShoppingSessionId(sessionStore: StorageLike | null, localStore: StorageLike | null): void {
  remove(sessionStore);
  remove(localStore);
}

export type WalletFailure = "cancelled" | "unavailable" | "failed";

export function classifyWalletFailure(error: unknown): WalletFailure {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/reject|cancel|denied|declin|closed the request/i.test(text)) return "cancelled";
  if (/not found|not installed|no activity|unavailable|ERROR_WALLET_NOT_FOUND|browser not supported/i.test(text)) return "unavailable";
  return "failed";
}

export function walletFailureMessage(failure: WalletFailure): string {
  if (failure === "cancelled") return "The wallet request was canceled. Nothing was signed or sent.";
  if (failure === "unavailable") return "No Android wallet answered. Install a Mobile Wallet Adapter wallet, or enter a public address for a read-only balance check.";
  return "The wallet did not finish the request. You can try again. Nothing was signed or sent.";
}

/** Identity sent to a mobile wallet. The hosted page must be https so the association is a secure context. */
export function androidWalletRegistration(origin: string): {
  appIdentity: { name: "SuperTab"; uri: string; icon: "favicon.ico" };
  chains: readonly ["solana:mainnet", "solana:devnet"];
} {
  const url = new URL(origin);
  if (url.protocol !== "https:") throw new Error("Mobile Wallet Adapter requires the hosted https origin.");
  return {
    appIdentity: { name: "SuperTab", uri: url.origin, icon: "favicon.ico" },
    chains: ["solana:mainnet", "solana:devnet"],
  };
}

function read(store: StorageLike | null): string | null {
  try {
    const value = store?.getItem(SHOPPING_SESSION_KEY)?.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

function write(store: StorageLike | null, sessionId: string): void {
  try { store?.setItem(SHOPPING_SESSION_KEY, sessionId); } catch { /* Storage is optional. */ }
}

function remove(store: StorageLike | null): void {
  try { store?.removeItem(SHOPPING_SESSION_KEY); } catch { /* Storage is optional. */ }
}
