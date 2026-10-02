import { describe, expect, it } from "vitest";
import { buyerIpForRequest, publicBuyerIp } from "../src/lib/buyer-context";
import { readConfig } from "../src/lib/config";
import { configStamp } from "../src/lib/shopping";

describe("trusted buyer network context", () => {
  it("rejects malformed, private, local, reserved and multi-hop values", () => {
    for (const value of [null, "", "8.8.8.8\r\nInjected: x", "8.8.8.8, 1.1.1.1", " 8.8.8.8", "0.1.2.3", "10.0.0.1", "127.0.0.1",
      "169.254.1.1", "172.16.0.1", "192.168.1.1", "100.64.0.1", "203.0.113.9", "224.0.0.1", "::1", "fc00::1", "fe80::1", "::ffff:8.8.8.8", "2001:db8::1", "2001:0db8:0000:0000:0000:0000:0000:0001"]) {
      expect(publicBuyerIp(value)).toBeNull();
    }
    expect(publicBuyerIp("8.8.8.8")).toBe("8.8.8.8");
    expect(publicBuyerIp("2606:4700:4700::1111")).toBe("2606:4700:4700::1111");
  });

  it("uses local context only for same-origin loopback and never for a hosted request", () => {
    const config = readConfig({ SHOPIFY_LOCAL_BUYER_IP: "8.8.8.8" });
    expect(buyerIpForRequest(new Request("http://127.0.0.1:3000/api/purchase/checkout", { headers: { origin: "http://127.0.0.1:3000" } }), config)).toBe("8.8.8.8");
    expect(buyerIpForRequest(new Request("https://supertab.test/api/purchase/checkout", { headers: { origin: "https://supertab.test" } }), config)).toBeNull();
    expect(buyerIpForRequest(new Request("http://127.0.0.1:3000/api/purchase/checkout", { headers: { origin: "https://other.test" } }), config)).toBeNull();
  });

  it("ignores unconfigured proxy headers and rejects lists or unsupported header names", () => {
    const request = (value: string) => new Request("https://supertab.test/api/purchase/checkout", { headers: { origin: "https://supertab.test", "x-forwarded-for": value } });
    expect(buyerIpForRequest(request("8.8.8.8"), readConfig({}))).toBeNull();
    expect(buyerIpForRequest(request("8.8.8.8"), readConfig({ SHOPIFY_TRUSTED_BUYER_IP_HEADER: "x-forwarded-for" }))).toBe("8.8.8.8");
    expect(buyerIpForRequest(request("8.8.8.8, 1.1.1.1"), readConfig({ SHOPIFY_TRUSTED_BUYER_IP_HEADER: "x-forwarded-for" }))).toBeNull();
    expect(readConfig({ SHOPIFY_TRUSTED_BUYER_IP_HEADER: "authorization" }).shopifyBuyerIpHeader).toBeNull();
  });
});

it("configuration identity notices credential rotation without containing private values", () => {
  const original = readConfig({ SHOPIFY_CLIENT_ID: "FIXTURE_CLIENT", SHOPIFY_CLIENT_SECRET: "FIXTURE_SECRET_ONE", SHOPIFY_LOCAL_BUYER_IP: "8.8.8.8" });
  const rotated = { ...original, shopifyClientSecret: "FIXTURE_SECRET_TWO" };
  const stamp = configStamp(original);
  expect(stamp).not.toContain("8.8.8.8");
  expect(stamp).not.toContain("FIXTURE_SECRET_ONE");
  expect(configStamp(rotated)).not.toBe(stamp);
});
