import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("supertab-browser-ready") === "1") return;
    localStorage.removeItem("supertab.shortlist.v1");
    sessionStorage.setItem("supertab-browser-ready", "1");
  });
  await page.goto("/");
});

function assistant(page: Page) {
  return page.locator(".conversation p").last();
}

async function search(page: Page, text: string) {
  const box = page.locator("#request");
  await expect(box).toBeEnabled();
  await box.fill(text);
  const response = page.waitForResponse((item) => item.url().includes("/api/shop") && item.request().method() === "POST");
  await page.getByRole("button", { name: "Find it" }).click();
  expect((await response).ok()).toBeTruthy();
  await expect(box).toBeEnabled();
}

function exactCard(page: Page, title: string) {
  return page.locator("section.results > .product-grid article").filter({ has: page.getByRole("heading", { name: title }) });
}

test("search and conversational refinement", async ({ page }) => {
  await search(page, "Find me a black polo under $50");
  await expect(assistant(page)).toContainText("I used the words in your message.");
  await expect(exactCard(page, "Black Torrey Polo")).toBeVisible();
  await expect(exactCard(page, "Black Torrey Polo").getByText("Color Black confirmed from the variant option.")).toBeVisible();
  await expect(assistant(page)).toContainText("eBay is unavailable in this fixture. Shopify results are still listed.");
  await expect(page.getByText("A destination filters the search. It does not confirm that an item can be delivered.")).toBeVisible();
  await page.locator("#add-color").selectOption("navy");
  await expect(exactCard(page, "Navy Torrey Polo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try navy too" })).toHaveCount(0);
});

test("edit and remove a requirement with consistent results", async ({ page }) => {
  await search(page, "Find me a black polo under $50");
  await page.locator("#add-color").selectOption("navy");
  await expect(exactCard(page, "Navy Torrey Polo")).toBeVisible();
  await page.getByRole("button", { name: "Remove budget" }).click();
  await expect(exactCard(page, "Black euro polo")).toBeVisible();
  await expect(page.locator("section.results > .product-grid article h3").first()).toHaveText("Black Torrey Polo");
  await page.getByRole("button", { name: "Remove black" }).click();
  await expect(exactCard(page, "Navy Torrey Polo")).toBeVisible();
  await expect(exactCard(page, "Black Torrey Polo")).toHaveCount(0);
});

test("zero matches and an explicit size relaxation", async ({ page }) => {
  await search(page, "Find me a white polo size 42");
  await expect(page.getByRole("heading", { name: "No confirmed matches yet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try navy too" })).toHaveCount(0);
  await page.getByRole("button", { name: "Remove size requirement" }).click();
  await expect(exactCard(page, "White court polo")).toBeVisible();
  await expect(exactCard(page, "White court polo").getByText("Color White confirmed from the variant option.")).toBeVisible();
});

