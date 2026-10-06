import { expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({ journal: vi.fn(() => ({ fixture: true })), status: vi.fn(() => ({ executionReady: false, state: "review" })) }));
vi.mock("../src/lib/purchase-journal", () => ({ localPurchaseJournal: reads.journal }));
vi.mock("../src/lib/purchase-execution", () => ({ executionStatus: reads.status }));
import { POST } from "../src/app/api/digital-purchase/status/route";

it("reads status through a same-origin POST without approving or executing", async () => {
  reads.journal.mockClear();
  const response = await POST(new Request("http://localhost:3000/api/digital-purchase/status?attemptId=fixture", {
    method: "POST", headers: { origin: "http://localhost:3000" },
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ executionReady: false, state: "review" });
  expect(reads.journal).toHaveBeenCalledWith("fixture");
  reads.journal.mockClear();
  const rejected = await POST(new Request("http://localhost:3000/api/digital-purchase/status?attemptId=fixture", {
    method: "POST", headers: { origin: "https://other.test" },
  }));
  expect(rejected.status).toBe(403);
  expect(reads.journal).not.toHaveBeenCalled();
});
