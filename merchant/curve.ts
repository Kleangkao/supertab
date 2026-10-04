const P = (1n << 255n) - 19n;
const D = mod(-121665n * modInverse(121666n));

/** RFC 8032 rejection check. Node accepts some off-curve keys, so it cannot be used for program addresses. The 32-byte zero encoding is a curve point. */
export function isOnCurve(bytes: Uint8Array): boolean {
  if (bytes.length !== 32) return false;
  let y = 0n;
  for (let index = 0; index < 32; index += 1) y |= BigInt(bytes[index]!) << (8n * BigInt(index));
  const sign = (y >> 255n) & 1n;
  y &= (1n << 255n) - 1n;
  if (y >= P) return false;
  const y2 = mod(y * y);
  const u = mod(y2 - 1n);
  const v = mod(D * y2 + 1n);
  let x = modPow(mod(u * modInverse(v)), (P + 3n) / 8n);
  if (mod(v * x * x - u) !== 0n) x = mod(x * modPow(2n, (P - 1n) / 4n));
  if (mod(v * x * x - u) !== 0n) return false;
  if ((x & 1n) !== sign) x = mod(-x);
  return mod(v * x * x - u) === 0n;
}

function mod(value: bigint): bigint {
  const remainder = value % P;
  return remainder >= 0n ? remainder : remainder + P;
}

function modInverse(value: bigint): bigint {
  return modPow(value, P - 2n);
}

function modPow(base: bigint, exponent: bigint): bigint {
  let result = 1n;
  let current = mod(base);
  let remaining = exponent;
  while (remaining > 0n) {
    if ((remaining & 1n) === 1n) result = mod(result * current);
    current = mod(current * current);
    remaining >>= 1n;
  }
  return result;
}
