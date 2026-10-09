import {
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  registerMwa,
} from "@solana-mobile/wallet-standard-mobile";
import { androidWalletRegistration, isAndroidShell } from "./android-shell";

declare global {
  interface Window { __supertabMwaRegistered?: boolean }
}

// Register only in the trusted https Android shell. Connection is requested
// separately by the shopping UI; loading this bundle never signs or sends.
if (typeof window !== "undefined" && !window.__supertabMwaRegistered
  && window.isSecureContext && isAndroidShell(navigator.userAgent)) {
  registerMwa({
    ...androidWalletRegistration(window.location.origin),
    authorizationCache: createDefaultAuthorizationCache(),
    chainSelector: createDefaultChainSelector(),
    onWalletNotFound: async () => {
      window.dispatchEvent(new CustomEvent("supertab-wallet-unavailable"));
    },
  });
  window.__supertabMwaRegistered = true;
}
