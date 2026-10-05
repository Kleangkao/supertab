"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DEVNET_CONVERSION_FINDING, type ConversionReview, type DevnetConversionResult } from "@/lib/conversion-facts";
import { BONK_MINT, JUP_MINT, NATIVE_SOL_MINT } from "@/lib/tokens";

interface WalletAsset {
  mint: string;
  symbol: string | null;
  decimals: number;
  amountBase: string;
  amountDisplay: string;
  kind: "native" | "spl" | "stablecoin";
  isMainnetUsdc: boolean;
}

const KNOWN_ASSETS = [
  { mint: NATIVE_SOL_MINT, kind: "native" as const, label: "SOL", decimals: 9 },
  { mint: JUP_MINT, kind: "spl" as const, label: "JUP", decimals: 6 },
  { mint: BONK_MINT, kind: "spl" as const, label: "BONK", decimals: 5 },
];

export function AssetConversion({ suggestedAddress = "" }: { suggestedAddress?: string }) {
  const finding = DEVNET_CONVERSION_FINDING;
  const [address, setAddress] = useState(suggestedAddress);
  const [assets, setAssets] = useState<WalletAsset[] | null>(null);
  const [selected, setSelected] = useState(KNOWN_ASSETS[0]!.mint);
  const [kind, setKind] = useState<"native" | "spl">("native");
  const [amountText, setAmountText] = useState("0.01");
  const [review, setReview] = useState<ConversionReview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!review) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [review]);

  const choices = assets?.filter((asset) => !asset.isMainnetUsdc && asset.amountBase !== "0") ?? [];
  const usdc = assets?.find((asset) => asset.isMainnetUsdc) ?? null;
  const expired = !!review && now >= Date.parse(review.expiresAt);

  function choose(mint: string, assetKind: "native" | "spl", decimals: number) {
    setSelected(mint);
    setKind(assetKind);
    setAmountText(decimals >= 9 ? "0.01" : "1");
    setReview(null);
  }

  async function readWallet(event: FormEvent) {
    event.preventDefault();
    setBusy("Reading mainnet balances…");
    setError(null);
    setReview(null);
    try {
      const response = await fetch("/api/conversion/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "balances", address }),
      });
      const body = await response.json() as { error?: string; assets?: WalletAsset[] };
      if (!response.ok || !body.assets) throw new Error(body.error ?? "The wallet could not be read.");
      setAssets(body.assets);
      const first = body.assets.find((asset) => !asset.isMainnetUsdc && asset.amountBase !== "0");
      if (first) choose(first.mint, first.kind === "native" ? "native" : "spl", first.decimals);
    } catch (caught) {
      setAssets(null);
      setError(caught instanceof Error ? caught.message : "The wallet could not be read.");
    } finally {
      setBusy(null);
    }
  }

  async function quote() {
    setBusy("Requesting a DFlow quote…");
    setError(null);
    try {
      const response = await fetch("/api/conversion/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "quote",
          network: "solana:mainnet-beta",
          inputMint: selected,
          assetKind: kind,
          amountText,
          walletAddress: address.trim() || undefined,
        }),
      });
      const body = await response.json() as (ConversionReview | DevnetConversionResult) & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The quote failed.");
      if (!("validation" in body)) throw new Error(finding.summary);
      setReview(body);
      setNow(Date.now());
    } catch (caught) {
      setReview(null);
      setError(caught instanceof Error ? caught.message : "The quote failed.");
    } finally {
      setBusy(null);
    }
  }

  return <section className="conversion-panel" aria-label="Asset conversion quote only">
    <p className="eyebrow">ASSET CONVERSION — QUOTE ONLY</p>
    <h2>Review a conversion into USDC.</h2>
    <p>This asks DFlow for a Solana mainnet-beta quote into mainnet USDC. It does not sign, send, or add the estimate to a wallet balance. A quote is not a completed conversion.</p>
    <div className="path-grid">
      <article className="path-card">
        <h3>Mainnet quote</h3>
        <p>Network: Solana mainnet-beta. Output mint: mainnet USDC, checked by address rather than by the symbol USDC.</p>
        <form className="address-form" onSubmit={(event) => void readWallet(event)}>
          <label className="sr-only" htmlFor="conversion-address">Public Solana address</label>
          <input id="conversion-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Public Solana address, optional" disabled={!!busy} />
          <button className="secondary" type="submit" disabled={!!busy || !address.trim()}>Read mainnet wallet</button>
        </form>
        {usdc && <div className="detail-row"><span>Mainnet USDC already in this wallet</span><strong>{usdc.amountDisplay}</strong></div>}
        <label className="asset-select">Asset
          <select aria-label="Conversion input asset" disabled={!!busy || (assets != null && choices.length === 0)} value={assets != null && choices.length === 0 ? "" : `${kind}:${selected}`} onChange={(event) => {
            const [assetKind, mint] = event.target.value.split(":");
            const known = KNOWN_ASSETS.find((asset) => asset.mint === mint);
            const held = choices.find((asset) => asset.mint === mint);
            choose(mint ?? selected, assetKind === "native" ? "native" : "spl", held?.decimals ?? known?.decimals ?? 6);
          }}>
            {choices.length > 0
              ? choices.map((asset) => <option key={asset.mint} value={`${asset.kind === "native" ? "native" : "spl"}:${asset.mint}`}>{asset.symbol ?? "Token"} · {asset.amountDisplay} · {asset.mint}</option>)
              : assets == null
                ? KNOWN_ASSETS.map((asset) => <option key={asset.mint} value={`${asset.kind}:${asset.mint}`}>{asset.label} · mint {asset.mint}</option>)
                : <option value="">No convertible balance</option>}
          </select>
        </label>
        {assets == null && <p>No wallet is loaded, so these are known mainnet mints. The balance is not read and the quote is not a balance.</p>}
        {assets != null && choices.length === 0 && <p>This mainnet wallet has no other asset with a balance to convert. Mainnet USDC is already the output mint.</p>}
        <label className="asset-select">Input amount
          <input aria-label="Conversion input amount" value={amountText} onChange={(event) => { setAmountText(event.target.value); setReview(null); }} disabled={!!busy} inputMode="decimal" />
        </label>
        <div className="wallet-actions">
          <button className="secondary" type="button" disabled={!!busy || !amountText.trim() || (assets != null && choices.length === 0)} onClick={() => void quote()}>{busy ?? "Request quote"}</button>
        </div>
        <p>Mainnet signing and sending stay unavailable. There is no approval button on this quote.</p>
        {error && <div className="notice warning" role="alert">{error}</div>}
      </article>
      <article className="path-card">
        <h3>Devnet conversion</h3>
        <p>{finding.summary}</p>
        <div className="detail-row"><span>Checked</span><strong>{finding.checkedOn}</strong></div>
        <div className="detail-row"><span>Provider</span><strong>{finding.provider}</strong></div>
        <div className="detail-row"><span>Input mint</span><strong>{finding.inputMint}</strong></div>
        <div className="detail-row"><span>Circle devnet USDC</span><strong>{finding.outputMint}</strong></div>
        <div className="detail-row"><span>Result</span><strong>HTTP {finding.httpStatus} {finding.code}</strong></div>
        <p>Devnet checkout still uses confirmed devnet balances only. This finding does not start a swap or a new devnet purchase.</p>
      </article>
    </div>
    {review && <article className="path-card conversion-result" aria-live="polite">
      <p className="eyebrow">{expired ? "QUOTE EXPIRED" : "LIVE DFLOW QUOTE"}</p>
      <h3>Not a completed conversion</h3>
      <div className="detail-row"><span>Network</span><strong>{review.network}</strong></div>
      <div className="detail-row"><span>Wallet asset</span><strong>{review.walletAssetMint}</strong></div>
      <div className="detail-row"><span>Input mint</span><strong>{review.inputMint}</strong></div>
      <div className="detail-row"><span>Output mint</span><strong>{review.outputMint}</strong></div>
      <div className="detail-row"><span>Input amount</span><strong>{review.inputAmountDisplay}</strong></div>
      <div className="detail-row"><span>Input base units</span><strong>{review.inputAmountBase} · {review.inputDecimals} decimals</strong></div>
      <div className="detail-row"><span>Estimated USDC output</span><strong>{review.estimatedOutputDisplay}</strong></div>
      <div className="detail-row"><span>Estimated output base units</span><strong>{review.estimatedOutputBase} · {review.outputDecimals} decimals</strong></div>
      <div className="detail-row"><span>Minimum received</span><strong>{review.minimumOutputDisplay}</strong></div>
      <div className="detail-row"><span>Minimum base units</span><strong>{review.minimumOutputBase}</strong></div>
      <div className="detail-row"><span>Slippage</span><strong>{review.slippageDisplay}</strong></div>
      <div className="detail-row"><span>Provider fee</span><strong>{review.platformFee}</strong></div>
      <div className="detail-row"><span>Network fee</span><strong>{review.networkFee}</strong></div>
      <div className="detail-row"><span>Quote time</span><strong>{review.quotedAt}</strong></div>
      <div className="detail-row"><span>SuperTab expiration</span><strong>{review.expiresAt}{expired ? " · expired" : ""}</strong></div>
      <div className="detail-row"><span>Provider block height</span><strong>{review.lastValidBlockHeight == null ? "Not reported on this response" : `Valid through block height ${review.lastValidBlockHeight}`}</strong></div>
      <div className="detail-row"><span>Recorded tee comparison</span><strong>{review.coverage.minimumCoversRecordedTotal ? "Minimum meets the recorded $55.53" : "Minimum is below the recorded $55.53"}</strong></div>
      <p>{review.coverage.note}</p>
      <div className="detail-row"><span>Balance check</span><strong>{review.balance.status.replaceAll("_", " ")}</strong></div>
      <p>{review.balance.detail}{review.balance.usdcBalanceDisplay ? ` Mainnet USDC balance remains ${review.balance.usdcBalanceDisplay}.` : ""}</p>
      <div className="detail-row"><span>Transaction check</span><strong>{review.validation.status.replaceAll("_", " ")}</strong></div>
      <p>{review.validation.explanation}</p>
      <p>{review.validation.limits}</p>
      {expired && <p>Request a new quote. The expired figures stay visible so they are not mistaken for a fresh route.</p>}
    </article>}
  </section>;
}
