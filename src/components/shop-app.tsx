"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { HealthView, OfferView, SessionView } from "@/lib/view";

const EMPTY_HEALTH: HealthView = {
  gemini: "not_configured",
  geminiModel: "gemini-3.5-flash-lite",
  shopify: "not_configured",
  ebay: "not_configured",
  solana: "unavailable",
  dflow: "unavailable",
  cardRail: "not_connected",
  financialExecution: "disabled",
};

export function ShopApp() {
  const [health, setHealth] = useState<HealthView>(EMPTY_HEALTH);
  const [session, setSession] = useState<SessionView | null>(null);
  const [draft, setDraft] = useState("Find me black running shoes, size 42, under $120.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletMode, setWalletMode] = useState<"none" | "sample" | "address">("none");
  const [address, setAddress] = useState("");
  const [fundingMint, setFundingMint] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/health").then(async (response) => {
      if (response.ok) setHealth(await response.json() as HealthView);
    }).catch(() => undefined);
  }, []);

  async function search(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/shop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session?.sessionId, message: draft }),
      });
      const body = await response.json() as SessionView & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Search failed.");
      setSession(body);
      setDraft("");
      setFundingMint(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  async function selectOffer(offerId: string, mode = walletMode, nextAddress = address, mint = fundingMint) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          offerId,
          walletMode: mode,
          address: nextAddress,
          fundingMint: mint,
        }),
      });
      const body = await response.json() as SessionView & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not open the purchase review.");
      setSession(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open the purchase review.");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/purchase/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      const body = await response.json() as SessionView & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Approval was not recorded.");
      setSession(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Approval was not recorded.");
    } finally {
      setBusy(false);
    }
  }

  const purchase = session?.purchase;

  return (
    <main className="mx-auto grid min-h-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6">
      <section>
        <header className="mb-6">
          <p className="text-sm font-medium text-[#0f6e56]">SuperTab</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">What do you want to buy?</h1>
          <p className="mt-2 max-w-xl text-stone-600">
            Find a real product, then see whether the Solana assets you already hold can cover it. Merchants are paid by card, not by cryptocurrency.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Status label="Shopping assistant" value={health.gemini} />
            <Status label="Gemini model" value={health.geminiModel} />
            <Status label="Shopify" value={health.shopify} />
            <Status label="eBay" value={health.ebay} />
            <Status label="Solana" value={health.solana} />
            <Status label="DFlow" value={health.dflow} />
            <Status label="Payment card" value={health.cardRail} />
          </div>
        </header>

        <form onSubmit={search} className="rounded-3xl border border-[#e4d9c8] bg-[#fffdf8] p-3 shadow-sm">
          <label className="sr-only" htmlFor="request">Shopping request</label>
          <textarea
            id="request"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder="Find me a black polo under $50."
            className="w-full resize-none bg-transparent px-3 py-2 text-lg outline-none placeholder:text-stone-400"
          />
          <div className="flex items-center justify-between gap-3 px-2 pb-1">
            <p className="text-sm text-stone-500">Follow-ups keep your earlier requirements.</p>
            <button
              type="submit"
              disabled={busy || draft.trim().length === 0}
              className="rounded-full bg-[#0f6e56] px-4 py-2 text-sm font-medium text-[#f4fff9] disabled:opacity-50"
            >
              {busy && draft.trim().length > 0 ? "Looking…" : "Search"}
            </button>
          </div>
        </form>

        {error ? <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p> : null}

        {session ? (
          <div className="mt-6 space-y-4">
            <p className="text-stone-800">{session.assistantMessage}</p>
            <p className="text-sm text-stone-500">Requirements: {session.constraintsLabel}</p>
            <div className="flex flex-wrap gap-2 text-xs text-stone-500">
              {session.providers.map((provider) => (
                <span key={provider.provider} className="rounded-full bg-white px-3 py-1">
                  {provider.provider}: {provider.status}{provider.message ? ` — ${provider.message}` : ""}
                </span>
              ))}
            </div>
            {session.exact.length > 0 ? (
              <div className="grid gap-3">
                {session.exact.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} disabled={busy} onSelect={() => selectOffer(offer.id)} />
                ))}
              </div>
            ) : null}
            {session.excluded.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-lg font-medium">These miss a requirement</h2>
                {session.excluded.map((item) => (
                  <OfferCard key={item.offer.id} offer={item.offer} reasons={item.reasons} disabled />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <aside className="h-fit rounded-3xl border border-[#e4d9c8] bg-[#fffdf8] p-5 lg:sticky lg:top-6">
        <h2 className="text-lg font-semibold">Purchase review</h2>
        {!purchase ? (
          <p className="mt-3 text-sm text-stone-600">Select a product to see the price we actually know, your spending assets, and whether a conversion is needed.</p>
        ) : (
          <div className="mt-4 space-y-5 text-sm">
            <Block title="Product">
              <Row label="Merchant" value={purchase.product.merchant ?? "Unknown"} />
              <Row label="Product" value={purchase.product.title} />
              <Row label="Variant" value={purchase.product.variant ?? "Not specified"} />
              <Row label="Quantity" value={String(purchase.checkout.quantity)} />
              <Row label="Source" value={purchase.product.source} />
            </Block>
            <Block title="Checkout">
              <Row label="Item price" value={purchase.checkout.itemDisplay ? `${purchase.checkout.itemDisplay} ${purchase.checkout.itemKind ?? ""}` : "Unknown"} />
              <Row label="Shipping" value={purchase.checkout.shippingDisplay ?? "Unknown"} />
              <Row label="Tax" value={purchase.checkout.taxDisplay ?? "Unknown"} />
              <Row label="Discount" value={purchase.checkout.discountDisplay ?? "None reported"} />
              <Row label="Merchant total" value={purchase.checkout.merchantTotalDisplay ?? "Not available yet"} />
              <Row label="Currency" value={purchase.checkout.currency ?? "Unknown"} />
              <p className="mt-2 text-stone-500">{purchase.checkout.note}</p>
            </Block>
            <Block title="Your spending assets">
              <div className="mb-3 flex flex-wrap gap-2">
                <button type="button" className={chip(walletMode === "sample")} onClick={() => { setWalletMode("sample"); const id = selectedId(session); if (id) void selectOffer(id, "sample", address, fundingMint); }}>Sample preview</button>
                <button type="button" className={chip(walletMode === "address")} onClick={() => setWalletMode("address")}>Use an address</button>
              </div>
              {walletMode === "sample" ? <p className="mb-2 text-amber-800">Sample preview. These are not your assets.</p> : null}
              {walletMode === "address" ? (
                <form className="mb-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); const id = selectedId(session); if (id) void selectOffer(id, "address", address, fundingMint); }}>
                  <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Solana address" className="min-w-0 flex-1 rounded-xl border border-[#e4d9c8] px-3 py-2" />
                  <button className="rounded-xl bg-stone-900 px-3 py-2 text-white" type="submit">Look up</button>
                </form>
              ) : null}
              {purchase.balanceError ? <p className="text-amber-800">{purchase.balanceError}</p> : null}
              {purchase.assets.length === 0 ? <p className="text-stone-500">No spending assets loaded.</p> : (
                <ul className="space-y-1">
                  {purchase.assets.map((asset) => (
                    <li key={asset.mint} className="flex items-center justify-between gap-3">
                      <span>{asset.symbol ?? "Token"}{asset.isUsdc ? "" : ""}</span>
                      <span>{asset.amountDisplay}</span>
                    </li>
                  ))}
                </ul>
              )}
              {purchase.assets.some((asset) => !asset.isUsdc && asset.kind !== "native") ? (
                <label className="mt-3 block text-stone-600">
                  Funding asset
                  <select
                    className="mt-1 w-full rounded-xl border border-[#e4d9c8] bg-white px-3 py-2"
                    value={fundingMint ?? ""}
                    onChange={(event) => {
                      const mint = event.target.value || null;
                      setFundingMint(mint);
                      const id = selectedId(session);
                      if (id) void selectOffer(id, walletMode, address, mint);
                    }}
                  >
                    <option value="">Suggest SOL if it can help</option>
                    {purchase.assets.filter((asset) => !asset.isUsdc).map((asset) => (
                      <option key={asset.mint} value={asset.mint}>{asset.symbol ?? asset.mint}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </Block>
            <Block title="Funding">
              {purchase.funding ? (
                <>
                  <Row label="Planning amount" value={purchase.funding.planningDisplay ?? "Unknown"} />
                  <Row label="Existing USDC" value={purchase.funding.existingUsdc} />
                  <Row label="USDC to use" value={purchase.funding.usdcUsed} />
                  <Row label="Still needed" value={purchase.funding.deficit} />
                  <Row label="Funding asset" value={purchase.funding.candidateSymbol ?? "None selected"} />
                  <Row label="DFlow quote" value={quoteLabel(purchase.funding.quoteFreshness)} />
                  <Row label="Amount to convert" value={purchase.funding.requiredInput ?? "Not quoted"} />
                  <Row label="Expected USDC" value={purchase.funding.expectedOutput ?? "Not quoted"} />
                  <Row label="Price impact" value={purchase.funding.priceImpact ?? "Not reported"} />
                  <Row label="Slippage" value={purchase.funding.slippageBps == null ? "Not reported" : `${purchase.funding.slippageBps} bps`} />
                  <Row label="Fee" value={purchase.funding.platformFee ?? "Not reported"} />
                  <Row label="Quote expires" value={purchase.funding.quoteExpiresAt ?? "No live quote"} />
                  <ul className="mt-2 space-y-1 text-stone-500">
                    {purchase.funding.notes.slice(0, 4).map((note) => <li key={note}>{note}</li>)}
                  </ul>
                </>
              ) : <p>Funding has not been calculated.</p>}
            </Block>
            <Block title="Payment rail">
              <Row label="Status" value={purchase.cardRail.availability === "not_connected" ? "Provider not connected" : purchase.cardRail.availability} />
              <p className="mt-2 text-stone-600">{purchase.cardRail.message}</p>
            </Block>
            <Block title="Financial actions">
              <Row label="Payment" value="Not authorized" />
              <Row label="Order" value="Not created" />
              <Row label="Purchase state" value={purchase.state.replaceAll("_", " ").toLowerCase()} />
              {purchase.swapApproval ? <p className="mt-2 text-stone-600">Approval recorded {purchase.swapApproval.at}. Nothing was swapped.</p> : null}
              {purchase.state === "SWAP_QUOTE_READY" || purchase.state === "AWAITING_SWAP_APPROVAL" ? (
                <button type="button" onClick={() => void approve()} disabled={busy} className="mt-3 w-full rounded-full bg-stone-900 px-4 py-2 text-white disabled:opacity-50">
                  Approve conversion
                </button>
              ) : null}
              <p className="mt-2 text-stone-500">Approving records your intent only. SuperTab will not sign, swap, or pay.</p>
            </Block>
          </div>
        )}
      </aside>
    </main>
  );
}

function OfferCard({ offer, onSelect, disabled, reasons }: { offer: OfferView; onSelect?: () => void; disabled?: boolean; reasons?: string[] }) {
  return (
    <article className="flex gap-4 rounded-3xl border border-[#e4d9c8] bg-white p-4">
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-stone-100">
        {offer.imageUrl ? (
          // Merchant image hosts are unknown until search time, so this is not a next/image remote pattern.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium leading-snug">{offer.title}</h3>
          <p className="shrink-0 font-medium">{offer.priceDisplay ?? "Price unknown"}</p>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          {[offer.merchant ?? "Merchant unknown", offer.variantLabel, offer.condition, stockLabel(offer.availability), offer.source].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 text-sm text-stone-500">{offer.shippingSummary ?? "Shipping unknown"} · {offer.checkoutLabel}</p>
        {reasons ? <p className="mt-2 text-sm text-amber-800">{reasons.join(" ")}</p> : null}
        {onSelect ? (
          <button type="button" disabled={disabled} onClick={onSelect} className="mt-3 rounded-full border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-50">
            Select
          </button>
        ) : null}
      </div>
    </article>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return <span className="rounded-full bg-white px-3 py-1 text-stone-600">{label}: {value.replaceAll("_", " ")}</span>;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <section><h3 className="font-medium">{title}</h3><div className="mt-2 space-y-1">{children}</div></section>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <p className="flex justify-between gap-3"><span className="text-stone-500">{label}</span><span className="text-right">{value}</span></p>;
}

function chip(active: boolean): string {
  return `rounded-full px-3 py-1 ${active ? "bg-stone-900 text-white" : "bg-stone-100"}`;
}

function stockLabel(availability: OfferView["availability"]): string {
  if (availability === "in_stock") return "In stock";
  if (availability === "out_of_stock") return "Out of stock";
  return "Stock unknown";
}

function quoteLabel(freshness: string): string {
  if (freshness === "live") return "Live quote";
  if (freshness === "stale") return "Expired";
  if (freshness === "mismatched") return "Does not match this purchase";
  return "Not requested";
}

function selectedId(session: SessionView | null): string | null {
  return session?.selectedOfferId ?? null;
}
