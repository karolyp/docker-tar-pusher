import { config } from "dotenv";
import { defineConfig } from "vitest/config";

const dotenvFile = process.env.CI ? ".env.ci" : ".env.test";

export default defineConfig({
  test: {
    testTimeout: 10000,
    env: config({
      path: dotenvFile,
    }).parsed,
    globals: true,
    coverage: {
      exclude: ["commitlint.config.mjs", "vitest.config.ts"],
      reporter: ["text", "json-summary", "json"],
    },
  },
});
