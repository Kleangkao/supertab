/**
 * Actual local Durable Object verification for shopping sessions.
 * Uses Wrangler `unstable_dev` + SQLite DO storage. Not an in-memory SessionStore mock.
 *
 * Usage: npm run test:worker-sessions
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { unstable_dev } from "wrangler";

const CONTROL_TOKEN = "local-worker-verify-token-32chars!!";
const MERCHANT_DIR = dirname(fileURLToPath(new URL("../merchant/worker.ts", import.meta.url)));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function snapshot(revision, updatedAtMs, label, sessionId) {
  return JSON.stringify({
    version: 1,
    revision,
    updatedAtMs,
    record: {
      id: sessionId,
      messages: [{ role: "user", text: label }],
      updatedAtMs,
      persistedRevision: revision,
      lastAcceptedTurnId: null,
      lastAcceptedTurnText: null,
    },
    excluded: [],
    uncertain: [],
  });
}

async function startWorker(persist) {
  return unstable_dev(join(MERCHANT_DIR, "worker.ts"), {
    config: join(MERCHANT_DIR, "wrangler.jsonc"),
    persist: true,
    persistencePath: persist,
    ip: "127.0.0.1",
    vars: {
      SUPERTAB_CONTROL_TOKEN: CONTROL_TOKEN,
      GEMINI_DAILY_LIMIT: "120",
    },
    experimental: { disableExperimentalWarning: true },
  });
}

async function main() {
  const persist = await mkdtemp(join(tmpdir(), "supertab-worker-sessions-"));
  let worker;
  try {
    worker = await startWorker(persist);
    const base = `http://${worker.address}:${worker.port}`;
    const auth = { authorization: `Bearer ${CONTROL_TOKEN}` };
    const sessionId = randomUUID();
    const ttlMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    {
      const res = await fetch(`${base}/health`);
      const body = await res.json();
      assert(res.status === 200, `health status ${res.status}`);
      assert(body.financialExecution === "disabled", "health financial execution is not disabled");
      assert(body.shoppingSessions?.cas === true, "health missing cas");
      assert(body.shoppingSessions?.alarmCleanup === true, "health missing alarmCleanup");
      assert(body.shoppingSessions?.requireRevisionOnUpdate === true, "health missing requireRevisionOnUpdate");
      console.log("ok health capabilities");
    }

    {
      const res = await fetch(`${base}/sessions/${sessionId}`);
      assert(res.status === 401, `unauth GET ${res.status}`);
      console.log("ok auth required");
    }

    {
      const res = await fetch(`${base}/sessions/not-a-uuid`, { headers: auth });
      assert(res.status === 404, `bad id ${res.status}`);
      console.log("ok malformed id");
    }

    {
      const res = await fetch(`${base}/sessions/${sessionId}`, {
        method: "PUT",
        headers: { ...auth, "content-type": "application/json", "x-supertab-revision": "0" },
        body: snapshot(1, now, "polo", sessionId),
      });
      assert(res.status === 200, `create ${res.status} ${await res.text()}`);
      console.log("ok create");
    }

    {
      const res = await fetch(`${base}/sessions/${sessionId}`, { headers: auth });
      assert(res.status === 200, `load ${res.status}`);
      assert(res.headers.get("cache-control") === "no-store", "missing no-store");
      const json = await res.json();
      assert(json.revision === 1, `revision ${json.revision}`);
      console.log("ok load");
    }

    {
      const res = await fetch(`${base}/sessions/${sessionId}`, {
        method: "PUT",
        headers: { ...auth, "content-type": "application/json", "x-supertab-revision": "1" },
        body: snapshot(2, now, "navy", sessionId),
      });
      assert(res.status === 200, `update ${res.status}`);
      console.log("ok update");
    }

    {
      const [ra, rb] = await Promise.all([
        fetch(`${base}/sessions/${sessionId}`, {
          method: "PUT",
          headers: { ...auth, "content-type": "application/json", "x-supertab-revision": "2" },
          body: snapshot(3, now, "white-a", sessionId),
        }),
        fetch(`${base}/sessions/${sessionId}`, {
          method: "PUT",
          headers: { ...auth, "content-type": "application/json", "x-supertab-revision": "2" },
          body: snapshot(3, now, "white-b", sessionId),
        }),
      ]);
      const statuses = [ra.status, rb.status].sort((a, b) => a - b);
      assert(statuses[0] === 200 && statuses[1] === 409, `cas pair ${statuses.join(",")}`);
      const loaded = await (await fetch(`${base}/sessions/${sessionId}`, { headers: auth })).json();
      assert(loaded.revision === 3, `winner revision ${loaded.revision}`);
      const text = loaded.record.messages[0].text;
      assert(text === "white-a" || text === "white-b", `winner text ${text}`);
      console.log("ok competing CAS");
    }

    {
      const res = await fetch(`${base}/sessions/${sessionId}`, {
        method: "PUT",
        headers: { ...auth, "content-type": "application/json" },
        body: snapshot(4, now, "legacy", sessionId),
      });
      assert(res.status === 409, `missing revision ${res.status}`);
      console.log("ok revision required");
    }

    {
      const res = await fetch(`${base}/sessions/${sessionId}`, {
        method: "PUT",
        headers: { ...auth, "content-type": "application/json", "x-supertab-revision": "3" },
        body: snapshot(4, now, "x".repeat(200_000), sessionId),
      });
      assert(res.status === 413 || res.status === 400, `oversize ${res.status}`);
      console.log("ok oversize");
    }

    {
      const res = await fetch(`${base}/sessions/${sessionId}`, {
        method: "PUT",
        headers: { ...auth, "content-type": "application/json", "x-supertab-revision": "1" },
        body: snapshot(99, now, "stale", sessionId),
      });
      assert(res.status === 409, `stale ${res.status}`);
      console.log("ok stale revision");
    }

    {
      const del = await fetch(`${base}/sessions/${sessionId}`, { method: "DELETE", headers: auth });
      assert(del.status === 200, `delete ${del.status}`);
      const get = await fetch(`${base}/sessions/${sessionId}`, { headers: auth });
      assert(get.status === 404, `after delete ${get.status}`);
      console.log("ok delete");
    }

    const expiredId = randomUUID();
    {
      const expiredAt = now - ttlMs - 1_000;
      const put = await fetch(`${base}/sessions/${expiredId}`, {
        method: "PUT",
        headers: { ...auth, "content-type": "application/json", "x-supertab-revision": "0" },
        body: snapshot(1, expiredAt, "expired", expiredId),
      });
      assert(put.status === 200, `expired put ${put.status}`);
      const get = await fetch(`${base}/sessions/${expiredId}`, { headers: auth });
      assert(get.status === 404, `expired get ${get.status}`);
      console.log("ok TTL expired read");
    }

    // Abandoned cleanup without a shopper GET: past alarm + recreate at revision 0.
    const abandonedId = randomUUID();
    {
      const expiredAt = now - ttlMs - 5_000;
      const put = await fetch(`${base}/sessions/${abandonedId}`, {
        method: "PUT",
        headers: { ...auth, "content-type": "application/json", "x-supertab-revision": "0" },
        body: snapshot(1, expiredAt, "abandoned", abandonedId),
      });
      assert(put.status === 200, `abandoned put ${put.status}`);
      await sleep(2_500);
      const again = await fetch(`${base}/sessions/${abandonedId}`, {
        method: "PUT",
        headers: { ...auth, "content-type": "application/json", "x-supertab-revision": "0" },
        body: snapshot(1, now, "after-alarm", abandonedId),
      });
      assert(again.status === 200, `recreate after alarm ${again.status} ${await again.text()}`);
      const loaded = await (await fetch(`${base}/sessions/${abandonedId}`, { headers: auth })).json();
      assert(loaded.record.messages[0].text === "after-alarm", "abandoned body survived without cleanup path");
      console.log("ok abandoned cleanup / recreate");
    }

    const persistId = randomUUID();
    {
      const put = await fetch(`${base}/sessions/${persistId}`, {
        method: "PUT",
        headers: { ...auth, "content-type": "application/json", "x-supertab-revision": "0" },
        body: snapshot(1, now, "persist", persistId),
      });
      assert(put.status === 200, `persist put ${put.status}`);
    }

    await worker.stop();
    worker = await startWorker(persist);
    const base2 = `http://${worker.address}:${worker.port}`;
    {
      const res = await fetch(`${base2}/sessions/${persistId}`, { headers: auth });
      assert(res.status === 200, `after restart ${res.status}`);
      const json = await res.json();
      assert(json.record.messages[0].text === "persist", "restart lost body");
      console.log("ok restart persistence");
    }

    console.log("\nWORKER_SESSIONS_VERIFIED");
    console.log("evidence=actual-wrangler-do");
    console.log(`token_fingerprint=${createHash("sha256").update(CONTROL_TOKEN).digest("hex").slice(0, 12)}`);
  } catch (error) {
    console.error("WORKER_SESSIONS_FAILED");
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  } finally {
    if (worker) await worker.stop().catch(() => {});
    if (process.exitCode !== 1) await rm(persist, { recursive: true, force: true }).catch(() => {});
    else console.error(`persist kept at ${persist}`);
  }
}

await main();
