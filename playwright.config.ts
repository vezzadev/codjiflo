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

// URLs for different modes
const baseURL = isProdMode
  ? 'https://codjiflo.vza.net'
  : 'http://localhost:3000';

// Log the E2E mode at startup for visibility
console.log(`\n📋 E2E Dependencies Mode: ${e2eMode.toUpperCase()}`);
console.log(`📍 Target URL: ${baseURL}\n`);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 1,
  timeout: isProdMode ? 90000 : 60000, // Longer timeout for prod mode (network latency)
  expect: {
    timeout: isProdMode ? 15000 : 10000,
  },
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    actionTimeout: isProdMode ? 20000 : 15000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  // Only start dev server in mock mode
  ...(isProdMode ? {} : {
    webServer: {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  }),
});
