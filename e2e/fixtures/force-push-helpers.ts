/**
 * Shared force-push E2E test helpers
 *
 * Extracted from collapsed-iterations-ui.spec.ts and
 * collapsed-iterations-expanded.spec.ts to eliminate duplication.
 */

import type { Page } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  setupStatelessIterationMocks,
  type MockPR,
  type MockFile,
} from "./github-mocks";
import { setupLegacyDefaults } from "./legacy-defaults";

// ============================================================================
// Shared constants
// ============================================================================

export const forcePushMockPR: MockPR = {
  id: 1,
  number: 123,
  title: "Test PR for Force Push Scenarios",
  body: "Testing force push iteration scenarios",
  state: "open",
  merged: false,
  draft: false,
  user: {
    id: 1,
    login: "testuser",
    avatar_url: "https://avatars.githubusercontent.com/u/1",
  },
  head: { ref: "feature/test", sha: "abc123" },
  base: { ref: "main", sha: "def456" },
  html_url: "https://github.com/test/repo/pull/123",
  created_at: "2024-01-01T10:00:00Z",
  updated_at: "2024-01-05T15:00:00Z",
};

export const forcePushMockFiles: MockFile[] = [
  {
    filename: "src/test.ts",
    status: "modified",
    additions: 10,
    deletions: 5,
    changes: 15,
    patch: "@@ -1,5 +1,10 @@\n+// New code\n const x = 1;",
  },
];

export const forcePushConfig = {
  owner: "test",
  repo: "repo",
  prNumber: 123,
  pageUrl: "/test/repo/123",
};

// ============================================================================
// Setup helpers
// ============================================================================

export interface ForcePushScenarioOptions {
  eventId: number;
  beforeSha: string;
  afterSha: string;
  liveCommits: {
    sha: string;
    message: string;
    author: string;
    date: string;
  }[];
  compareResponse:
    | {
        status: 200;
        commits: {
          sha: string;
          message: string;
          authorName: string;
          authorLogin: string;
          date: string;
        }[];
      }
    | { status: 404 };
}

/**
 * Set up common beforeEach mocks for force-push tests:
 * legacy defaults, auth state, and full PR mocks.
 */
export async function setupForcePushDefaults(page: Page): Promise<void> {
  await setupLegacyDefaults(page);
  await setupAuthState(page);
  await setupFullPRMocks(
    page,
    forcePushConfig.owner,
    forcePushConfig.repo,
    forcePushConfig.prNumber,
    {
      pr: forcePushMockPR,
      files: forcePushMockFiles,
    }
  );
}

/**
 * Set up a force-push scenario with mock timeline and compare API.
 */
export async function setupForcePushScenario(
  page: Page,
  options: ForcePushScenarioOptions
): Promise<void> {
  await setupStatelessIterationMocks(
    page,
    forcePushConfig.owner,
    forcePushConfig.repo,
    forcePushConfig.prNumber,
    {
      commits: options.liveCommits,
      timeline: [
        {
          id: 0,
          event: "committed",
          created_at: "2024-01-01T12:00:00Z",
          sha: options.beforeSha,
        },
        {
          id: options.eventId,
          event: "head_ref_force_pushed",
          created_at: "2024-01-02T12:00:00Z",
          commit_id: options.afterSha,
        },
      ],
    }
  );

  await page.route(
    `https://api.github.com/repos/${forcePushConfig.owner}/${forcePushConfig.repo}/compare/${options.afterSha}...${options.beforeSha}`,
    async (route) => {
      if (options.compareResponse.status === 404) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ message: "Not Found" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          commits: options.compareResponse.commits.map((c) => ({
            sha: c.sha,
            commit: {
              message: c.message,
              author: { name: c.authorName, date: c.date },
            },
            author: { login: c.authorLogin },
          })),
        }),
      });
    }
  );
}
