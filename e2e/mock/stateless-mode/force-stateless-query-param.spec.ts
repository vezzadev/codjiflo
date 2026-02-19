/**
 * Force Stateless Mode via Query Parameter
 *
 * Tests for S-4.2.9: ?mode=stateless query parameter that bypasses artifact
 * loading and forces commit-based iteration detection.
 *
 * Spec references: AC-4.2.9.1, AC-4.2.9.2, AC-4.2.9.3, AC-4.2.9.8
 */

import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupAuthMock,
  setupFullPRMocks,
  setupIterationArtifactMock,
  setupStatelessIterationMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";
import { buildIterationDb } from "../../fixtures/iteration-db-builder";

test.describe("Force Stateless Mode via ?mode=stateless", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 789,
    title: "PR with artifact AND stateless override",
    body: "Testing ?mode=stateless query param",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/stateless-test", sha: "head-sha-789" },
    base: { ref: "main", sha: "base-sha-789" },
    html_url: "https://github.com/test/repo/pull/789",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-05T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/main.ts",
      status: "modified",
      additions: 3,
      deletions: 1,
      changes: 4,
      patch: "@@ -1,1 +1,3 @@\n+// test\n const y = 2;",
    },
  ];

  const config = {
    owner: "test",
    repo: "repo",
    prNumber: 789,
  };

  // Artifact data: 2 iterations via initialFiles + patches
  const initialFiles = {
    "src/main.ts": "const y = 2;\n",
  };

  const artifactPatch1 = `diff --git a/src/main.ts b/src/main.ts
index 1234567..abcdefg 100644
--- a/src/main.ts
+++ b/src/main.ts
@@ -1 +1,2 @@
+// iteration 1
 const y = 2;
`;

  const artifactPatch2 = `diff --git a/src/main.ts b/src/main.ts
index abcdefg..bcdefgh 100644
--- a/src/main.ts
+++ b/src/main.ts
@@ -1,2 +1,3 @@
+// iteration 2
 // iteration 1
 const y = 2;
`;

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupAuthMock(page);
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  test("?mode=stateless skips artifact and uses commit-based iterations", async ({
    page,
  }) => {
    // Set up an artifact with 2 iterations (stateful mode would normally be used)
    const mockDb = buildIterationDb({
      initialFiles,
      patches: [artifactPatch1, artifactPatch2],
      baseSha: "base-sha-789",
    });

    await setupIterationArtifactMock(
      page,
      config.owner,
      config.repo,
      config.prNumber,
      mockDb
    );

    // Set up stateless iteration data (3 commits via Commits API)
    // These are DIFFERENT count from artifact (3 vs 2) to distinguish modes
    await setupStatelessIterationMocks(
      page,
      config.owner,
      config.repo,
      config.prNumber,
      {
        commits: [
          {
            sha: "stateless-commit-1",
            message: "Stateless commit 1",
            author: "statelessuser",
            date: "2024-01-01T10:00:00Z",
          },
          {
            sha: "stateless-commit-2",
            message: "Stateless commit 2",
            author: "statelessuser",
            date: "2024-01-02T10:00:00Z",
          },
          {
            sha: "stateless-commit-3",
            message: "Stateless commit 3",
            author: "statelessuser",
            date: "2024-01-03T10:00:00Z",
          },
        ],
      }
    );

    // Navigate WITH ?mode=stateless query param — should bypass artifact
    await page.goto(
      `/${config.owner}/${config.repo}/${String(config.prNumber)}?mode=stateless`
    );

    // Wait for iteration selector to appear
    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();

    // Should show 3 iterations (from commits API, NOT 2 from artifact)
    await expect(page.getByTestId("iteration-tab-3")).toBeVisible();

    // Verify there are exactly 3 iteration tabs (not 2 from artifact)
    const iterationCount = await page.getByTestId(/^iteration-tab-/).count();
    expect(iterationCount).toBe(3);

    // Verify the store entered stateless mode by checking the console log
    // The store should log "Entering stateless mode: forced via query param"
  });

  test("?mode=stateless emits console log confirming forced stateless mode", async ({
    page,
  }) => {
    // No artifact needed — even without artifact, the query param should be detected
    await setupStatelessIterationMocks(
      page,
      config.owner,
      config.repo,
      config.prNumber,
      {
        commits: [
          {
            sha: "commit-1",
            message: "Commit 1",
            author: "testuser",
            date: "2024-01-01T10:00:00Z",
          },
        ],
      }
    );

    // Set up console listener BEFORE navigation
    const consolePromise = page.waitForEvent("console", {
      predicate: (msg) =>
        msg.type() === "info" &&
        msg.text().includes("forced via query param"),
    });

    await page.goto(
      `/${config.owner}/${config.repo}/${String(config.prNumber)}?mode=stateless`
    );

    // The store should log about forced stateless mode
    const consoleMsg = await consolePromise;
    expect(consoleMsg.text()).toContain("stateless mode");
  });
});
