/**
 * E2E Test Mode Configuration
 *
 * Controls whether E2E tests run against mocked GitHub API or production.
 *
 * Environment Variable:
 *   E2E_DEPENDENCIES_MODE=mock|prod
 *
 * - mock: Uses Playwright route mocking (default, used in PR CI)
 * - prod: Hits production (codjiflo.vza.net) with real GitHub API (used in main CI)
 */

export type E2EMode = "mock" | "prod";

/**
 * Get the current E2E dependencies mode from environment
 */
export function getE2EMode(): E2EMode {
  const mode = process.env.E2E_DEPENDENCIES_MODE;
  if (mode === "prod") {
    return "prod";
  }
  // Default to mock mode for safety
  return "mock";
}

/**
 * Check if we're in mock mode
 */
export function isMockMode(): boolean {
  return getE2EMode() === "mock";
}

/**
 * Check if we're in prod mode
 */
export function isProdMode(): boolean {
  return getE2EMode() === "prod";
}

/**
 * Get the GitHub token for prod mode tests
 * @throws Error if in prod mode but token is not configured
 */
export function getE2EGitHubToken(): string | undefined {
  const token = process.env.CODJIFLO_E2E_GITHUB_TOKEN;
  if (isProdMode() && !token) {
    throw new Error(
      "E2E_DEPENDENCIES_MODE=prod requires CODJIFLO_E2E_GITHUB_TOKEN to be set"
    );
  }
  return token;
}

/**
 * Get the test token for authentication.
 * Returns mock token in mock mode, real token in prod mode.
 */
export function getTestToken(): string {
  return isMockMode()
    ? "ghp_validtoken123456789"
    : (process.env.CODJIFLO_E2E_GITHUB_TOKEN ?? "");
}

/**
 * Get the invalid test token for testing auth errors.
 */
export function getInvalidTestToken(): string {
  return isMockMode()
    ? "ghp_invalidtoken123456789"
    : prodModeConfig.invalidToken;
}

/**
 * Get test PR parameters based on mode.
 * Returns mock data in mock mode, real repo data in prod mode.
 */
export function getTestPR(): { owner: string; repo: string; prNumber: number } {
  return isMockMode()
    ? { owner: "test", repo: "repo", prNumber: 123 }
    : { owner: prodModeConfig.testRepo.owner, repo: prodModeConfig.testRepo.repo, prNumber: prodModeConfig.testRepo.prNumber };
}

/**
 * Configuration for prod mode E2E tests
 * Uses the CodjiFlo repository for testing
 */
export const prodModeConfig = {
  // CodjiFlo repository for prod mode tests
  testRepo: {
    owner: "pedropaulovc",
    repo: "codjiflo",
    // PR #1 exists and is open
    prNumber: 1,
  },
  // PR with multiple files for keyboard navigation testing
  keyboardNavPR: {
    owner: "pedropaulovc",
    repo: "codjiflo",
    prNumber: 6,
  },
  // Non-existent PR for 404 testing
  notFoundPR: {
    owner: "pedropaulovc",
    repo: "codjiflo",
    prNumber: 0,
  },
  // Invalid PAT for auth error testing
  invalidToken: "ghp_invalidtoken123456789",
} as const;
