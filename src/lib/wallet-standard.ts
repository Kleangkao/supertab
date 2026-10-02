export interface StandardWalletAccount {
  address: string;
}

export interface StandardWallet {
  name: string;
  accounts: StandardWalletAccount[];
  features: Record<string, unknown>;
}

export interface WalletEventTarget {
  addEventListener(type: string, listener: (event: Event) => void): void;
  dispatchEvent(event: Event): boolean;
}

export function discoverStandardWallets(target: WalletEventTarget): StandardWallet[] {
  const found: StandardWallet[] = [];
  const register = (...wallets: StandardWallet[]) => {
    found.push(...wallets);
  };
  target.addEventListener("wallet-standard:register-wallet", (event) => {
    const detail = (event as CustomEvent<{ register?: (callback: typeof register) => void }>).detail;
    detail?.register?.(register);
  });
  target.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: { register } }));
  return found;
}

export async function connectStandardWallet(wallet: StandardWallet): Promise<{ address: string; canRequestSignature: boolean }> {
  const feature = wallet.features["standard:connect"] as { connect?: () => Promise<{ accounts: StandardWalletAccount[] }> } | undefined;
  const connected = feature?.connect ? await feature.connect() : { accounts: wallet.accounts };
  const address = connected.accounts[0]?.address ?? wallet.accounts[0]?.address;
  if (!address) throw new Error("The wallet did not provide an address.");
  return {
    address,
    canRequestSignature: "solana:signTransaction" in wallet.features,
  };
}
