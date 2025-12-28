/**
 * Centralized GitHub API Mock Handlers
 *
 * Provides conditional mocking based on E2E_DEPENDENCIES_MODE.
 * In mock mode: intercepts GitHub API calls with mock data
 * In real mode: passes through to actual GitHub API
 */

import { Page } from "@playwright/test";
import { isMockMode } from "./mode";

// ============================================================================
// Mock Data Types
// ============================================================================

export interface MockUser {
  id: number;
  login: string;
  avatar_url?: string;
}

export interface MockPR {
  id: number;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  merged: boolean;
  draft: boolean;
  user: MockUser;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface MockFile {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
  /** Full file content for base (original) version */
  baseContent?: string;
  /** Full file content for head (modified) version */
  headContent?: string;
}

export interface MockComment {
  id: number;
  body: string;
  user: MockUser;
  created_at: string;
  updated_at: string;
  path: string;
  line: number;
  side: "LEFT" | "RIGHT";
  position: number;
}

// ============================================================================
// Default Mock Data
// ============================================================================

export const defaultMockUser: MockUser = {
  id: 1,
  login: "testuser",
  avatar_url: "https://avatars.githubusercontent.com/u/1",
};

export const defaultMockPR: MockPR = {
  id: 1,
  number: 123,
  title: "Test PR",
  body: "Test PR description",
  state: "open",
  merged: false,
  draft: false,
  user: defaultMockUser,
  head: { ref: "feature/test", sha: "abc123" },
  base: { ref: "main", sha: "def456" },
  html_url: "https://github.com/test/repo/pull/123",
  created_at: "2024-01-01T10:00:00Z",
  updated_at: "2024-01-02T15:00:00Z",
};

// ============================================================================
// Mock Setup Functions (only apply in mock mode)
// ============================================================================

/**
 * Set up authentication mock for /user endpoint
 * In mock mode: returns mock user data
 * In real mode: no-op (uses real API)
 */
export async function setupAuthMock(
  page: Page,
  options?: { user?: MockUser; failWith?: number }
): Promise<void> {
  if (!isMockMode()) return;

  await page.route("https://api.github.com/user", async (route) => {
    if (options?.failWith) {
      await route.fulfill({
        status: options.failWith,
        contentType: "application/json",
        body: JSON.stringify({ message: "Bad credentials" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(options?.user ?? defaultMockUser),
      });
    }
  });
}

/**
 * Set up PR data mock
 * In mock mode: returns mock PR data
 * In real mode: no-op (uses real API)
 */
export async function setupPRMock(
  page: Page,
  owner: string,
  repo: string,
  prNumber: number,
  options?: { pr?: MockPR; failWith?: number }
): Promise<void> {
  if (!isMockMode()) return;

  await page.route(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${String(prNumber)}`,
    async (route) => {
      if (options?.failWith) {
        await route.fulfill({
          status: options.failWith,
          contentType: "application/json",
          body: JSON.stringify({ message: "Not Found" }),
        });
      } else {
        const pr = options?.pr ?? {
          ...defaultMockPR,
          number: prNumber,
          html_url: `https://github.com/${owner}/${repo}/pull/${String(prNumber)}`,
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(pr),
        });
      }
    }
  );
}

/**
 * Set up PR files mock
 * In mock mode: returns mock file data
 * In real mode: no-op (uses real API)
 */
export async function setupFilesMock(
  page: Page,
  owner: string,
  repo: string,
  prNumber: number,
  options?: { files?: MockFile[]; failWith?: number }
): Promise<void> {
  if (!isMockMode()) return;

  await page.route(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${String(prNumber)}/files`,
    async (route) => {
      if (options?.failWith) {
        await route.fulfill({
          status: options.failWith,
          contentType: "application/json",
          body: JSON.stringify({ message: "Not Found" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(options?.files ?? []),
        });
      }
    }
  );
}

/**
 * Set up PR comments mock
 * In mock mode: returns mock comment data
 * In real mode: no-op (uses real API)
 */
export async function setupCommentsMock(
  page: Page,
  owner: string,
  repo: string,
  prNumber: number,
  options?: { comments?: MockComment[]; failWith?: number }
): Promise<void> {
  if (!isMockMode()) return;

  await page.route(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${String(prNumber)}/comments`,
    async (route) => {
      if (options?.failWith) {
        await route.fulfill({
          status: options.failWith,
          contentType: "application/json",
          body: JSON.stringify({ message: "Not Found" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(options?.comments ?? []),
        });
      }
    }
  );
}

/**
 * Set up file contents mock for full file view
 * In mock mode: returns mock file content
 * In real mode: no-op (uses real API)
 */
export async function setupFileContentsMock(
  page: Page,
  owner: string,
  repo: string,
  files: MockFile[],
  pr: MockPR
): Promise<void> {
  if (!isMockMode()) return;

  // Mock contents API for each file with baseContent/headContent
  for (const file of files) {
    if (!file.baseContent && !file.headContent) continue;

    // Encode path segments individually (matches backend encoding)
    const encodedPath = file.filename.split('/').map(encodeURIComponent).join('/');

    // Mock base version (original)
    if (file.baseContent) {
      await page.route(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(pr.base.sha)}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              type: "file",
              encoding: "base64",
              content: Buffer.from(file.baseContent ?? "").toString("base64"),
              path: file.filename,
              sha: pr.base.sha,
            }),
          });
        }
      );
    }

    // Mock head version (modified)
    if (file.headContent) {
      await page.route(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(pr.head.sha)}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              type: "file",
              encoding: "base64",
              content: Buffer.from(file.headContent ?? "").toString("base64"),
              path: file.filename,
              sha: pr.head.sha,
            }),
          });
        }
      );
    }
  }
}

/**
 * Set up all mocks for a complete PR view test
 * Convenience function that sets up PR, files, and comments mocks
 */
export async function setupFullPRMocks(
  page: Page,
  owner: string,
  repo: string,
  prNumber: number,
  options?: {
    pr?: MockPR;
    files?: MockFile[];
    comments?: MockComment[];
  }
): Promise<void> {
  if (!isMockMode()) return;

  if (options?.pr) {
    await setupPRMock(page, owner, repo, prNumber, { pr: options.pr });
  } else {
    await setupPRMock(page, owner, repo, prNumber);
  }

  if (options?.files) {
    await setupFilesMock(page, owner, repo, prNumber, { files: options.files });
  } else {
    await setupFilesMock(page, owner, repo, prNumber);
  }

  if (options?.comments) {
    await setupCommentsMock(page, owner, repo, prNumber, { comments: options.comments });
  } else {
    await setupCommentsMock(page, owner, repo, prNumber);
  }

  // Set up file contents mocks for full file view (if files have content)
  if (options?.files && options?.pr) {
    await setupFileContentsMock(page, owner, repo, options.files, options.pr);
  }
}

/**
 * Set up authentication in localStorage for pre-authenticated tests
 * In mock mode: uses fake token
 * In prod mode: uses real token from env
 */
export async function setupAuthState(page: Page): Promise<void> {
  const token = isMockMode()
    ? "ghp_testtoken123"
    : process.env.CODJIFLO_E2E_GITHUB_TOKEN;

  if (!token && !isMockMode()) {
    throw new Error(
      "CODJIFLO_E2E_GITHUB_TOKEN required for prod mode E2E tests"
    );
  }

  await page.addInitScript(
    (authToken) => {
      localStorage.setItem(
        "auth-storage",
        JSON.stringify({
          state: { token: authToken, isAuthenticated: true },
          version: 0,
        })
      );
    },
    token ?? ""
  );
}
