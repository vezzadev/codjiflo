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
  // Global setup handles building and starting the server with OS-assigned port
  // The test fixture (e2e/fixtures/test.ts) provides the dynamic baseURL
  globalSetup: "./e2e/global-setup.ts",
  use: {
    // baseURL is set dynamically by the test fixture based on the port file
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
});
