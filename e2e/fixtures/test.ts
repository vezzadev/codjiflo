/**
 * Custom test fixture that provides dynamic baseURL from the port file.
 * Import { test, expect } from this file instead of @playwright/test.
 */
import { test as base, expect } from "@playwright/test";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT_FILE = join(__dirname, "..", ".port");

/**
 * Get the base URL from the port file written by global-setup.
 * Falls back to production URL for CI prod mode.
 */
function getBaseURL(): string {
  const isCI = !!process.env.CI;
  const isProdMode = process.env.E2E_DEPENDENCIES_MODE === "prod";

  // In CI prod mode, use the production site
  if (isProdMode && isCI) {
    return "https://codjiflo.vza.net";
  }

  // Read port from file
  if (!existsSync(PORT_FILE)) {
    throw new Error(
      `Port file not found at ${PORT_FILE}. Did global-setup run?`
    );
  }

  const port = readFileSync(PORT_FILE, "utf-8").trim();
  if (!port || isNaN(parseInt(port, 10))) {
    throw new Error(`Invalid port in ${PORT_FILE}: ${port}`);
  }

  return `http://localhost:${port}`;
}

/**
 * Extended test with dynamic baseURL.
 * The page fixture automatically uses the correct baseURL.
 */
export const test = base.extend<{ baseURL: string }>({
  baseURL: async ({}, use) => {
    await use(getBaseURL());
  },
  // Override page to use our dynamic baseURL
  page: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
