import { test, expect } from "@playwright/test";
import {
  setupAuthMock,
  setupPRMock,
  setupFilesMock,
  setupCommentsMock,
  setupIterationMocks,
  setupAuthState,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

test.describe("Private PR Detection", () => {
  const owner = "test";
  const repo = "repo";
  const prNumber = 42;

  test("unauthenticated 404 shows private-repo prompt with login button", async ({
    page,
  }) => {
    await setupLegacyDefaults(page);
    await setupAuthMock(page);
    await setupPRMock(page, owner, repo, prNumber, { failWith: 404 });
    await setupFilesMock(page, owner, repo, prNumber, { failWith: 404 });
    await setupCommentsMock(page, owner, repo, prNumber, { failWith: 404 });
    await setupIterationMocks(page, owner, repo, prNumber);

    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    // Error container with alert role
    const errorContainer = page.getByTestId("pr-error");
    await expect(errorContainer).toHaveAttribute("role", "alert");

    // Lock icon should be present
    await expect(page.getByTestId("pr-error-icon")).toBeVisible();

    // Title should be an h1
    const heading = errorContainer.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();

    // Message should indicate private/missing
    await expect(
      errorContainer.getByText(/may be private or doesn.*t exist/i)
    ).toBeVisible();

    // Login button with returnPath
    const loginButton = errorContainer.getByRole("link", {
      name: /log in to access/i,
    });
    await expect(loginButton).toBeVisible();
    const href = await loginButton.getAttribute("href");
    expect(href).toContain("/login?returnPath=");
    expect(href).toContain(encodeURIComponent(`/${owner}/${repo}/${String(prNumber)}`));

    // Login button should have focus
    await expect(loginButton).toBeFocused();

    // Back to Dashboard link
    await expect(
      errorContainer.getByRole("link", { name: /back to dashboard/i })
    ).toBeVisible();
  });

  test("authenticated 404 shows not-found without login prompt", async ({
    page,
  }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupAuthMock(page);
    await setupPRMock(page, owner, repo, prNumber, { failWith: 404 });
    await setupFilesMock(page, owner, repo, prNumber, { failWith: 404 });
    await setupCommentsMock(page, owner, repo, prNumber, { failWith: 404 });
    await setupIterationMocks(page, owner, repo, prNumber);

    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const errorContainer = page.getByTestId("pr-error");
    await expect(errorContainer).toHaveAttribute("role", "alert");

    // Should say "not found" (not "may be private")
    await expect(
      errorContainer.getByRole("heading", { name: /pull request not found/i })
    ).toBeVisible();

    // No login button
    await expect(
      errorContainer.getByRole("link", { name: /log in/i })
    ).toBeHidden();

    // Back to Dashboard link
    await expect(
      errorContainer.getByRole("link", { name: /back to dashboard/i })
    ).toBeVisible();
  });

  test("unauthenticated 403 shows permission error with login option", async ({
    page,
  }) => {
    await setupLegacyDefaults(page);
    await setupAuthMock(page);
    await setupPRMock(page, owner, repo, prNumber, { failWith: 403 });
    await setupFilesMock(page, owner, repo, prNumber, { failWith: 403 });
    await setupCommentsMock(page, owner, repo, prNumber, { failWith: 403 });
    await setupIterationMocks(page, owner, repo, prNumber);

    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const errorContainer = page.getByTestId("pr-error");
    await expect(errorContainer).toHaveAttribute("role", "alert");

    // Unauthenticated 403 is treated as private-repo (isPrivateRepo flag set by client)
    await expect(
      errorContainer.getByText(/may be private or doesn.*t exist/i)
    ).toBeVisible();

    // Login option
    const loginButton = errorContainer.getByRole("link", {
      name: /log in to access/i,
    });
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeFocused();
  });

  test("authenticated 403 shows permission error without login button", async ({
    page,
  }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupAuthMock(page);
    await setupPRMock(page, owner, repo, prNumber, { failWith: 403 });
    await setupFilesMock(page, owner, repo, prNumber, { failWith: 403 });
    await setupCommentsMock(page, owner, repo, prNumber, { failWith: 403 });
    await setupIterationMocks(page, owner, repo, prNumber);

    await page.goto(`/${owner}/${repo}/${String(prNumber)}`);

    const errorContainer = page.getByTestId("pr-error");
    await expect(errorContainer).toHaveAttribute("role", "alert");

    // Permission message with request access guidance
    await expect(
      errorContainer.getByText(/don.*t have permission.*request access/i)
    ).toBeVisible();

    // No login button
    await expect(
      errorContainer.getByRole("link", { name: /log in/i })
    ).toBeHidden();
  });
});
