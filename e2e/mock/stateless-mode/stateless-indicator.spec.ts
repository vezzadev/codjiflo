import { test, expect } from "@playwright/test";
import {
  setupAuthMock,
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

const owner = "test";
const repo = "repo";
const prNumber = 123;
const pageUrl = "/test/repo/123";

const mockPR: MockPR = {
  id: 1,
  number: prNumber,
  title: "Stateless indicator PR",
  body: "Body",
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
  updated_at: "2024-01-02T15:00:00Z",
};

const mockFiles: MockFile[] = [
  {
    filename: "src/test.ts",
    status: "modified",
    additions: 10,
    deletions: 5,
    changes: 15,
    patch: "@@ -1,5 +1,10 @@\n+// New code\n const x = 1;",
  },
];

/**
 * Inject a PR comment carrying the CodjiFlo artifact reference marker, while
 * making the artifact ZIP download fail. This is the real-world "unauthenticated"
 * stateless path: an artifact reference EXISTS (so data is available once signed
 * in) but the anonymous session cannot download it -> statelessReason
 * 'unauthenticated'. Overrides the empty issues-comments route from
 * setupFullPRMocks (Playwright routes are LIFO).
 */
async function injectArtifactReferenceWithFailedDownload(page: import("@playwright/test").Page) {
  const artifactId = 987654321;
  await page.route(
    `https://api.github.com/repos/${owner}/${repo}/issues/${String(prNumber)}/comments`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 999999,
            body: `<!-- codjiflo-data -->
### CodjiFlo Iteration Tracking
**Iterations captured**: 3
**Last updated**: 2024-01-02T10:00:00Z
**Artifact**: \`${String(artifactId)}\`
**Run ID**: 12345678`,
            user: { login: "github-actions[bot]", id: 41898282 },
            created_at: "2024-01-02T10:00:00Z",
            updated_at: "2024-01-02T10:00:00Z",
          },
        ]),
      });
    }
  );
  // Anonymous artifact download is rejected -> loader.load() resolves null.
  await page.route(/actions\/artifacts\/.*\/zip/, async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ message: "Must be authenticated" }),
    });
  });
}

test.describe("Stateless-mode indicator", () => {
  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
  });

  test("no-artifact: signed-in PR with no CodjiFlo artifact shows the neutral info pill, not a sign-in action", async ({
    page,
  }) => {
    await setupAuthState(page);
    await setupFullPRMocks(page, owner, repo, prNumber, {
      pr: mockPR,
      files: mockFiles,
    });

    await page.goto(pageUrl);

    const indicator = page.getByTestId("stateless-indicator");
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText(/stateless/i);
    await expect(indicator).toHaveClass(/stateless-indicator--info/);
    // Adversarial: a lazy impl that always renders the sign-in variant must fail.
    await expect(indicator).not.toHaveClass(/stateless-indicator--action/);
    await expect(indicator).not.toContainText(/sign in/i);

    // It is placed beside the iteration tabs, inside the diff header iterations row.
    const headerRow = page.getByTestId("diff-header-iterations").first();
    await expect(headerRow.getByTestId("stateless-indicator")).toBeVisible();
  });

  test("unauthenticated: signed-out PR with an artifact reference shows the sign-in action pill", async ({
    page,
  }) => {
    // Signed out: setupAuthMock validates a token IF present, but we never call
    // setupAuthState, so the auth store has no token (real anonymous session).
    await setupAuthMock(page);
    await setupFullPRMocks(page, owner, repo, prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
    await injectArtifactReferenceWithFailedDownload(page);

    await page.goto(pageUrl);

    const indicator = page.getByTestId("stateless-indicator");
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText(/sign in/i);
    await expect(indicator).toHaveClass(/stateless-indicator--action/);
    await expect(indicator).not.toHaveClass(/stateless-indicator--info/);
  });

  test("unauthenticated: pressing the sign-in pill starts the GitHub OAuth flow", async ({
    page,
  }) => {
    await setupAuthMock(page);
    await setupFullPRMocks(page, owner, repo, prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
    await injectArtifactReferenceWithFailedDownload(page);

    // Intercept the GitHub OAuth redirect so the click proves initiateOAuth ran
    // through a real user action (not a stub) without actually leaving to github.com.
    let oauthRequested = false;
    await page.route(
      "https://github.com/login/oauth/authorize**",
      async (route) => {
        oauthRequested = true;
        await route.abort();
      }
    );

    await page.goto(pageUrl);

    const indicator = page.getByTestId("stateless-indicator");
    await expect(indicator).toContainText(/sign in/i);

    await indicator.click();

    await expect
      .poll(() => oauthRequested, { message: "expected GitHub OAuth redirect" })
      .toBe(true);
  });
});
