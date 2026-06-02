import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Load .env.local for local development (may contain GITHUB_TOKEN)
const envLocalPath = ".env.local";
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, quiet: true });
}

const isCI = !!process.env.CI;
const e2eMode = process.env.E2E_DEPENDENCIES_MODE ?? 'mock';
const isProdMode = e2eMode === 'prod';
const externalBaseURL = process.env.E2E_BASE_URL;

// Local dev convenience: if prod mode is requested without an explicit token,
// reuse the GitHub CLI's OAuth token (`gh auth token`). This lets any developer
// already logged into `gh` run prod-mode E2E with no PAT and no .env.local entry.
// Skipped in CI, where the workflow injects the built-in github.token.
if (isProdMode && !isCI && !process.env.GITHUB_TOKEN) {
  try {
    process.env.GITHUB_TOKEN = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
    }).trim();
  } catch {
    // gh missing or not logged in — fall through to the validation error below.
  }
}

// Validate prod mode requirements
if (isProdMode && !process.env.GITHUB_TOKEN) {
  throw new Error(
    "E2E prod mode requires GITHUB_TOKEN.\n" +
      "Locally: run `gh auth login` (it is read automatically) or set GITHUB_TOKEN in .env.local.\n" +
      "CI: injected as GITHUB_TOKEN."
  );
}

// Determine test patterns based on mode
// Mock mode runs: e2e/mock/**/*.spec.ts + e2e/common/**/*.spec.ts
// Prod mode runs: e2e/prod/**/*.spec.ts + e2e/common/**/*.spec.ts
const modeDir = isProdMode ? "prod" : "mock";
const testMatch = [
  `e2e/${modeDir}/**/*.spec.ts`,
  "e2e/common/**/*.spec.ts"
];

export default defineConfig({
  testDir: "./e2e",
  testMatch,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  timeout: 5000,
  expect: {
    timeout: 2000,
  },
  reporter: "html",
  use: {
    // E2E_BASE_URL: external deployment (CI). E2E_PORT: local webServer (dev).
    baseURL: externalBaseURL ?? `http://localhost:${process.env.E2E_PORT}`,
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
  // Skip local build when running against an external deployment (CI)
  ...(!externalBaseURL && {
    webServer: {
      command: "npm run build && npm run start -- -p 0",
      // Wait for Next.js to output port and capture it in E2E_PORT env var
      wait: { stdout: /localhost:(?<E2E_PORT>\d+)/ },
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
  }),
});
