"use client";

import { useEffect, useState } from "react";
import { advanceRehearsal, startRehearsal, type RehearsalAction } from "@/lib/payment-rehearsal";
import { simulatedCheckout } from "@/lib/simulated-checkout";
import { formatUsdFromMinor } from "@/lib/money";

export function PaymentRehearsal({
  itemMinor,
  quantity,
  title,
  termsKey,
  livePaymentStatus,
  liveOrderStatus,
  liveFinalTotal,
  onActiveChange,
}: {
  itemMinor: string;
  quantity: number;
  title: string;
  termsKey: string;
  livePaymentStatus: string;
  liveOrderStatus: string;
  liveFinalTotal: "unknown" | "verified";
  onActiveChange?: (active: boolean) => void;
}) {
  const checkout = simulatedCheckout(BigInt(itemMinor), quantity);
  const totalDisplay = formatUsdFromMinor(checkout.totalMinor);
  const [state, setState] = useState(() => startRehearsal(checkout.totalMinor, termsKey));
  const active = state.events.length > 0;

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  const act = (action: RehearsalAction) => setState(previous => advanceRehearsal(previous, action));
  const reset = () => setState(startRehearsal(checkout.totalMinor, termsKey));

  return <section className="next-rail simulation-rail" aria-label="Local payment rehearsal" data-mode="local_simulation">
    <span className="badge">LOCAL SIMULATION · no provider calls</span>
    <h3>Try the payment journey.</h3>
    <p>This is an explicit rehearsal for {title}, quantity {quantity}. It uses the listed amount of {formatUsdFromMinor(checkout.lineMinor)} plus fixture shipping of $5 and fixture tax of $3: {totalDisplay} simulated total.</p>
    <p>Shipping and tax here are invented fixtures, never merchant-verified totals. Simulation cannot change the live funding plan, live approval, or live payment status ({livePaymentStatus.replaceAll("_", " ")} / {liveOrderStatus.replaceAll("_", " ")}).</p>
    {liveFinalTotal !== "verified" && <p>Live final merchant total is still unknown. Approving the simulated amount does not approve a retail checkout.</p>}
    <div className="end-states" aria-live="polite">
      <span>Simulated {state.payment.replaceAll("_", " ")}</span>
      <span>Simulated {state.order.replaceAll("_", " ")}</span>
      <span>Live {livePaymentStatus.replaceAll("_", " ")}</span>
      <span>Live {liveOrderStatus.replaceAll("_", " ")}</span>
    </div>
    <div className="wallet-options">
      {state.payment === "PAYMENT_APPROVAL_REQUIRED" && <button onClick={() => act("approve")}>Approve simulated {totalDisplay} purchase</button>}
      {state.payment === "PAYMENT_READY" && <>
        <button onClick={() => act("authorize")}>Simulate authorization</button>
        <button onClick={() => act("decline")}>Simulate decline</button>
        <button onClick={() => act("mark_pending")}>Simulate lost response</button>
      </>}
      {state.payment === "PAYMENT_PENDING" && <p>Payment outcome is unknown. Do not start another payment. Wait for evidence or reset the rehearsal.</p>}
      {state.payment === "PAYMENT_AUTHORIZED" && <button onClick={() => act("capture")}>Simulate capture</button>}
      {state.payment === "PAYMENT_CAPTURED" && <>
        {state.order === "ORDER_NOT_CREATED" && <button onClick={() => act("confirm_order")}>Add simulated merchant receipt</button>}
        <button onClick={() => act("refund")}>Simulate refund</button>
      </>}
      {state.events.length > 0 && <button onClick={reset}>Reset rehearsal</button>}
      {(state.payment === "PAYMENT_CAPTURED" || state.payment === "PAYMENT_REFUNDED") && <>
        <button onClick={() => act("replay_capture")}>Replay capture event</button>
        <button onClick={() => act("late_authorization")}>Send delayed authorization</button>
      </>}
    </div>
    {state.payment === "PAYMENT_AUTHORIZED" && <p>Authorization reserves purchasing power in this simulation. Capture has not happened.</p>}
    {state.payment === "PAYMENT_CAPTURED" && state.order === "ORDER_NOT_CREATED" && <p>Simulated capture is recorded. A merchant order still needs separate evidence. Pending payment and missing order are different states.</p>}
    {state.orderReference && <p>Fixture evidence: {state.orderReference}. No real order exists, and this is not a completed retail purchase.</p>}
    {state.events.some(event => event === "replay_capture" || event === "late_authorization") && <p>Repeated and delayed fixture events preserve the recorded payment stage. They do not create merchant order evidence.</p>}
    {state.events.length > 0 && <details><summary>Rehearsal event history</summary><ol>{state.events.map((event, index) => <li key={index}>{event.replaceAll("_", " ")}</li>)}</ol></details>}
  </section>;
}
