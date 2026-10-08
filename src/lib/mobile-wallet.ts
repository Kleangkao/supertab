import { isAndroidShell } from "./android-shell";

declare global {
  interface Window {
    __supertabMwaRegistered?: boolean;
  }
}

/**
 * Android MWA registration is out of this release-hardening scope.
 * Keep a stable API for the shop UI without requiring the mobile package at build time.
 */
export function ensureAndroidWallet(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!isAndroidShell(window.navigator.userAgent) || window.isSecureContext === false) return Promise.resolve(false);
  return Promise.resolve(Boolean(window.__supertabMwaRegistered));
}
