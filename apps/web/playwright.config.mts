import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");
loadEnvConfig(projectRoot);
process.env.DATABASE_URL ??=
  "postgresql://clutchverse:clutchverse@127.0.0.1:5432/clutchverse?schema=public";
process.env.AUTH_SECRET ??=
  "ClutchVersePlaywrightE2ESecretOnly-NotForProduction";

const baseURL =
  process.env.E2E_BASE_URL ?? process.env.AUTH_URL ?? "http://127.0.0.1:3000";
const realtimeURL =
  process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://127.0.0.1:4001";
const e2eEnv = {
  ...process.env,
  AUTH_SECRET:
    process.env.AUTH_SECRET ??
    "ClutchVersePlaywrightE2ESecretOnly-NotForProduction",
  DATABASE_URL: process.env.DATABASE_URL,
  ...(process.env.REDIS_URL ? { REDIS_URL: process.env.REDIS_URL } : {}),
  AUTH_URL: baseURL,
  WEB_ORIGIN: new URL(baseURL).origin,
  NEXT_PUBLIC_REALTIME_URL: realtimeURL,
  REALTIME_PORT: new URL(realtimeURL).port || "4001",
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: 0,
  reporter: process.env.CI ? "line" : "list",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm dev --hostname 127.0.0.1 --port 3000",
      url: `${baseURL}/api/health`,
      env: e2eEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: "pnpm --filter @clutchverse/realtime dev",
      url: `${realtimeURL}/socket.io/?EIO=4&transport=polling`,
      env: e2eEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
