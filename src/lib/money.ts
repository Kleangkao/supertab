/** Integer money helpers. Token and currency math must not use floating point. */

export function pow10(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > 18) {
    throw new Error(`Unsupported decimal exponent: ${exponent}`);
  }
  return 10n ** BigInt(exponent);
}

export function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new Error("Division requires a positive denominator");
  }
  if (numerator <= 0n) return 0n;
  return (numerator + denominator - 1n) / denominator;
}

/** Parse a decimal string such as "12.99" into minor units. Rejects non-numeric input. */
export function parseDecimalToMinor(value: string, exponent: number): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Not a decimal amount: ${value}`);
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const scale = pow10(exponent);
  const wholeMinor = BigInt(whole) * scale;
  if (fraction.length <= exponent) {
    const padded = fraction.padEnd(exponent, "0");
    return wholeMinor + (padded.length === 0 ? 0n : BigInt(padded));
  }
  const kept = fraction.slice(0, exponent);
  const roundUp = fraction[exponent] >= "5";
  const base = wholeMinor + BigInt(kept.padEnd(exponent, "0"));
  return roundUp ? base + 1n : base;
}

export function formatMinor(amount: bigint, exponent: number): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const scale = pow10(exponent);
  const whole = abs / scale;
  if (exponent === 0) return signed(whole.toString(), negative);
  const fraction = (abs % scale).toString().padStart(exponent, "0").replace(/0+$/, "");
  const body = fraction.length > 0 ? `${whole}.${fraction}` : whole.toString();
  return signed(body, negative);
}

function signed(body: string, negative: boolean): string {
  return negative ? `-${body}` : body;
}

/** Keep every currency digit. Token balances use formatMinor, which drops a trailing zero fraction. */
export function formatFixedMinor(amount: bigint, exponent: number): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const scale = pow10(exponent);
  const whole = abs / scale;
  if (exponent === 0) return signed(whole.toString(), negative);
  const fraction = (abs % scale).toString().padStart(exponent, "0");
  return signed(`${whole}.${fraction}`, negative);
}

export function formatUsdFromMinor(amount: bigint, exponent = 2): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const scale = pow10(exponent);
  const whole = abs / scale;
  const fraction = (abs % scale).toString().padStart(exponent, "0");
  return `${negative ? "-" : ""}$${whole}.${fraction}`;
}

/** 1 cent = 10^(usdcDecimals-2) USDC base units. USD cents and 6-decimal USDC align exactly. */
export function usdMinorToUsdcBase(minor: bigint, usdExponent = 2, usdcDecimals = 6): bigint {
  if (usdcDecimals < usdExponent) {
    throw new Error("USDC decimals are finer than the payable currency exponent");
  }
  return minor * pow10(usdcDecimals - usdExponent);
}

export function usdcBaseToUsdMinor(base: bigint, usdExponent = 2, usdcDecimals = 6): bigint {
  const scale = pow10(usdcDecimals - usdExponent);
  return base / scale;
}
