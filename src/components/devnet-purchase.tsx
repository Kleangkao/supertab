"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DevnetCheckout, DevnetMerchantOrder } from "@/lib/devnet-merchant-client";
import { devnetPaymentBlock, signedPaymentSignature } from "@/lib/devnet-payment";
import { connectStandardWallet, discoverStandardWallets, signDevnetTransfer, supportsDevnetSigning, watchStandardWallet, type StandardWallet, type StandardWalletAccount } from "@/lib/wallet-standard";

interface PostedProduct {
  name: string;
  label: string;
  quantity: number;
  itemMinor: string;
  shippingMinor: string;
  taxMinor: string;
  totalMinor: string;
  mint: string;
  network: "solana:devnet";
  separation: string;
}

type ConfirmResult =
  | { kind: "order"; order: DevnetMerchantOrder }
  | { kind: "pending" }
  | { kind: "payment_recorded" }
  | { kind: "unapplied"; reason: string };

export function DevnetPurchase() {
  const [product, setProduct] = useState<PostedProduct | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<DevnetCheckout | null>(null);
  const [approvedId, setApprovedId] = useState<string | null>(null);
  const [signedTransaction, setSignedTransaction] = useState<string | null>(null);
  const [order, setOrder] = useState<DevnetMerchantOrder | null>(null);
  const [merchantNote, setMerchantNote] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");
  const [refundTransaction, setRefundTransaction] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [devnetCapable, setDevnetCapable] = useState(false);
  const [wallets, setWallets] = useState<StandardWallet[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const wallet = useRef<StandardWallet | null>(null);
  const account = useRef<StandardWalletAccount | null>(null);
  const stopWatch = useRef<(() => void) | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    void loadProduct();
    return () => { window.clearInterval(timer); stopWatch.current?.(); };
  }, []);

  const block = devnetPaymentBlock({
    terms: checkout ? { ...checkout, checkoutId: checkout.id } : null,
    connectedAddress: address,
    devnetCapable,
    approvedCheckoutId: approvedId,
    now,
  });

  function clearReview() {
    setCheckout(null);
    setApprovedId(null);
    setSignedTransaction(null);
    setMerchantNote(null);
  }

  function disconnect() {
    stopWatch.current?.();
    stopWatch.current = null;
    wallet.current = null;
    account.current = null;
    setAddress(null);
    setDevnetCapable(false);
    clearReview();
  }

  async function loadProduct() {
    const response = await fetch("/api/devnet-merchant/product", { cache: "no-store" });
    const body = await response.json() as PostedProduct & { error?: string };
    if (!response.ok) { setProduct(null); setProductError(body.error ?? "The local devnet merchant is not running."); return; }
    setProductError(null);
    setProduct(body);
  }

  async function connect(chosen?: StandardWallet) {
    const found = discoverStandardWallets(window);
    if (!chosen && found.length > 1) { setWallets([...found]); return; }
    const selected = chosen ?? found[0];
    if (!selected) { setError("No Solana wallet extension was found. Connect one in this browser before reviewing the test product."); return; }
    setWallets([]);
    setBusy(`Connecting ${selected.name}…`);
    setError(null);
    try {
      const connected = await connectStandardWallet(selected);
      wallet.current = selected;
      account.current = connected.account;
      setAddress(connected.address);
      setDevnetCapable(supportsDevnetSigning(selected, connected.address, connected.account));
      stopWatch.current?.();
      stopWatch.current = watchStandardWallet(selected, disconnect);
      clearReview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The wallet did not connect.");
    } finally { setBusy(null); }
  }

  async function review() {
    if (!address) { setError("Connect the wallet that will pay before requesting a checkout."); return; }
    setBusy("Asking the devnet merchant for a checkout…");
    setError(null);
    try {
      const response = await fetch("/api/devnet-merchant/checkout", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ buyer: address }),
      });
      const body = await response.json() as DevnetCheckout & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The devnet merchant did not open a checkout.");
      setCheckout(body);
      setApprovedId(null);
      setSignedTransaction(null);
      setOrder(null);
      setRefundTransaction(null);
      setMerchantNote(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The devnet merchant did not open a checkout.");
    } finally { setBusy(null); }
  }

  async function sign() {
    if (!checkout || !wallet.current || block) { setError(block ?? "Review and approve the checkout before signing."); return; }
    setBusy("Waiting for your wallet to sign this devnet payment…");
    setError(null);
    try {
      const signed = await signDevnetTransfer(wallet.current, checkout.buyer, checkout.transaction, account.current ?? undefined);
      if (signedPaymentSignature(signed) === null) throw new Error("The wallet did not return a devnet signature.");
      setSignedTransaction(signed);
      setMerchantNote("Signed locally. The payment has not been sent and the merchant has not confirmed an order.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The wallet did not sign.");
    } finally { setBusy(null); }
  }

  async function send() {
    if (!checkout || !signedTransaction) return;
    const signature = signedPaymentSignature(signedTransaction);
    if (!signature) { setError("The signed payment has no signature."); return; }
    setBusy("Sending the signed payment on devnet…");
    setError(null);
    try {
      const broadcast = await fetch("/api/devnet-merchant/broadcast", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signedTransaction }),
      });
      const sent = await broadcast.json() as { signature?: string; error?: string };
      if (!broadcast.ok || !sent.signature) throw new Error(sent.error ?? "Devnet rejected the signed payment.");
      if (sent.signature !== signature) throw new Error("Devnet returned a different signature. It was not submitted to the merchant.");
      await submit(signature);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Devnet rejected the signed payment.");
    } finally { setBusy(null); }
  }

  async function submit(signature: string) {
    if (!checkout) return;
    setBusy("Asking the merchant to validate the payment…");
    setError(null);
    try {
      const response = await fetch("/api/devnet-merchant/confirm", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ checkoutId: checkout.id, signature }),
      });
      const body = await response.json() as { kind?: ConfirmResult["kind"]; order?: DevnetMerchantOrder; reason?: string; error?: string };
      if (!response.ok && body.kind !== "order" && body.kind !== "pending" && body.kind !== "payment_recorded" && body.kind !== "unapplied") {
        throw new Error(body.error ?? "The merchant rejected the payment.");
      }
      showMerchant(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The merchant could not be reached.");
    } finally { setBusy(null); }
  }

  async function recover() {
    setBusy("Asking the merchant to recover a recorded payment…");
    setError(null);
    try {
      const response = await fetch("/api/devnet-merchant/recover", { method: "POST" });
      const body = await response.json() as { orders?: DevnetMerchantOrder[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "The merchant could not recover an order.");
      const found = checkout ? body.orders?.find((item) => item.checkoutId === checkout.id) ?? null : null;
      setOrder(found);
      setMerchantNote(found
        ? "The merchant recovered this order from a payment it had already validated."
        : body.orders?.length
          ? "The merchant recovered an order for a different checkout. It is not this purchase."
          : "The merchant did not create an order.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The merchant could not recover an order.");
    } finally { setBusy(null); }
  }

  async function readOrder(event: FormEvent) {
    event.preventDefault();
    setBusy("Reading the order from the merchant…");
    setError(null);
    try {
      const response = await fetch(`/api/devnet-merchant/order?id=${encodeURIComponent(orderId.trim())}`, { cache: "no-store" });
      const body = await response.json() as DevnetMerchantOrder & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The merchant has no order with that id.");
      setOrder(body);
      setMerchantNote("This order was read from the merchant. SuperTab did not create it.");
    } catch (caught) {
      setOrder(null);
      setError(caught instanceof Error ? caught.message : "The merchant order could not be read.");
    } finally { setBusy(null); }
  }

  async function prepareRefund() {
    if (!order || order.status !== "paid") return;
    setBusy("Asking the merchant to prepare the refund…");
    setError(null);
    try {
      const response = await fetch("/api/devnet-merchant/refund-transaction", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: order.id }),
      });
      const body = await response.json() as { transaction?: string; totalMinor?: string; error?: string };
      if (!response.ok || !body.transaction || !body.totalMinor) throw new Error(body.error ?? "The merchant did not prepare a refund.");
      setRefundTransaction(body.transaction);
      setMerchantNote(`Refund prepared for ${usdc(body.totalMinor)} back to the buyer. It has not been signed or sent.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The merchant did not prepare a refund.");
    } finally { setBusy(null); }
  }

  async function signRefund() {
    if (!order || !refundTransaction || !wallet.current || !address) return;
    setBusy("Waiting for your wallet to sign this devnet refund…");
    setError(null);
    try {
      const signed = await signDevnetTransfer(wallet.current, address, refundTransaction, account.current ?? undefined);
      setBusy("Sending the signed refund on devnet…");
      const response = await fetch("/api/devnet-merchant/refund-submit", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: order.id, signedTransaction: signed }),
      });
      const body = await response.json() as DevnetMerchantOrder & { error?: string };
      if (!response.ok || body.status !== "refunded") throw new Error(body.error ?? "The refund was not confirmed.");
      setOrder(body);
      setRefundTransaction(null);
      setMerchantNote("The merchant confirmed the refund after the return transfer.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The refund was not confirmed.");
    } finally { setBusy(null); }
  }

  function showMerchant(body: { kind?: ConfirmResult["kind"]; order?: DevnetMerchantOrder; reason?: string; error?: string }) {
    if (body.kind === "order" && body.order) {
      setOrder(body.order);
      setMerchantNote("The merchant confirmed this order.");
      return;
    }
    setOrder(null);
    if (body.kind === "pending") setMerchantNote("The merchant has not seen this signature on devnet yet. No order was created.");
    else if (body.kind === "payment_recorded") setMerchantNote("The merchant recorded the payment. It has not created an order.");
    else if (body.kind === "unapplied") setMerchantNote(`The merchant rejected the payment (${body.reason ?? "rejected"}). No order was created.`);
    else setMerchantNote(body.error ?? "The merchant did not confirm an order.");
  }

  return <main className="app-shell">
    <nav className="topbar" aria-label="Main navigation">
      <Link className="wordmark" href="/" aria-label="SuperTab home"><span className="brand-icon">s<span>↗</span></span>SuperTab<span className="beta">DEVNET</span></Link>
      <Link href="/">Back to shopping</Link>
    </nav>
    <section className="workspace">
      <header className="hero compact">
        <p className="eyebrow">DEVNET · owner-controlled</p>
        <h1>Devnet test marker</h1>
        <p className="hero-copy">{product?.label ?? "This page buys one labeled test marker from the local merchant. It is not a product from another retailer."}</p>
      </header>
      {productError && <div className="notice warning" role="alert">{productError}</div>}
      {product && <div className="notice subtle">
        <p>{product.separation}</p>
        <p>Network {product.network} · Circle devnet USDC · mint {product.mint}</p>
        <p>Quantity {product.quantity} · Item {usdc(product.itemMinor)} · Shipping {usdc(product.shippingMinor)} · Tax {usdc(product.taxMinor)} · Total {usdc(product.totalMinor)}</p>
      </div>}
      <div className="wallet-actions">
        <button className="secondary" disabled={!!busy} onClick={() => void connect()}>{address ? "Reconnect wallet" : "Connect wallet"}</button>
        {address && <button className="secondary" disabled={!!busy} onClick={disconnect}>Disconnect</button>}
      </div>
      {wallets.length > 0 && <div className="wallet-options" aria-label="Choose a wallet">{wallets.map((item, index) => <button key={index} disabled={!!busy} onClick={() => void connect(item)}>Connect {item.name}</button>)}</div>}
      {address && <p className="mono">{address}</p>}
      {address && !devnetCapable && <div className="notice warning" role="status">This wallet account is not on Solana devnet. No payment was requested.</div>}
      <div className="wallet-actions">
        <button className="primary" disabled={!!busy || !address} onClick={() => void review()}>Review merchant checkout</button>
        {checkout && <button className="secondary" disabled={!!busy} onClick={clearReview}>Cancel review</button>}
      </div>
      {checkout && <section className="notice subtle" aria-label="Merchant checkout total">
        <strong>{checkout.productName}</strong>
        <p>{checkout.label}</p>
        <p>Quantity {checkout.quantity} · Item {usdc(checkout.itemMinor)} · Shipping {usdc(checkout.shippingMinor)} · Tax {usdc(checkout.taxMinor)}</p>
        <p className="checkout-total">Total {usdc(checkout.totalMinor)} · {checkout.network} · Circle devnet USDC</p>
        <p>Buyer {checkout.buyer}</p>
        <p>Merchant recipient {checkout.recipient}</p>
        <p>Payment reference {checkout.reference}</p>
        <p>Mint {checkout.mint}</p>
        <p>Expires {checkout.expiresAt}</p>
        <button className="secondary" disabled={!!busy || approvedId === checkout.id} onClick={() => setApprovedId(checkout.id)}>
          {approvedId === checkout.id ? "Purchase approved" : `Approve this purchase · ${usdc(checkout.totalMinor)}`}
        </button>
        <p>{approvedId === checkout.id ? "Approval covers only this checkout. It has not signed or sent a transaction." : "Approval is required before the wallet is asked to sign."}</p>
        <button className="primary" disabled={!!busy || !!block} onClick={() => void sign()}>Sign devnet payment</button>
        {block && <p>{block}</p>}
        {signedTransaction && <>
          <p>The wallet signed this payment. It is still on this device.</p>
          <button className="primary" disabled={!!busy} onClick={() => void send()}>Send signed payment on devnet</button>
          <button className="secondary" disabled={!!busy || !signedPaymentSignature(signedTransaction)} onClick={() => void submit(signedPaymentSignature(signedTransaction) ?? "")}>Ask the merchant about this signature</button>
        </>}
        <button className="secondary" disabled={!!busy} onClick={() => void recover()}>Ask the merchant to recover an order</button>
      </section>}
      {merchantNote && <div className="notice subtle" role="status">{merchantNote}</div>}
      {order && <OrderDetails order={order} />}
      {order?.status === "paid" && <section className="notice subtle" aria-label="Devnet refund">
        <strong>Refund this devnet payment</strong>
        <p>Return {usdc(order.totalMinor)} Circle devnet USDC from the owner-controlled merchant to the buyer. This is not a retailer return.</p>
        <button className="secondary" disabled={!!busy} onClick={() => void prepareRefund()}>Prepare refund</button>
        <button className="primary" disabled={!!busy || !refundTransaction || !address} onClick={() => void signRefund()}>Sign and send refund</button>
      </section>}
      {busy && <div className="loading-note" role="status"><span className="spinner" />{busy}</div>}
      {error && <div className="notice warning" role="alert">{error}</div>}
      <form className="address-form" onSubmit={event => void readOrder(event)}>
        <label htmlFor="merchant-order-id">Merchant order id</label>
        <input id="merchant-order-id" value={orderId} onChange={event => setOrderId(event.target.value)} maxLength={80} disabled={!!busy} placeholder="Order id from the merchant" />
        <button className="secondary" disabled={!!busy || !orderId.trim()}>Read merchant order</button>
      </form>
    </section>
  </main>;
}

function OrderDetails({ order }: { order: DevnetMerchantOrder }) {
  return <section className="notice subtle" aria-label="Merchant order">
    <strong>Merchant order {order.id}</strong>
    <p>Status {order.status} · Settlement {order.settlement} · Total {usdc(order.totalMinor)}</p>
    <p>Payment {order.paymentSignature}</p>
    <p>Refund {order.refundSignature ?? "none"}</p>
    <p>{order.separation}</p>
  </section>;
}

function usdc(minor: string): string {
  const value = BigInt(minor);
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${fraction} USDC`;
}
