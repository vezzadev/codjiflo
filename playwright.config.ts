import { existsSync } from "fs";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import { findAvailablePortSync } from "./e2e/fixtures/find-port";

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

// Need web server for mock mode OR prod mode running locally
const needsWebServer = !isProdMode || !isCI;

// Find an available port dynamically to avoid conflicts
// Only needed when we're starting a local web server
const serverPort = needsWebServer ? findAvailablePortSync(3000) : 3000;

// URLs for different modes
// - mock mode: always localhost with dynamic port
// - prod mode in CI: production site (codjiflo.vza.net)
// - prod mode locally: localhost dev server with dynamic port
const baseURL = isProdMode && isCI
  ? 'https://codjiflo.vza.net'
  : `http://localhost:${serverPort}`;

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
    baseURL,
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
  // Start web server when needed (mock mode or prod mode running locally)
  // In CI prod mode, we hit the production site directly
  // When DEV_PORT is set, skip starting server (assumes dev server is already running)
  ...(needsWebServer && !process.env.DEV_PORT ? {
    webServer: {
      command: `npm run build && npm run start -- -p ${serverPort}`,
      url: `http://localhost:${serverPort}`,
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
  } : {}),
});
