import Link from "next/link";
import { PrototypePaths } from "@/components/prototype-paths";
import { AssetConversion } from "@/components/asset-conversion";

export default function EvidencePage() {
  return <main className="app-shell evidence-page"><nav className="topbar" aria-label="Main navigation"><Link className="wordmark" href="/">SuperTab</Link><Link href="/">Back to shopping</Link></nav><header className="hero"><p className="eyebrow">DEMO RECORDS</p><h1>What’s been tested.</h1><p className="hero-copy">A recorded retail quote and a separate devnet order and refund. These records do not represent a completed retail purchase.</p></header><PrototypePaths /><details className="tool-drawer"><summary>Check conversion · mainnet quote only</summary><AssetConversion /></details><details className="tool-drawer"><summary>Incomplete timestamp integration</summary><p className="section-copy">A mainnet conversion was confirmed. The timestamp merchant refused payment; no settlement or certificate is verified. Existing recovery records are preserved.</p></details></main>;
}
