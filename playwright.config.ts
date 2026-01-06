import { existsSync } from "fs";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Load .env.local for local development (contains CODJIFLO_E2E_GITHUB_TOKEN)
const envLocalPath = ".env.local";
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, quiet: true });
}

const isCI = !!process.env.CI;
const e2eMode = process.env.E2E_DEPENDENCIES_MODE ?? 'mock';
const isProdMode = e2eMode === 'prod';

// Validate prod mode requirements
if (isProdMode && !process.env.CODJIFLO_E2E_GITHUB_TOKEN) {
  throw new Error(
    "E2E prod mode requires CODJIFLO_E2E_GITHUB_TOKEN.\n" +
      "Set it in .env.local (local) or as a secret (CI)."
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  timeout: 5000,
  expect: {
    timeout: 2000,
  },
  reporter: "html",
  use: {
    // E2E_PORT is set by webServer stdout capture at runtime
    baseURL: `http://localhost:${process.env.E2E_PORT}`,
    trace: "retain-on-failure",
    actionTimeout: 2000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run start -- -p 0",
    // Wait for Next.js to output port and capture it in E2E_PORT env var
    wait: { stdout: /localhost:(?<E2E_PORT>\d+)/ },
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
