import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

const isCI = !!process.env.GITHUB_ACTIONS;
const dotenvFile = isCI ? '.env.ci' : '.env.test';

export default defineConfig({
  test: {
    env: config({
      path: dotenvFile
    }).parsed,
    globals: true,
    coverage: {
      exclude: ['commitlint.config.mjs', 'vitest.config.ts', '.eslintrc.js'],
      reporter: ['text', 'json-summary', 'json']
    }
  }
});
