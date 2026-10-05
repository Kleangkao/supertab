import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { formatFixedMinor } from "../src/lib/money";
import { RECORDED_TEE_MERCHANT_TOTAL_USDC_BASE, recordedQuoteCanStartPayment, recordedTeeQuote } from "../src/lib/recorded-merchant-quote";

it("keeps the October 5 Solana Spaces tee quote as non-payable evidence", () => {
  expect(recordedTeeQuote).toMatchObject({
    merchant: "Solana Spaces",
    title: "Just Build It Tee",
    variant: "Medium",
    quantity: 1,
    checkedOn: "October 5, 2026",
    destinationScope: "Authorized Thailand destination",
    item: "$35.00",
    shippingName: "GlobalPost Economy",
    shipping: "$20.53",
    displayedTax: "$0.00",
    merchantTotal: "$55.53",
    visibleUsdcOption: "$55.53",
    estimatedDelivery: "October 19",
    duties: "Unverified",
    networkFees: "Unverified",
    payment: "unavailable",
    orderPlaced: false,
    freshQuoteUrl: "https://solanaspaces.com/checkout",
  });
  expect(recordedQuoteCanStartPayment()).toBe(false);
  expect(formatFixedMinor(RECORDED_TEE_MERCHANT_TOTAL_USDC_BASE, 6)).toBe("55.530000");
});

it("does not store a buyer name, street, email, or phone with the quote", () => {
  const source = readFileSync(new URL("../src/lib/recorded-merchant-quote.ts", import.meta.url), "utf8");
  expect(source).not.toMatch(/@/);
  expect(source).not.toMatch(/\+?\d[\d\s().-]{7,}\d/);
  expect(JSON.stringify(recordedTeeQuote)).not.toMatch(/street|email|phone/i);
});
