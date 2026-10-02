import {
  NATIVE_SOL_MINT,
  USDC_DECIMALS,
  emptyUsdcBalance,
  isUsdcMint,
  knownMintMetadata,
  type AssetBalance,
} from "./tokens";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export interface WalletProvider {
  getNetwork(): { cluster: string; rpc: "default_public" | "custom" };
  getAddress(): string | null;
  getBalances(address: string): Promise<AssetBalance[]>;
  prepareTransaction(): { status: "disabled"; reason: string };
  requestSignature(): { status: "disabled"; reason: string };
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function isPlausibleAddress(address: string): boolean {
  const trimmed = address.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return false;
  return decodeBase58(trimmed)?.length === 32;
}

function decodeBase58(value: string): Uint8Array | null {
  let amount = 0n;
  for (const char of value) {
    const digit = BASE58.indexOf(char);
    if (digit < 0) return null;
    amount = amount * 58n + BigInt(digit);
  }
  let hex = amount.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  if (hex === "00") hex = "";
  const body = hex.length === 0 ? new Uint8Array() : Uint8Array.from(Buffer.from(hex, "hex"));
  let leadingZeros = 0;
  for (const char of value) {
    if (char !== "1") break;
    leadingZeros += 1;
  }
  const decoded = new Uint8Array(leadingZeros + body.length);
  decoded.set(body, leadingZeros);
  return decoded;
}

export function createReadOnlyWallet(options: {
  rpcUrl: string;
  cluster?: string;
  customRpc: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): WalletProvider {
  return {
    getNetwork() {
      return {
        cluster: options.cluster ?? "mainnet-beta",
        rpc: options.customRpc ? "custom" : "default_public",
      };
    },
    getAddress() {
      return null;
    },
    getBalances(address: string) {
      return readSolanaBalances(address, options);
    },
    prepareTransaction() {
      return {
        status: "disabled",
        reason: "SuperTab can read spending assets. It does not ask this browser to sign.",
      };
    },
    requestSignature() {
      return {
        status: "disabled",
        reason: "Signature requests are disabled. No transaction will be approved from here.",
      };
    },
  };
}

export async function readSolanaBalances(
  address: string,
  options: { rpcUrl: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<AssetBalance[]> {
  if (!isPlausibleAddress(address)) throw new Error("That does not look like a Solana address.");
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const [lamports, tokenAccounts, token2022] = await Promise.all([
    rpcCall<number | { value?: number }>(options.rpcUrl, "getBalance", [address.trim()], fetchImpl, timeoutMs),
    rpcCall<{ value?: unknown[] }>(
      options.rpcUrl,
      "getTokenAccountsByOwner",
      [address.trim(), { programId: TOKEN_PROGRAM }, { encoding: "jsonParsed" }],
      fetchImpl,
      timeoutMs,
    ),
    rpcCall<{ value?: unknown[] }>(
      options.rpcUrl,
      "getTokenAccountsByOwner",
      [address.trim(), { programId: TOKEN_2022 }, { encoding: "jsonParsed" }],
      fetchImpl,
      timeoutMs,
    ).catch(() => ({ value: [] })),
  ]);
  const solLamports = typeof lamports === "number" ? lamports : lamports?.value;
  if (typeof solLamports !== "number" || !Number.isSafeInteger(solLamports) || solLamports < 0) {
    throw new Error("Solana did not return a usable SOL balance.");
  }
  const assets: AssetBalance[] = [{
    mint: NATIVE_SOL_MINT,
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    amount: BigInt(solLamports),
    kind: "native",
    isUsdc: false,
    routeKnown: false,
    observed: true,
  }];
  const parsed = [
    ...parseTokenAccounts(tokenAccounts?.value ?? []),
    ...parseTokenAccounts(token2022?.value ?? []),
  ];
  // One mint can have multiple token accounts. Return one asset per mint so
  // funding, quote selection and the UI all use the complete wallet balance.
  const byMint = new Map<string, AssetBalance>();
  for (const account of parsed) {
    const previous = byMint.get(account.mint);
    if (previous && previous.decimals !== account.decimals) {
      throw new Error("Solana returned inconsistent decimals for a token mint.");
    }
    if (previous) previous.amount += account.amount;
    else byMint.set(account.mint, { ...account });
  }
  let sawUsdc = false;
  for (const account of byMint.values()) {
    if (account.amount === 0n && !isUsdcMint(account.mint)) continue;
    if (isUsdcMint(account.mint)) sawUsdc = true;
    assets.push(account);
  }
  if (!sawUsdc) assets.push(emptyUsdcBalance());
  return assets;
}

export function parseTokenAccounts(value: unknown[]): AssetBalance[] {
  const balances: AssetBalance[] = [];
  for (const entry of value) {
    const info = (entry as {
      account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string; decimals?: number } } } } };
    })?.account?.data?.parsed?.info;
    const mint = info?.mint;
    const amount = info?.tokenAmount?.amount;
    const decimals = info?.tokenAmount?.decimals;
    if (!mint || typeof amount !== "string" || !/^\d+$/.test(amount) || typeof decimals !== "number") continue;
    const known = knownMintMetadata(mint);
    const usdc = isUsdcMint(mint);
    balances.push({
      mint,
      symbol: known?.symbol ?? null,
      name: known?.name ?? null,
      decimals,
      amount: BigInt(amount),
      kind: usdc ? "stablecoin" : "spl",
      isUsdc: usdc,
      routeKnown: false,
      observed: true,
    });
  }
  return balances;
}

async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<T> {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Solana network request failed (${response.status}).`);
  const body = await response.json() as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || "Solana network request failed.");
  return body.result as T;
}

export function assertUsdcIdentity(balance: AssetBalance): void {
  if (balance.symbol === "USDC" && !isUsdcMint(balance.mint)) {
    throw new Error("A token labeled USDC is not the canonical USDC mint.");
  }
  if (isUsdcMint(balance.mint) && balance.decimals !== USDC_DECIMALS) {
    return;
  }
}
