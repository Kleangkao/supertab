import { afterEach, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ prepare: vi.fn(), journal: vi.fn() }));
vi.mock("../src/lib/digital-purchase-service", () => ({ prepareBitcoinAnchorPurchase: mocked.prepare }));
vi.mock("../src/lib/purchase-journal", () => ({ localPurchaseJournal: mocked.journal }));
import { POST } from "../src/app/api/digital-purchase/quote/route";

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("returns a blocked merchant quote without touching the payment builder or journal", async () => {
  const blocker = "The payment sponsor changed from the reviewed fee payer.";
  mocked.prepare.mockResolvedValue({ wallet: { address: "fixture-wallet", source: "connected" }, recovery: { idempotencyKey: "fixture-stable-key" }, readyForApproval: false, blockers: [blocker], execution: "disabled" });
  mocked.journal.mockImplementation(() => { throw new Error("A blocked quote must never prepare payment custody."); });
  const network = vi.fn(() => { throw new Error("No payment blockhash is needed."); });
  vi.stubGlobal("fetch", network);
  const response = await POST(new Request("http://localhost:3000/api/digital-purchase/quote", {
    method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify({ walletAddress: "fixture-wallet", walletSource: "connected" }),
  }));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.blockers).toEqual([blocker]);
  expect(body.paymentPreview).toBeUndefined();
  expect(body.execution).toBe("disabled");
  expect(mocked.journal).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
});
