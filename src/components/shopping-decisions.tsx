"use client";

import { useSyncExternalStore } from "react";
import { requirementMessage, type RequirementChange } from "@/lib/constraints";
import { merchantHandoffLinks } from "@/lib/offers";
import { addToShortlist, clearShortlist, itemPriceNote, loadShortlist, removeFromShortlist, type ShortlistItem } from "@/lib/shortlist";
import type { ConstraintView, OfferView } from "@/lib/view";

const COLORS = ["black", "navy", "white", "blue", "gray", "red", "green", "brown"];
const SIZES = ["s", "m", "l", "xl", "42"];

export function RequirementControls({ constraints, disabled, onApply }: {
  constraints: ConstraintView;
  disabled: boolean;
  onApply: (message: string) => void;
}) {
  function apply(change: RequirementChange) {
    onApply(requirementMessage(change));
  }
  return <div className="requirement-controls" aria-label="Requirements">
    <p className="eyebrow">Requirements</p>
    <div className="requirement-row">
      <span>Budget</span>
      <form onSubmit={(event) => {
        event.preventDefault();
        const dollars = String(new FormData(event.currentTarget).get("budget") ?? "").trim();
        if (!/^\d{1,5}(\.\d{1,2})?$/.test(dollars)) return;
        apply({ kind: "set-budget", dollars });
      }}>
        <label className="sr-only" htmlFor="budget">Maximum budget in dollars</label>
        <input id="budget" name="budget" inputMode="decimal" placeholder={constraints.maxPriceCents ? centsLabel(constraints.maxPriceCents) : "USD"} disabled={disabled} />
        <button type="submit" className="secondary" disabled={disabled}>Set budget</button>
      </form>
      {constraints.maxPriceCents && <button type="button" className="secondary" disabled={disabled} onClick={() => apply({ kind: "clear-budget" })}>Remove budget</button>}
    </div>
    <div className="requirement-row">
      <span>Color</span>
      {constraints.colors.map((color) => <button type="button" key={color} className="secondary" disabled={disabled} onClick={() => apply(constraints.colors.length === 1 ? { kind: "clear-colors" } : { kind: "remove-color", color })}>Remove {color}</button>)}
      <label className="sr-only" htmlFor="add-color">Add a color</label>
      <select id="add-color" disabled={disabled} defaultValue="" onChange={(event) => { if (event.target.value) { apply({ kind: "add-color", color: event.target.value }); event.target.value = ""; } }}>
        <option value="">Add a color</option>
        {COLORS.filter((color) => !constraints.colors.includes(color)).map((color) => <option key={color} value={color}>{color}</option>)}
      </select>
      {constraints.colors.length > 0 && <button type="button" className="secondary" disabled={disabled} onClick={() => apply({ kind: "clear-colors" })}>Remove all colors</button>}
    </div>
    <div className="requirement-row">
      <span>Size</span>
      {constraints.sizes.map((size) => <button type="button" key={size} className="secondary" disabled={disabled} onClick={() => apply(constraints.sizes.length === 1 ? { kind: "clear-sizes" } : { kind: "remove-size", size })}>Remove size {size}</button>)}
      <label className="sr-only" htmlFor="add-size">Add a size</label>
      <select id="add-size" disabled={disabled} defaultValue="" onChange={(event) => { if (event.target.value) { apply({ kind: "add-size", size: event.target.value }); event.target.value = ""; } }}>
        <option value="">Add a size</option>
        {SIZES.filter((size) => !constraints.sizes.includes(size)).map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
    </div>
    <div className="requirement-row">
      <span>Condition</span>
      <label className="sr-only" htmlFor="condition">Condition</label>
      <select id="condition" disabled={disabled} value={constraints.condition} onChange={(event) => apply({ kind: "condition", condition: event.target.value as ConstraintView["condition"] })}>
        <option value="any">Any condition</option>
        <option value="new">New</option>
        <option value="used">Used</option>
      </select>
      <label className="sr-only" htmlFor="ship-country">Shipping country</label>
      <select id="ship-country" disabled={disabled} value={constraints.shipToCountry ?? ""} onChange={(event) => { if (event.target.value === "US" || event.target.value === "TH" || event.target.value === "GB") apply({ kind: "ship", country: event.target.value }); }}>
        <option value="">Destination filter</option>
        <option value="US">Search US listings</option>
        <option value="TH">Search Thailand listings</option>
        <option value="GB">Search UK listings</option>
      </select>
      <p className="section-copy">A destination filters the search. It does not confirm that an item can be delivered.</p>
    </div>
  </div>;
}

export function emptyStateActions(constraints: ConstraintView): { label: string; message: string }[] {
  const actions: { label: string; message: string }[] = [];
  if (constraints.colors.length > 0) actions.push({ label: "Remove color requirement", message: requirementMessage({ kind: "clear-colors" }) });
  if (constraints.sizes.length > 0) actions.push({ label: "Remove size requirement", message: requirementMessage({ kind: "clear-sizes" }) });
  if (constraints.maxPriceCents) actions.push({ label: "Remove budget", message: requirementMessage({ kind: "clear-budget" }) });
  if (constraints.condition !== "any") actions.push({ label: "Remove condition requirement", message: requirementMessage({ kind: "condition", condition: "any" }) });
  return actions;
}

export function EvidenceList({ evidence }: { evidence: OfferView["evidence"] }) {
  if (!evidence?.length) return null;
  return <ul className="match-evidence">{evidence.filter((item) => item.attribute !== "availability" || item.status !== "confirmed").map((item) => <li key={item.attribute} data-status={item.status}>{item.detail}</li>)}</ul>;
}

export function toShortlistItem(offer: OfferView, savedAt: string): ShortlistItem {
  return {
    id: offer.id,
    source: offer.source,
    sourceItemId: offer.sourceItemId,
    merchant: offer.merchant,
    title: offer.title,
    variantLabel: offer.variantLabel,
    condition: offer.condition,
    availability: offer.availability,
    priceDisplay: offer.priceDisplay,
    priceMinor: offer.priceMinor,
    currency: offer.currency,
    shippingDisplay: offer.shippingDisplay,
    shippingSummary: offer.shippingSummary,
    productUrl: offer.productUrl,
    merchantCartUrl: offer.merchantCartUrl,
    merchantReviewUrl: offer.merchantReviewUrl,
    verifiedAt: offer.verifiedAt,
    savedAt,
  };
}

const EMPTY: ShortlistItem[] = [];
function subscribeShortlist(onChange: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === "supertab.shortlist.v1" || event.key === null) onChange(); };
  window.addEventListener("supertab-shortlist", onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("supertab-shortlist", onChange);
    window.removeEventListener("storage", onStorage);
  };
}
function browserStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}
function shortlistSnapshot() {
  const storage = browserStorage();
  return storage ? loadShortlist(storage) : EMPTY;
}
function shortlistServer() { return EMPTY; }

