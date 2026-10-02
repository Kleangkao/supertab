"use client";

import { useState } from "react";
import { advanceRehearsal, startRehearsal, type RehearsalAction } from "@/lib/payment-rehearsal";

export function PaymentRehearsal() {
  const [state, setState] = useState(() => startRehearsal(4800n));
  const act = (action: RehearsalAction) => setState(previous => advanceRehearsal(previous, action));
  return <section className="next-rail" aria-label="Local payment rehearsal">
    <span className="badge">LOCAL SIMULATION · no provider calls</span>
    <h3>Try the payment journey.</h3>
    <p>This separate fixture uses a $40 item, $5 shipping and $3 tax: $48 total. It does not use your selected product, wallet, or live funding plan. Bridge sandbox access is still blocked.</p>
    <div className="end-states" aria-live="polite"><span>{state.payment.replaceAll("_", " ")}</span><span>{state.order.replaceAll("_", " ")}</span></div>
    <div className="wallet-options">
      {state.payment === "PAYMENT_APPROVAL_REQUIRED" && <button onClick={() => act("approve")}>Approve simulated $48 purchase</button>}
      {state.payment === "PAYMENT_READY" && <><button onClick={() => act("authorize")}>Simulate authorization</button><button onClick={() => act("decline")}>Simulate decline</button></>}
      {state.payment === "PAYMENT_AUTHORIZED" && <button onClick={() => act("capture")}>Simulate capture</button>}
      {state.payment === "PAYMENT_CAPTURED" && <>{state.order === "ORDER_NOT_CREATED" && <button onClick={() => act("confirm_order")}>Add simulated merchant receipt</button>}<button onClick={() => act("refund")}>Simulate refund</button></>}
      {state.events.length > 0 && <button onClick={() => setState(startRehearsal(4800n))}>Reset rehearsal</button>}
    </div>
    {state.payment === "PAYMENT_AUTHORIZED" && <p>Authorization reserves purchasing power in this simulation. Capture has not happened.</p>}
    {state.payment === "PAYMENT_CAPTURED" && state.order === "ORDER_NOT_CREATED" && <p>Simulated capture is recorded. A merchant order still needs separate evidence.</p>}
    {state.orderReference && <p>Fixture evidence: {state.orderReference}. No real order exists.</p>}
    {state.events.length > 0 && <details><summary>Rehearsal event history</summary><ol>{state.events.map((event, index) => <li key={index}>{event.replaceAll("_", " ")}</li>)}</ol></details>}
  </section>;
}
