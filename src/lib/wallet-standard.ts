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

const registries = new WeakMap<WalletEventTarget, StandardWallet[]>();

export function discoverStandardWallets(target: WalletEventTarget): StandardWallet[] {
  const existing = registries.get(target);
  if (existing) return existing;
  const found: StandardWallet[] = [];
  registries.set(target, found);
  const register = (...wallets: StandardWallet[]) => {
    const added = [...new Set(wallets)].filter(wallet => !found.includes(wallet));
    found.push(...added);
    return () => {
      for (const wallet of added) {
        const index = found.indexOf(wallet);
        if (index >= 0) found.splice(index, 1);
      }
    };
  };
  target.addEventListener("wallet-standard:register-wallet", (event) => {
    const callback = (event as CustomEvent<unknown>).detail;
    if (typeof callback === "function") callback({ register });
  });
  target.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: { register } }));
  return found;
}

export async function connectStandardWallet(wallet: StandardWallet): Promise<{ address: string; canRequestSignature: boolean }> {
  const feature = wallet.features["standard:connect"] as { connect?: () => Promise<{ accounts: StandardWalletAccount[] }> } | undefined;
  const connected = feature?.connect ? await feature.connect() : { accounts: wallet.accounts };
  const address = connected.accounts[0]?.address;
  if (!address) throw new Error("The wallet did not provide an address.");
  return {
    address,
    canRequestSignature: "solana:signTransaction" in wallet.features,
  };
}