export function ShortlistPanel({ currentIds, onReview, onRefind }: {
  currentIds: ReadonlySet<string>;
  onReview: (id: string) => void;
  onRefind: (title: string) => void;
}) {
  const items = useSyncExternalStore(subscribeShortlist, shortlistSnapshot, shortlistServer);
  if (items.length === 0) return null;
  const prices = items.map((item) => BigInt(item.priceMinor ?? "0"));
  const lowest = itemPriceNote(items).startsWith("Lowest") ? prices.reduce((min, value, index) => value < prices[min]! ? index : min, 0) : -1;
  return <section id="shortlist" className="shortlist" aria-label="Shortlist" tabIndex={-1}>
    <div className="results-heading"><h2>Shortlist</h2><span>{items.length} of 4 · saved in this browser</span><button className="secondary" type="button" onClick={() => { const storage = browserStorage(); if (!storage) return; if (clearShortlist(storage).length > 0) return; window.dispatchEvent(new Event("supertab-shortlist")); }}>Clear shortlist</button></div>
    <p className="section-copy">Dated browser snapshots stay here across searches and refreshes. They are not live merchant totals and do not restore a funding plan or an approval.</p>
    <div className="product-grid">{items.map((item, index) => {
      const current = currentIds.has(item.id);
      return <article key={item.id} className="product-card shortlist-card">
        <div className="product-info">
          <p className="merchant">{item.merchant ?? item.source} · {item.source === "shopify" ? "Shopify" : "eBay"}</p>
          <h3>{item.title}</h3>
          <p className="variant">{item.variantLabel ?? "Variant not specified"}{item.condition ? ` · ${item.condition}` : ""} · {item.availability === "in_stock" ? "In stock" : item.availability === "out_of_stock" ? "Out of stock" : "Stock not returned"}</p>
          <p className="product-price"><strong>{item.priceDisplay ?? "Price unknown"}</strong>{lowest === index && <span>Lowest item price, not delivered cost</span>}</p>
          <p className="price-note">Shipping {item.shippingDisplay ?? "not returned"} · tax not returned{item.shippingSummary ? ` · ${item.shippingSummary}` : ""}</p>
          <p className="price-note">Snapshot from {item.verifiedAt || "an unknown time"}. Saved {item.savedAt}.</p>
          {current ? <button className="primary" type="button" onClick={() => onReview(item.id)}>Review this result</button> : <p className="inline-error">Not in this search, so it cannot reopen the funding review.</p>}
          {!current && <button className="secondary" type="button" onClick={() => onRefind(item.title)}>Look for this product again</button>}
          <MerchantHandoffLinks productUrl={item.productUrl} cartUrl={item.merchantCartUrl} otherUrl={item.merchantReviewUrl} />
          <button className="secondary" type="button" onClick={() => { const storage = browserStorage(); if (!storage) return; removeFromShortlist(storage, item.id); window.dispatchEvent(new Event("supertab-shortlist")); }}>Remove from shortlist</button>
        </div>
      </article>;
    })}</div>
    <p className="section-copy" role="status">{itemPriceNote(items)}</p>
  </section>;
}

export function MerchantHandoffLinks({ productUrl, cartUrl, otherUrl }: {
  productUrl?: string | null;
  cartUrl?: string | null;
  otherUrl?: string | null;
}) {
  const links = merchantHandoffLinks({ productUrl, cartUrl, otherUrl });
  if (links.length === 0) return null;
  return <>{links.map((link) => <a className="merchant-handoff" key={`${link.kind}:${link.href}`} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>)}</>;
}

export function saveOffer(offer: OfferView): string {
  const storage = browserStorage();
  if (!storage) return "This browser could not save the shortlist.";
  const result = addToShortlist(storage, toShortlistItem(offer, new Date().toISOString()), new Date().toISOString());
  window.dispatchEvent(new Event("supertab-shortlist"));
  return result.notice;
}

function centsLabel(cents: string): string {
  const value = BigInt(cents);
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}
