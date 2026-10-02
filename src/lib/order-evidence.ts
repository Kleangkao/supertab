export type MerchantEvidenceKind =
  | "merchant_order_api"
  | "authorized_checkout_receipt"
  | "merchant_confirmation"
  | "provider_order_id"
  | "webhook"
  | "trusted_receipt";

export interface PaymentEvidence {
  providerId: string;
  providerReference: string;
  confirmedAt: string;
}

export interface MerchantOrderEvidence {
  kind: MerchantEvidenceKind;
  reference: string;
  verifiedAt: string;
}

export function hasMerchantOrder(evidence: MerchantOrderEvidence | null): boolean {
  return evidence != null && evidence.reference.trim().length > 0 && evidence.verifiedAt.trim().length > 0;
}

export function paymentDoesNotProveOrder(payment: PaymentEvidence | null, order: MerchantOrderEvidence | null): boolean {
  return payment != null && !hasMerchantOrder(order);
}
