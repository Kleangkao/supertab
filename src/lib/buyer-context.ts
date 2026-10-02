import { isIP } from "node:net";
import { sameOriginRequest } from "./request-origin";

/** Buyer network context is private request data, never a session/model field. */
export function publicBuyerIp(value: string | null | undefined): string | null {
  if (!value || value !== value.trim() || value.length > 45) return null;
  if (isIP(value) === 4) {
    const [a, b, c] = value.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a! >= 224 || (a === 100 && b! >= 64 && b! <= 127)
      || (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 168)
      || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return null;
    return value;
  }
  // Globally routed IPv6 unicast only; reject local, mapped and documentation IPs.
  if (isIP(value) === 6 && /^[23][0-9a-f]{3}:/i.test(value) && !/^2001:0*db8:/i.test(value)) return value;
  return null;
}

export function buyerIpForRequest(request: Request, config: {
  shopifyLocalBuyerIp: string | null; shopifyBuyerIpHeader: string | null;
}): string | null {
  const url = new URL(request.url);
  if (!sameOriginRequest(request)) return null;
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (local && config.shopifyLocalBuyerIp) return publicBuyerIp(config.shopifyLocalBuyerIp);
  // Only configured headers from a proxy that overwrites incoming client values.
  // Lists are rejected: no guessing which hop is the actual buyer.
  return config.shopifyBuyerIpHeader ? publicBuyerIp(request.headers.get(config.shopifyBuyerIpHeader)) : null;
}
