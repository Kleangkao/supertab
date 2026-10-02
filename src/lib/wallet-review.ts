import type { SessionView } from "./view";

/** Preserve the selected product while removing terms from the previous wallet. */
export function clearWalletReview(view: SessionView): SessionView {
  if (!view.purchase) return view;
  return { ...view, purchase: { ...view.purchase,
    walletMode: "none", walletKind: "none", walletAddress: null,
    signatureCapability: "disabled", assets: [], balanceSource: "none", balanceError: null,
    funding: null, unsignedTransaction: "not_requested", transactionVersion: null,
    swapApproval: null, purchaseApproval: "required", paymentStatus: "PAYMENT_NOT_READY",
    state: "CHECKOUT_READY",
  } };
}
