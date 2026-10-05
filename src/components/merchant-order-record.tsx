import type { DevnetMerchantOrder } from "@/lib/devnet-merchant-client";

export function MerchantOrderRecord({ order, heading }: { order: DevnetMerchantOrder; heading: string }) {
  return <section className="notice subtle" aria-label={heading}>
    <strong>{heading}</strong>
    <p>Order {order.id}</p>
    <p>Status {order.status} · Settlement {order.settlement} · Total {usdc(order.totalMinor)}</p>
    <p>Payment {order.paymentSignature}</p>
    <p>Refund {order.refundSignature ?? "none"}</p>
    <p>{order.separation}</p>
    <p>This is the merchant’s current record. SuperTab did not invent the status.</p>
  </section>;
}

export function usdc(minor: string): string {
  const value = BigInt(minor);
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${fraction} USDC`;
}
