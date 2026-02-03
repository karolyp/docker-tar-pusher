import { config } from "dotenv";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 60_000,
    env: config({
      path: ".env.test",
    }).parsed,
    globals: true,
    coverage: {
      exclude: ["commitlint.config.mjs", "vitest.config.ts"],
      reporter: ["text", "json-summary", "json"],
    },
  },
});
