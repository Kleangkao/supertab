import type { Metadata } from "next";
import { DevnetPurchase } from "@/components/devnet-purchase";

export const metadata: Metadata = {
  title: "Devnet test product · SuperTab",
  description: "Read the verified owner-controlled devnet order, or pay the test marker from a devnet wallet.",
};

export default async function DevnetPage({ searchParams }: PageProps<"/devnet">) {
  const query = await searchParams;
  const order = Array.isArray(query.order) ? query.order[0] : query.order;
  const initialOrderId = typeof order === "string" && /^[0-9a-f-]{36}$/i.test(order) ? order : null;
  return <DevnetPurchase initialOrderId={initialOrderId} />;
}