test("save, reject a duplicate, remove one, and keep it after refresh", async ({ page }) => {
  await search(page, "Find me a black polo under $50");
  await page.locator("#add-color").selectOption("navy");
  await exactCard(page, "Black Torrey Polo").getByRole("button", { name: "Save to shortlist" }).click();
  await expect(page.locator("#shopping-note")).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Saved to your shortlist." })).toBeVisible();
  await exactCard(page, "Black Torrey Polo").getByRole("button", { name: "Save to shortlist" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Already on your shortlist." })).toBeVisible();
  await exactCard(page, "Navy Torrey Polo").getByRole("button", { name: "Save to shortlist" }).click();
  const shortlist = page.getByRole("region", { name: "Shortlist" });
  await expect(shortlist.getByRole("heading", { name: "Black Torrey Polo" })).toBeVisible();
  await expect(shortlist.getByRole("heading", { name: "Navy Torrey Polo" })).toBeVisible();
  await shortlist.locator("article").filter({ has: page.getByRole("heading", { name: "Navy Torrey Polo" }) }).getByRole("button", { name: "Remove from shortlist" }).click();
  await expect(shortlist.getByRole("heading", { name: "Navy Torrey Polo" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "Shortlist" }).getByRole("heading", { name: "Black Torrey Polo" })).toBeVisible();
  await page.getByRole("button", { name: "Clear shortlist" }).click();
  await expect(page.getByRole("region", { name: "Shortlist" })).toHaveCount(0);
});

test("compare differing variants and unknown costs honestly", async ({ page }) => {
  await search(page, "Find me a black polo under $50");
  await exactCard(page, "Black Torrey Polo").getByRole("button", { name: "Save to shortlist" }).click();
  const euro = page.locator("article").filter({ has: page.getByRole("heading", { name: "Black euro polo" }) });
  await euro.getByRole("button", { name: "Save to shortlist" }).click();
  const shortlist = page.getByRole("region", { name: "Shortlist" });
  await expect(shortlist.getByRole("heading", { name: "Black Torrey Polo" })).toBeVisible();
  await expect(shortlist.getByRole("heading", { name: "Black euro polo" })).toBeVisible();
  await expect(shortlist.getByText("Shipping not returned").first()).toBeVisible();
  await expect(shortlist.getByText("tax not returned").first()).toBeVisible();
  await expect(shortlist.getByText("These item prices use different currencies. SuperTab does not convert them.")).toBeVisible();
  await expect(shortlist.getByText("Lowest item price, not delivered cost")).toHaveCount(0);
  await expect(shortlist.getByText(/Snapshot from 2026-10-08/).first()).toBeVisible();
  await expect(shortlist.getByText("They do not restore a funding plan or an approval.")).toBeVisible();
});

test("a new search keeps the shortlist", async ({ page }) => {
  await search(page, "Find me a black polo under $50");
  await exactCard(page, "Black Torrey Polo").getByRole("button", { name: "Save to shortlist" }).click();
  await page.getByRole("button", { name: "New search" }).click();
  await search(page, "Find me black running shoes");
  await expect(exactCard(page, "Black running shoes")).toBeVisible();
  await expect(page.getByRole("region", { name: "Shortlist" }).getByRole("heading", { name: "Black Torrey Polo" })).toBeVisible();
});

test("select a current result for the existing review", async ({ page }) => {
  await search(page, "Find me a black polo under $50");
  await exactCard(page, "Black Torrey Polo").getByRole("button", { name: "Review purchase" }).click();
  await expect(page.getByRole("heading", { name: "Cost & funding" })).toBeVisible();
  await expect(page.getByText("Opening it sends no payment.")).toBeVisible();
  await page.getByText("About retail payments").click();
  const retail = page.getByRole("region", { name: "Merchant checkout total" });
  await expect(retail.getByText("Order not created.", { exact: true })).toBeVisible();
  await expect(retail.getByText("Payment not executed.", { exact: true })).toBeVisible();
});

test("an older saved item uses re-find instead of a stale review id", async ({ page }) => {
  await search(page, "Find me a black polo under $50");
  await exactCard(page, "Black Torrey Polo").getByRole("button", { name: "Save to shortlist" }).click();
  const purchases: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/purchase")) purchases.push(request.url());
  });
  await page.getByRole("button", { name: "New search" }).click();
  await search(page, "Find me black running shoes");
  const shortlist = page.getByRole("region", { name: "Shortlist" });
  await expect(shortlist.getByText("Not in this search, so it cannot reopen the funding review.")).toBeVisible();
  await shortlist.getByRole("button", { name: "Look for this product again" }).click();
  await expect(page.locator("#request")).toHaveValue("Find Black Torrey Polo");
  expect(purchases).toEqual([]);
  const response = page.waitForResponse((item) => item.url().includes("/api/shop") && item.request().method() === "POST");
  await page.getByRole("button", { name: "Find it" }).click();
  expect((await response).ok()).toBeTruthy();
  await expect(page.getByRole("region", { name: "Shortlist" }).getByRole("button", { name: "Review this result" })).toBeVisible();
});

