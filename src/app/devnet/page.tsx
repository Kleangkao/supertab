import type { Metadata } from "next";
import { DevnetPurchase } from "@/components/devnet-purchase";

export const metadata: Metadata = {
  title: "Devnet test product · SuperTab",
  description: "Read the verified owner-controlled devnet order, or pay the test marker from a devnet wallet.",
};

export default function DevnetPage() {
  return <DevnetPurchase />;
}
