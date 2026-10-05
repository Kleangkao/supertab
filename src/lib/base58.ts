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

export function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits = [0];
  for (let index = zeros; index < bytes.length; index += 1) {
    let carry = bytes[index]!;
    for (let digitIndex = 0; digitIndex < digits.length; digitIndex += 1) {
      carry += digits[digitIndex]! << 8;
      digits[digitIndex] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return `${"1".repeat(zeros)}${digits.reverse().map((digit) => ALPHABET[digit]).join("")}`;
}
