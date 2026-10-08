import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests must not inherit Playwright fixture flags from the parent shell.
delete process.env.SUPERTAB_SHOP_FIXTURES;
delete process.env.SUPERTAB_ALLOW_SHOP_FIXTURES;

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
