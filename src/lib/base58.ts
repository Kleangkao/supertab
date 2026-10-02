const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function decodeBase58(value: string): Uint8Array | null {
  let amount = 0n;
  for (const char of value) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) return null;
    amount = amount * 58n + BigInt(digit);
  }
  const body: number[] = [];
  while (amount > 0n) { body.unshift(Number(amount & 255n)); amount >>= 8n; }
  let zeros = 0;
  for (const char of value) { if (char !== "1") break; zeros++; }
  return Uint8Array.from([...new Array<number>(zeros).fill(0), ...body]);
}