test("one provider unavailable while the other returns products", async ({ page }) => {
  await search(page, "Find me a black polo under $50");
  await expect(exactCard(page, "Black Torrey Polo")).toBeVisible();
  await expect(assistant(page)).toContainText("eBay is unavailable in this fixture. Shopify results are still listed.");
});

test("a failed request keeps the draft and the current results", async ({ page }) => {
  await search(page, "Find me a black polo under $50");
  await page.route("**/api/shop", (route) => route.abort("failed"));
  const draft = "Find me a green jacket please";
  await page.locator("#request").fill(draft);
  await page.getByRole("button", { name: "Find it" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator("#request")).toHaveValue(draft);
  await expect(exactCard(page, "Black Torrey Polo")).toBeVisible();
});

test("merchant handoff does not claim payment or an order", async ({ page }) => {
  await search(page, "Find me a black polo under $50");
  const card = exactCard(page, "Black Torrey Polo");
  const product = card.getByRole("link", { name: "Open product page. This does not pay or place an order." });
  const cart = card.getByRole("link", { name: "Continue to merchant cart. This does not pay or place an order." });
  await expect(product).toHaveAttribute("href", "https://merchant.test/products/black-polo");
  await expect(cart).toHaveAttribute("href", "https://merchant.test/cart/1:1");
  expect((await product.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect((await cart.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await card.getByRole("button", { name: "Review purchase" }).click();
  const merchant = page.getByRole("region", { name: "Merchant checkout total" }).getByRole("link", { name: "Continue to merchant cart. This does not pay or place an order." });
  await expect(merchant).toBeVisible();
  expect((await merchant.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(page.getByText("You’ll review checkout at the merchant. Opening it sends no payment.")).toBeVisible();
  await page.getByText("About retail payments").click();
  await expect(page.getByRole("region", { name: "Merchant checkout total" }).getByText("Order not created.", { exact: true })).toBeVisible();
});

test("a narrow viewport can search from the keyboard without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#request").focus();
  await expect(page.locator("#request")).toBeFocused();
  await search(page, "Find me a black polo under $50");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(exactCard(page, "Black Torrey Polo")).toBeVisible();
});

test("a keyboard journey can refine, save, and open review without a pointer", async ({ page }) => {
  await page.locator("#request").focus();
  await page.keyboard.type("Find me a black polo under $50");
  const response = page.waitForResponse((item) => item.url().includes("/api/shop") && item.request().method() === "POST");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  expect((await response).ok()).toBeTruthy();
  await expect(exactCard(page, "Black Torrey Polo")).toBeVisible();
  await exactCard(page, "Black Torrey Polo").getByRole("button", { name: "Save to shortlist" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#shopping-note")).toBeFocused();
  await expect(page.getByRole("region", { name: "Shortlist" })).toContainText("Black Torrey Polo");
  await exactCard(page, "Black Torrey Polo").getByRole("button", { name: "Review purchase" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("You’ll review checkout at the merchant. Opening it sends no payment.")).toBeVisible();
  await page.getByText("Explore without connecting").click();
  const wallet = page.getByRole("button", { name: "Demo wallet · read-only" });
  await expect(wallet).toBeVisible();
  expect((await wallet.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test("a second tab sees shortlist changes from the first tab", async ({ page, context }) => {
  await search(page, "Find me a black polo under $50");
  await exactCard(page, "Black Torrey Polo").getByRole("button", { name: "Save to shortlist" }).click();
  await expect(page.getByRole("region", { name: "Shortlist" })).toContainText("Black Torrey Polo");
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.getByRole("region", { name: "Shortlist" })).toContainText("Black Torrey Polo");
  await page.getByRole("button", { name: "Clear shortlist" }).click();
  await expect(page.getByRole("region", { name: "Shortlist" })).toHaveCount(0);
  await expect(other.getByRole("region", { name: "Shortlist" })).toHaveCount(0, { timeout: 5_000 });
  await other.close();
});
