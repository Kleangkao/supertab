import { isAndroidShell } from "./android-shell";

declare global {
  interface Window {
    __supertabMwaRegistered?: boolean;
  }
}

/**
 * The Android document-start asset registers MWA. Discovery listens for its
 * registration event even when the asset finishes after React mounts.
 */
export function ensureAndroidWallet(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!isAndroidShell(window.navigator.userAgent) || window.isSecureContext === false) return Promise.resolve(false);
  return Promise.resolve(Boolean(window.__supertabMwaRegistered));
}
