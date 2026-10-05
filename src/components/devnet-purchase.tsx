"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { MerchantOrderRecord, usdc } from "@/components/merchant-order-record";
import type { DevnetCheckout, DevnetMerchantOrder } from "@/lib/devnet-merchant-client";
import { fetchDevnetMerchantOrder } from "@/lib/devnet-merchant-client";
import { VERIFIED_DEVNET_ORDER_ID, devnetCheckoutGuidance, isPreservedPaidOrder } from "@/lib/devnet-checkout-guidance";
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

export function DevnetPurchase({ initialOrderId = null }: { initialOrderId?: string | null }) {
  const [product, setProduct] = useState<PostedProduct | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<DevnetCheckout | null>(null);
  const [approvedId, setApprovedId] = useState<string | null>(null);
  const [signedTransaction, setSignedTransaction] = useState<string | null>(null);
  const [broadcastSignature, setBroadcastSignature] = useState<string | null>(null);
  const [blockhashRejected, setBlockhashRejected] = useState(false);
  const [checkoutOrder, setCheckoutOrder] = useState<DevnetMerchantOrder | null>(null);
  const [viewedOrder, setViewedOrder] = useState<DevnetMerchantOrder | null>(null);
  const [merchantNote, setMerchantNote] = useState<string | null>(null);
  const [orderId, setOrderId] = useState(initialOrderId ?? "");
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

  useEffect(() => {
    if (!initialOrderId) return;
    const controller = new AbortController();
    void fetchDevnetMerchantOrder(initialOrderId).then(body => {
      if (controller.signal.aborted) return;
      setViewedOrder(body);
      setMerchantNote("This order was read from the merchant. SuperTab did not create it.");
    }).catch(caught => {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "The merchant order could not be read.");
    });
    return () => controller.abort();
  }, [initialOrderId]);

  const expired = !!checkout && (blockhashRejected || (now > 0 && now >= Date.parse(checkout.expiresAt)));
  const block = devnetPaymentBlock({
    terms: checkout ? { ...checkout, checkoutId: checkout.id } : null,
    connectedAddress: address,
    devnetCapable,
    approvedCheckoutId: approvedId,
    now,
  });
  const guidance = devnetCheckoutGuidance({
    checkoutId: checkout?.id ?? null,
    signed: !!signedTransaction,
    broadcastSignature,
    orderCheckoutId: checkoutOrder?.checkoutId ?? null,
    orderStatus: checkoutOrder?.status ?? null,
    expired,
    blocked: !!block,
  });
  const localSignature = signedTransaction ? signedPaymentSignature(signedTransaction) : null;
  const preservedPaid = [checkoutOrder, viewedOrder].find(item => item?.status === "paid" && isPreservedPaidOrder(item.id)) ?? null;

  function refundableOrder() {
    return [checkoutOrder, viewedOrder].find(item => item?.status === "paid" && !isPreservedPaidOrder(item.id)) ?? null;
  }

  function clearUnsentReview() {
    if (broadcastSignature || checkoutOrder) return;
    setCheckout(null);
    setApprovedId(null);
    setSignedTransaction(null);
    setBlockhashRejected(false);
    setMerchantNote(null);
  }

  function disconnect() {
    stopWatch.current?.();
    stopWatch.current = null;
    wallet.current = null;
    account.current = null;
    setAddress(null);
    setDevnetCapable(false);
    clearUnsentReview();
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
      clearUnsentReview();
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
      setBroadcastSignature(null);
      setBlockhashRejected(false);
      setCheckoutOrder(null);
      setRefundTransaction(null);
      setMerchantNote("This is a new checkout. It does not recover an earlier payment.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The devnet merchant did not open a checkout.");
    } finally { setBusy(null); }
  }

  async function sign() {
    if (!checkout || !wallet.current || guidance.signDisabled) { setError(block ?? "Review and approve the checkout before signing."); return; }
    setBusy("Waiting for your wallet to sign this devnet payment…");
    setError(null);
    try {
      const signed = await signDevnetTransfer(wallet.current, checkout.buyer, checkout.transaction, account.current ?? undefined);
      if (signedPaymentSignature(signed) === null) throw new Error("The wallet did not return a devnet signature.");
      setSignedTransaction(signed);
      setMerchantNote(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The wallet did not sign.");
    } finally { setBusy(null); }
  }

  async function send() {
    if (!checkout || !signedTransaction || guidance.sendDisabled) return;
    if (checkoutOrder?.checkoutId === checkout.id) return;
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
      setBroadcastSignature(sent.signature);
      await submit(sent.signature);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Devnet rejected the signed payment.";
      if (/already submitted|already been processed|already processed/i.test(message)) {
        setBroadcastSignature(signature);
        setMerchantNote(null);
        setError(null);
      } else if (/blockhash.*(not found|expired|unavailable)/i.test(message)) {
        setBlockhashRejected(true);
        setError("This payment's blockhash is no longer usable. No payment was sent. Review a fresh checkout, then approve and sign again.");
      } else setError(message);
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
      if (found) setCheckoutOrder(found);
      setMerchantNote(found
        ? "The merchant recovered this order from a payment it had already validated."
        : body.orders?.length
          ? "The merchant recovered an order for a different checkout. It is not this purchase."
          : "The merchant did not create an order.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The merchant could not recover an order.");
    } finally { setBusy(null); }
  }

  async function readOrderId(id: string) {
    setBusy("Reading the order from the merchant…");
    setError(null);
    try {
      const body = await fetchDevnetMerchantOrder(id);
      setViewedOrder(body);
      if (checkout && body.checkoutId === checkout.id) setCheckoutOrder(body);
      setMerchantNote("This order was read from the merchant. SuperTab did not create it.");
    } catch (caught) {
      setViewedOrder(null);
      setError(caught instanceof Error ? caught.message : "The merchant order could not be read.");
    } finally { setBusy(null); }
  }

  async function readOrder(event: FormEvent) {
    event.preventDefault();
    await readOrderId(orderId.trim());
  }

  async function prepareRefund() {
    const refundOrder = refundableOrder();
    if (!refundOrder) return;
    setBusy("Asking the merchant to prepare the refund…");
    setError(null);
    try {
      const response = await fetch("/api/devnet-merchant/refund-transaction", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: refundableOrder()?.id }),
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
    if (!refundableOrder() || !refundTransaction || !wallet.current || !address) return;
    setBusy("Waiting for your wallet to sign this devnet refund…");
    setError(null);
    try {
      const signed = await signDevnetTransfer(wallet.current, address, refundTransaction, account.current ?? undefined);
      setBusy("Sending the signed refund on devnet…");
      const response = await fetch("/api/devnet-merchant/refund-submit", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: refundableOrder()?.id, signedTransaction: signed }),
      });
      const body = await response.json() as DevnetMerchantOrder & { error?: string };
      if (!response.ok || body.status !== "refunded") throw new Error(body.error ?? "The refund was not confirmed.");
      setCheckoutOrder(body);
      setViewedOrder(body);
      setRefundTransaction(null);
      setMerchantNote(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The refund was not confirmed.");
    } finally { setBusy(null); }
  }

  function showMerchant(body: { kind?: ConfirmResult["kind"]; order?: DevnetMerchantOrder; reason?: string; error?: string }) {
    if (body.kind === "order" && body.order) {
      setCheckoutOrder(body.order);
      setViewedOrder(body.order);
      setMerchantNote(null);
      return;
    }
    if (body.kind === "pending") setMerchantNote("The merchant has not confirmed an order for this signature yet. The signed payment stays available so you can ask again. Do not start a new checkout to recover it.");
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
        <p>The USDC total is the merchant price. Devnet SOL pays the network base fee separately. A wallet may add a priority fee up to 0.0001 devnet SOL. That fee does not change the USDC total.</p>
      </div>}
      <ol aria-label="Devnet purchase steps">
        <li>Connect Phantom on Solana devnet.</li>
        <li>Review the merchant total.</li>
        <li>Approve that exact total.</li>
        <li>Sign in Phantom.</li>
        <li>Send the signed payment.</li>
        <li>Read the merchant order.</li>
        <li>Refund only to return that payment.</li>
      </ol>
      <div className="wallet-actions">
        <button className="secondary" type="button" disabled={!!busy} onClick={() => void readOrderId(VERIFIED_DEVNET_ORDER_ID)}>View verified test order</button>
      </div>
      <p>View verified test order reads {VERIFIED_DEVNET_ORDER_ID} from the merchant. It does not sign, send, or assume a status. A new checkout is a separate 1.000000 USDC payment and does not recover this order.</p>
      <details className="review-details">
        <summary>Read a different merchant order</summary>
        <form className="address-form" onSubmit={event => void readOrder(event)}>
          <label htmlFor="merchant-order-id">Merchant order id</label>
          <input id="merchant-order-id" value={orderId} onChange={event => setOrderId(event.target.value)} maxLength={80} disabled={!!busy} placeholder="Order id from the merchant" />
          <button className="secondary" disabled={!!busy || !orderId.trim()}>Read merchant order</button>
        </form>
      </details>
      <div className="wallet-actions">
        <button className="secondary" disabled={!!busy} onClick={() => void connect()}>{address ? "Reconnect wallet" : "Connect wallet"}</button>
        {address && <button className="secondary" disabled={!!busy} onClick={disconnect}>Disconnect</button>}
      </div>
      {wallets.length > 0 && <div className="wallet-options" aria-label="Choose a wallet">{wallets.map((item, index) => <button key={index} disabled={!!busy} onClick={() => void connect(item)}>Connect {item.name}</button>)}</div>}
      {address && <p className="mono">{address}</p>}
      {address && !devnetCapable && <div className="notice warning" role="status">This wallet account is not on Solana devnet. No payment was requested.</div>}
      <p><strong>New test checkout</strong></p>
      <p>Use this only when you intend to pay again. It does not recover a payment that was already sent. Connect Phantom on Solana devnet before Review. After Review, approve, sign, and send within 60 seconds. If the countdown reaches zero before a send, use Review a fresh checkout. If a signature was already submitted, ask the merchant about it instead.</p>
      <div className="wallet-actions">
        <button className="primary" disabled={!!busy || !address} onClick={() => void review()}>Review merchant checkout</button>
        {checkout && <button className="secondary" disabled={!!busy || !!broadcastSignature || !!checkoutOrder} onClick={clearUnsentReview}>Cancel unsent review</button>}
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
        <p>Expires {checkout.expiresAt}{now > 0 ? ` · ${Math.max(0, Math.ceil((Date.parse(checkout.expiresAt) - now) / 1000))} seconds left` : ""}</p>
        {expired && <p>This checkout’s blockhash has expired. {broadcastSignature || checkoutOrder ? "A submitted payment stays with the merchant. Do not open another checkout to find it." : "No payment was sent from this checkout."}</p>}
        <p>Network fees are paid separately in devnet SOL. Approval allows wallet priority fees up to 0.0001 devnet SOL, plus the network base fee. The USDC total stays unchanged.</p>
        <button className="secondary" disabled={!!busy || approvedId === checkout.id || !!checkoutOrder} onClick={() => setApprovedId(checkout.id)}>
          {approvedId === checkout.id ? "Purchase approved" : `Approve this purchase · ${usdc(checkout.totalMinor)}`}
        </button>
        <p>{checkoutOrder?.checkoutId === checkout.id ? "This checkout already has a merchant order. Signing and sending stay off." : approvedId === checkout.id ? "Approval covers only this checkout. The next button asks the wallet to sign. It does not send." : "Approval is required before the wallet is asked to sign."}</p>
        <button className="primary" disabled={!!busy || guidance.signDisabled} onClick={() => void sign()}>Sign devnet payment</button>
        {block && !checkoutOrder && <p>{block}</p>}
        {guidance.paymentNote && <p>{guidance.paymentNote}</p>}
        {guidance.freshReview && <button className="secondary" disabled={!!busy || !address} onClick={() => void review()}>Review a fresh checkout</button>}
        {signedTransaction && !guidance.sendDisabled && <button className="primary" disabled={!!busy} onClick={() => void send()}>Send signed payment on devnet</button>}
        {(guidance.recoverExisting || (!!signedTransaction && !checkoutOrder)) && <button className="secondary" disabled={!!busy || !localSignature} onClick={() => void submit(localSignature ?? "")}>Ask the merchant about this signature</button>}
        <button className="secondary" disabled={!!busy} onClick={() => void recover()}>Ask the merchant to recover an order</button>
      </section>}
      {merchantNote && <div className="notice subtle" role="status">{merchantNote}</div>}
      {viewedOrder && <MerchantOrderRecord order={viewedOrder} heading="Merchant record" />}
      {preservedPaid && <p>This paid order was left paid on purpose. SuperTab will not ask you to refund it.</p>}
      {refundableOrder() && <section className="notice subtle" aria-label="Devnet refund">
        <strong>Refund this devnet payment</strong>
        <p>Return {usdc(refundableOrder()!.totalMinor)} Circle devnet USDC from the owner-controlled merchant to the buyer. This is not a retailer return. Signing sends the refund.</p>
        <p>Your wallet pays the devnet network fee. Signing allows a priority fee up to 0.0001 devnet SOL, plus the network base fee. The USDC amount stays the merchant total.</p>
        <button className="secondary" disabled={!!busy} onClick={() => void prepareRefund()}>Prepare refund</button>
        <button className="primary" disabled={!!busy || !refundTransaction || !address} onClick={() => void signRefund()}>Sign and send refund</button>
      </section>}
      {busy && <div className="loading-note" role="status"><span className="spinner" />{busy}</div>}
      {error && <div className="notice warning" role="alert">{error}</div>}
    </section>
  </main>;
}
