import { decodeBase58, encodeBase58 } from "./base58";

export interface DevnetPaymentTerms {
  transaction: string;
  buyer: string;
  mint: string;
  reference: string;
  totalMinor: string;
  checkoutId: string;
  expiresAt: string;
}

/** Returns the reason a wallet signature must not be requested. Null means the exact checkout can be signed. */
export function devnetPaymentBlock(input: {
  terms: DevnetPaymentTerms | null;
  connectedAddress: string | null;
  devnetCapable: boolean;
  approvedCheckoutId: string | null;
  now: number;
}): string | null {
  if (!input.connectedAddress) return "Connect the wallet that will pay before requesting a checkout.";
  if (!input.devnetCapable) return "This wallet account is not on Solana devnet. No payment was requested.";
  if (!input.terms) return "Review the merchant checkout before approving a payment.";
  if (input.now >= Date.parse(input.terms.expiresAt)) return "This checkout expired. Review it again before signing.";
  if (input.connectedAddress !== input.terms.buyer) return "The connected account is not the buyer on this checkout.";
  if (input.approvedCheckoutId !== input.terms.checkoutId) return "Approve this exact checkout before signing.";
  if (!paymentBytesMatch(input.terms)) return "The merchant transaction does not match this checkout.";
  return null;
}

export function signedPaymentSignature(signedTransaction: string): string | null {
  const raw = bytesFromBase64(signedTransaction);
  if (!raw || raw[0] !== 1 || raw.length < 65) return null;
  if (raw.subarray(1, 65).every((byte) => byte === 0)) return null;
  return encodeBase58(raw.subarray(1, 65));
}

function paymentBytesMatch(terms: DevnetPaymentTerms): boolean {
  const raw = bytesFromBase64(terms.transaction);
  const buyer = decodeBase58(terms.buyer);
  const mint = decodeBase58(terms.mint);
  const reference = decodeBase58(terms.reference);
  if (!raw || raw[0] !== 1 || raw.length < 66 || !buyer || buyer.length !== 32 || !mint || !reference) return false;
  const message = raw.subarray(65);
  if (message.length < 36 || message.subarray(4, 36).some((byte, index) => byte !== buyer[index])) return false;
  const amount = new Uint8Array(10);
  amount[0] = 12;
  let remaining = BigInt(terms.totalMinor);
  for (let index = 0; index < 8; index += 1) {
    amount[index + 1] = Number(remaining & 255n);
    remaining >>= 8n;
  }
  amount[9] = 6;
  return includes(message, buyer) && includes(message, mint) && includes(message, reference) && includes(message, amount);
}

function includes(haystack: Uint8Array, needle: Uint8Array): boolean {
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    let matched = true;
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[start + index] !== needle[index]) { matched = false; break; }
    }
    if (matched) return true;
  }
  return false;
}

function bytesFromBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}
