import type { Metadata } from "next";
import { DevnetPurchase } from "@/components/devnet-purchase";

export const metadata: Metadata = {
  title: "Devnet test product · SuperTab",
  description: "Review and pay for the owner-controlled devnet test marker.",
};

export default function DevnetPage() {
  return <DevnetPurchase />;
}
