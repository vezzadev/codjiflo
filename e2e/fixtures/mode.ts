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
 * Configuration for prod mode E2E tests
 * Uses the dedicated E2E test repository
 */
export const prodModeConfig = {
  // E2E test repository
  testRepo: {
    owner: "pedropaulovc",
    repo: "codjiflo-e2e-test-repo",
    // PR #1: Comment Positioning - has comments on various line types
    prNumber: 1,
  },
  // PR with multiple files for keyboard navigation testing
  keyboardNavPR: {
    owner: "pedropaulovc",
    repo: "codjiflo-e2e-test-repo",
    // PR #3: File Operations - has 3 files (new, delete marker, renamed)
    prNumber: 3,
  },
  // PR for diff view testing (has content changes)
  diffViewPR: {
    owner: "pedropaulovc",
    repo: "codjiflo-e2e-test-repo",
    // PR #1: Comment Positioning - has file modifications
    prNumber: 1,
  },
  // PR with comments for comment flow testing
  commentsPR: {
    owner: "pedropaulovc",
    repo: "codjiflo-e2e-test-repo",
    // PR #2: Comment Threading - has multiple comment threads
    prNumber: 2,
  },
  // Non-existent PR for 404 testing
  notFoundPR: {
    owner: "pedropaulovc",
    repo: "codjiflo-e2e-test-repo",
    prNumber: 9999,
  },
  // Invalid PAT for auth error testing
  invalidToken: "ghp_invalidtoken123456789",
} as const;
