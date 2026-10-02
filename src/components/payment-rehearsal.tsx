"use client";

import { useState } from "react";
import { advanceRehearsal, startRehearsal, type RehearsalAction } from "@/lib/payment-rehearsal";
import { simulatedCheckout } from "@/lib/simulated-checkout";
import { formatUsdFromMinor } from "@/lib/money";

export function PaymentRehearsal({ itemMinor, quantity, title }: { itemMinor: string; quantity: number; title: string }) {
  const checkout = simulatedCheckout(BigInt(itemMinor), quantity);
  const totalDisplay = formatUsdFromMinor(checkout.totalMinor);
  const [state, setState] = useState(() => startRehearsal(checkout.totalMinor));
  const act = (action: RehearsalAction) => setState(previous => advanceRehearsal(previous, action));
  return <section className="next-rail" aria-label="Local payment rehearsal">
    <span className="badge">LOCAL SIMULATION · no provider calls</span>
    <h3>Try the payment journey.</h3>
    <p>Rehearse buying {title}, quantity {quantity}, using its listed amount of {formatUsdFromMinor(checkout.lineMinor)} plus fixture shipping of $5 and fixture tax of $3: {totalDisplay} simulated total.</p>
    <p>Shipping and tax are invented demo values, not merchant quotes. This rehearsal does not use your wallet, change the live funding plan, or verify the real checkout total. Bridge sandbox access is still blocked.</p>
    <div className="end-states" aria-live="polite"><span>{state.payment.replaceAll("_", " ")}</span><span>{state.order.replaceAll("_", " ")}</span></div>
    <div className="wallet-options">
      {state.payment === "PAYMENT_APPROVAL_REQUIRED" && <button onClick={() => act("approve")}>Approve simulated {totalDisplay} purchase</button>}
      {state.payment === "PAYMENT_READY" && <><button onClick={() => act("authorize")}>Simulate authorization</button><button onClick={() => act("decline")}>Simulate decline</button></>}
      {state.payment === "PAYMENT_AUTHORIZED" && <button onClick={() => act("capture")}>Simulate capture</button>}
      {state.payment === "PAYMENT_CAPTURED" && <>{state.order === "ORDER_NOT_CREATED" && <button onClick={() => act("confirm_order")}>Add simulated merchant receipt</button>}<button onClick={() => act("refund")}>Simulate refund</button></>}
      {state.events.length > 0 && <button onClick={() => setState(startRehearsal(checkout.totalMinor))}>Reset rehearsal</button>}
      {(state.payment === "PAYMENT_CAPTURED" || state.payment === "PAYMENT_REFUNDED") && <><button onClick={() => act("replay_capture")}>Replay capture event</button><button onClick={() => act("late_authorization")}>Send delayed authorization</button></>}
    </div>
    {state.payment === "PAYMENT_AUTHORIZED" && <p>Authorization reserves purchasing power in this simulation. Capture has not happened.</p>}
    {state.payment === "PAYMENT_CAPTURED" && state.order === "ORDER_NOT_CREATED" && <p>Simulated capture is recorded. A merchant order still needs separate evidence.</p>}
    {state.orderReference && <p>Fixture evidence: {state.orderReference}. No real order exists.</p>}
    {state.events.some(event => event === "replay_capture" || event === "late_authorization") && <p>Repeated and delayed fixture events preserve the recorded payment stage. They do not create merchant order evidence.</p>}
    {state.events.length > 0 && <details><summary>Rehearsal event history</summary><ol>{state.events.map((event, index) => <li key={index}>{event.replaceAll("_", " ")}</li>)}</ol></details>}
  </section>;
}
