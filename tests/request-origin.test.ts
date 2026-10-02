import { expect, it } from "vitest";
import { sameOriginRequest } from "../src/lib/request-origin";

it("retains the browser origin when Next normalizes a loopback URL", () => {
  expect(sameOriginRequest(new Request("http://localhost:3000/api", { headers: {
    origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000",
  } }))).toBe("http://127.0.0.1:3000");
  expect(sameOriginRequest(new Request("https://app.test/api", { headers: {
    origin: "https://app.test", host: "app.test",
  } }))).toBe("https://app.test");
});

it("rejects absent, unrelated, malformed or unbound origins", () => {
  for (const headers of [{}, { origin: "null" }, { origin: "http://evil.test:3000", host: "evil.test:3000" },
    { origin: "http://127.0.0.1:3000" }, { origin: "http://127.0.0.1:3001", host: "127.0.0.1:3001" },
    { origin: "https://127.0.0.1:3000", host: "127.0.0.1:3000" },
    { origin: "http://127.0.0.1:3000", host: "evil.test:3000" },
    { origin: "http://127.0.0.1:3000/path", host: "127.0.0.1:3000" },
    { origin: "http://127.0.0.1:3000", "x-forwarded-host": "127.0.0.1:3000" }]) {
    expect(sameOriginRequest(new Request("http://localhost:3000/api", { headers: headers as Record<string, string> }))).toBeNull();
  }
});
