import { test, expect } from "@playwright/test";
import {
  setupFullPRMocks,
  setupPRCommitsMock,
  type MockPR,
  type MockFile,
  type MockPRCommit,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Stateless Iteration Loading (S-4.2.1)", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 42,
    title: "Test PR for Stateless Iterations",
    body: "Testing commit-based iteration loading",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feature/test", sha: "commit-sha-003" },
    base: { ref: "main", sha: "base-sha-000" },
    html_url: "https://github.com/test/repo/pull/42",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-03T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/test.ts",
      status: "modified",
      additions: 5,
      deletions: 2,
      changes: 7,
      patch:
        "@@ -1,3 +1,6 @@\n const x = 1;\n-const y = 2;\n+const y = 3;\n+const z = 4;\n+const w = 5;",
    },
  ];

  const mockCommits: MockPRCommit[] = [
    {
      sha: "commit-sha-001",
      commit: {
        message: "First commit",
        author: {
          name: "Dev",
          email: "dev@test.com",
          date: "2025-01-01T00:00:00Z",
        },
      },
      author: { id: 1, login: "dev", avatar_url: "" },
    },
    {
      sha: "commit-sha-002",
      commit: {
        message: "Second commit",
        author: {
          name: "Dev",
          email: "dev@test.com",
          date: "2025-01-02T00:00:00Z",
        },
      },
      author: { id: 1, login: "dev", avatar_url: "" },
    },
    {
      sha: "commit-sha-003",
      commit: {
        message: "Third commit",
        author: {
          name: "Dev",
          email: "dev@test.com",
          date: "2025-01-03T00:00:00Z",
        },
      },
      author: { id: 1, login: "dev", avatar_url: "" },
    },
  ];

  const config = {
    owner: "test",
    repo: "repo",
    prNumber: 42,
    pageUrl: "/test/repo/42",
  };

  test("Loads iterations from commits when Timeline API is unavailable (unauthenticated)", async ({
    page,
  }) => {
    await setupLegacyDefaults(page);
    // No auth state — unauthenticated user
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });

    // Override the default empty timeline mock with a 403 to simulate
    // the real unauthenticated scenario where Timeline API requires auth
    await page.route(
      `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${String(config.prNumber)}/timeline**`,
      async (route) => {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ message: "Resource not accessible by personal access token" }),
        });
      }
    );

    // Override the default empty commits mock with actual commits
    await setupPRCommitsMock(
      page,
      config.owner,
      config.repo,
      config.prNumber,
      mockCommits
    );

    // Set up console listener BEFORE navigation to avoid race condition
    const infoPromise = page.waitForEvent("console", {
      predicate: (msg) =>
        msg.type() === "info" &&
        msg.text().includes("[CodjiFlo] Loaded") &&
        msg.text().includes("stateless iteration"),
    });

    await page.goto(config.pageUrl);

    // Wait for stateless iterations to be loaded (verified via console log)
    const infoMsg = await infoPromise;
    expect(infoMsg.text()).toContain("3 stateless iteration(s)");

    // Verify the page still functions normally - file list renders
    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
  });
});
