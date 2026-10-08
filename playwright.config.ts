import { defineConfig, devices } from "@playwright/test";

const port = 3456;

export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      SUPERTAB_SHOP_FIXTURES: "1",
      SUPERTAB_ALLOW_SHOP_FIXTURES: "1",
    },
  },
});
