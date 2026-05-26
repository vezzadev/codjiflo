/**
 * HTTP cache integration test using a local HTTPS fixture server (issue #494).
 *
 * ## Why this test exists
 *
 * The companion E2E `soft-refresh-cache-bypass.spec.ts` covers the
 * user-visible reload flow but uses a mutable closure variable inside the
 * `route.fulfill()` handler: Playwright's `page.route` interception bypasses
 * the browser HTTP cache entirely, so removing `cache: 'no-cache'` from
 * githubClient would still pass that test — the handler always returns the
 * latest fixture state immediately.
 *
 * This test plugs that gap by exercising the **real browser HTTP cache**:
 *
 * - A local HTTPS fixture server (using a self-signed certificate) serves the
 *   comments endpoint with `Cache-Control: public, max-age=60`, mirroring
 *   api.github.com's production headers.
 * - A Playwright route intercepts `https://api.github.com/…/comments` and
 *   calls `route.continue({ url: fixture.rewriteUrl(…) })` — HTTPS→HTTPS,
 *   which Playwright permits — so the browser fetches from the fixture server
 *   and applies its real HTTP caching machinery for that URL.
 * - On the initial load the browser caches the v1 response.
 * - After the fixture state is advanced to v2, `page.reload()` triggers a
 *   fresh fetch.
 *
 * ## How the regression is caught
 *
 * - WITH `cache: 'no-cache'` in githubClient: the browser bypasses its cache
 *   for the fixture URL → fixture server returns v2 → iteration-tab-3 is
 *   rendered → PASS ✓
 * - WITHOUT `cache: 'no-cache'` (regression): the browser serves the cached
 *   v1 response and does NOT contact the fixture server → only 2 tabs →
 *   iteration-tab-3 absent → FAIL ✓
 *
 * ## Related
 * - Issue #494 (root-cause bug)
 * - PR #495 (fix: added `cache: 'no-cache'` to githubClient)
 * - `src/api/github/github-client.test.ts` (unit tests that spy on fetch options)
 * - `e2e/fixtures/cache-fixture-server.ts` (the reusable HTTPS fixture server)
 */

import { test, expect } from "@playwright/test";
import JSZip from "jszip";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../../fixtures/github-mocks";
import { buildIterationDb } from "../../../fixtures/iteration-db-builder";
import { setupLegacyDefaults } from "../../../fixtures/legacy-defaults";
import { startCacheFixtureServer, type CacheFixtureServer } from "../../../fixtures/cache-fixture-server";

test.describe("HTTP cache bypass via real local HTTPS server (issue #494)", () => {
  // Accept the fixture server's self-signed certificate in this describe block.
  test.use({ ignoreHTTPSErrors: true });

  // ──────────────────────────────────────────────────────────────────────────
  // Fixture server lifecycle
  // ──────────────────────────────────────────────────────────────────────────

  let fixture: CacheFixtureServer;

  test.beforeAll(async () => {
    fixture = await startCacheFixtureServer();
  });

  test.afterAll(async () => {
    await fixture.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Shared test data (mirrors soft-refresh-cache-bypass.spec.ts)
  // ──────────────────────────────────────────────────────────────────────────

  const initialFiles = {
    "src/app.ts": `export function main() {
  return 0;
}
`,
  };

  const patch1 = `From abc1111 Mon Sep 17 00:00:00 2001
From: Test User <test@example.com>
Date: Thu, 2 Jan 2026 10:00:00 +0000
Subject: [PATCH] feat: first

diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 export function main() {
+  console.log("one");
   return 0;
 }
`;

  const patch2 = `From abc2222 Mon Sep 17 00:00:00 2001
From: Test User <test@example.com>
Date: Thu, 2 Jan 2026 11:00:00 +0000
Subject: [PATCH] feat: second

diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,4 +1,5 @@
 export function main() {
   console.log("one");
+  console.log("two");
   return 0;
 }
`;

  const patch3 = `From abc3333 Mon Sep 17 00:00:00 2001
From: Test User <test@example.com>
Date: Thu, 2 Jan 2026 12:00:00 +0000
Subject: [PATCH] feat: third

diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,5 +1,6 @@
 export function main() {
   console.log("one");
   console.log("two");
+  console.log("three");
   return 0;
 }
`;

  const mockPR: MockPR = {
    id: 494,
    number: 494,
    title: "Issue 494 regression",
    body: "",
    state: "open",
    merged: false,
    draft: false,
    user: { id: 1, login: "testuser" },
    head: { ref: "feature/x", sha: "abc3333" },
    base: { ref: "main", sha: "base-sha" },
    html_url: "https://github.com/test/repo/pull/494",
    created_at: "2026-01-02T10:00:00Z",
    updated_at: "2026-01-02T12:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/app.ts",
      status: "modified",
      additions: 3,
      deletions: 0,
      changes: 3,
      patch: `@@ -1,3 +1,6 @@
 export function main() {
+  console.log("one");
+  console.log("two");
+  console.log("three");
   return 0;
 }`,
      baseContent: initialFiles["src/app.ts"],
      headContent: `export function main() {
  console.log("one");
  console.log("two");
  console.log("three");
  return 0;
}
`,
    },
  ];

  // ──────────────────────────────────────────────────────────────────────────
  // Test
  // ──────────────────────────────────────────────────────────────────────────

  test(
    "new iteration appears after soft refresh — real browser HTTP cache exercised",
    async ({ page }) => {
      // ── Prepare iteration databases ────────────────────────────────────────
      const mockDb2 = buildIterationDb({
        initialFiles,
        patches: [patch1, patch2],
      });
      const mockDb3 = buildIterationDb({
        initialFiles,
        patches: [patch1, patch2, patch3],
      });

      const zip2 = await new JSZip()
        .file("iterations.db", mockDb2.buffer)
        .generateAsync({ type: "nodebuffer" });
      const zip3 = await new JSZip()
        .file("iterations.db", mockDb3.buffer)
        .generateAsync({ type: "nodebuffer" });

      // ── Mutable server state ───────────────────────────────────────────────
      const ARTIFACT_ID_V1 = 494111;
      const ARTIFACT_ID_V2 = 494222;
      let currentArtifactId = ARTIFACT_ID_V1;
      let currentIterationCount = 2;
      let currentTimestamp = "2026-05-20T10:00:00Z";

      // ── Prime the fixture server with v1 ───────────────────────────────────
      // The fixture server serves this path with Cache-Control: public,
      // max-age=60 so the browser will cache the first response.
      const commentsPath = "/repos/test/repo/issues/494/comments";
      fixture.setResponse(commentsPath, [
        {
          id: 999494,
          body: `<!-- codjiflo-data -->
### CodjiFlo Iteration Tracking
**Iterations captured**: ${String(currentIterationCount)}
**Last updated**: ${currentTimestamp}
**Artifact**: \`${String(currentArtifactId)}\`
**Run ID**: 12345`,
          user: { login: "github-actions[bot]", id: 41898282 },
          created_at: currentTimestamp,
          updated_at: currentTimestamp,
        },
      ]);

      // ── Standard Playwright mocks (PR, files, PR review comments, etc.) ────
      await setupLegacyDefaults(page);
      await setupAuthState(page);
      // setupFullPRMocks also calls setupIterationMocks which registers a
      // route.fulfill() for the issue comments endpoint (returns []). The
      // handler we register below takes LIFO priority over that route.
      await setupFullPRMocks(page, "test", "repo", 494, {
        pr: mockPR,
        files: mockFiles,
      });

      // ── Mock artifact ZIP downloads ────────────────────────────────────────
      await page.route(
        new RegExp(`actions/artifacts/${String(ARTIFACT_ID_V1)}/zip`),
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/zip",
            body: zip2,
          });
        }
      );
      await page.route(
        new RegExp(`actions/artifacts/${String(ARTIFACT_ID_V2)}/zip`),
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/zip",
            body: zip3,
          });
        }
      );

      // ── Route comments through the real HTTPS fixture server ───────────────
      // `route.continue({ url })` requires the new URL to share the same
      // protocol as the intercepted URL.  Both are HTTPS here, so Playwright
      // accepts the override.  The browser then fetches
      // https://127.0.0.1:<port>/… through its full network stack — including
      // its HTTP cache — rather than returning a synthesised response.
      //
      // Flow:
      //   initial load  → cache MISS for fixture URL → hits server → v1 cached
      //   reload (with cache:'no-cache')    → cache BYPASS → server returns v2
      //   reload (without cache:'no-cache') → cache HIT   → stale v1 served
      //
      // This route takes LIFO priority over setupIterationMocks's handler.
      fixture.resetCounts();
      await page.route(
        "https://api.github.com/repos/test/repo/issues/494/comments",
        async (route) => {
          await route.continue({
            url: fixture.rewriteUrl(route.request().url()),
          });
        }
      );

      // ── Initial load: expect 2 iteration tabs ─────────────────────────────
      await page.goto("/test/repo/494");
      await page.waitForLoadState("load");

      const selector = page.getByTestId("iteration-selector");
      await expect(selector).toBeVisible();
      await expect(page.getByTestId("iteration-tab-1")).toBeVisible();
      await expect(page.getByTestId("iteration-tab-2")).toBeVisible();
      await expect(page.getByTestId("iteration-tab-3")).toHaveCount(0);

      // Sanity: fixture server was hit on the initial load (cache miss)
      expect(fixture.getRequestCount(commentsPath)).toBeGreaterThanOrEqual(1);

      // ── Simulate a new push: update fixture server state to v2 ────────────
      currentArtifactId = ARTIFACT_ID_V2;
      currentIterationCount = 3;
      currentTimestamp = "2026-05-20T10:05:00Z";
      fixture.setResponse(commentsPath, [
        {
          id: 999494,
          body: `<!-- codjiflo-data -->
### CodjiFlo Iteration Tracking
**Iterations captured**: ${String(currentIterationCount)}
**Last updated**: ${currentTimestamp}
**Artifact**: \`${String(currentArtifactId)}\`
**Run ID**: 12345`,
          user: { login: "github-actions[bot]", id: 41898282 },
          created_at: currentTimestamp,
          updated_at: currentTimestamp,
        },
      ]);

      // ── Soft refresh (equivalent to F5 — NOT Ctrl+F5) ─────────────────────
      // With `cache: 'no-cache'` in githubClient: the browser bypasses its
      // cache for the fixture URL → fixture server is hit → v2 returned →
      // iteration-tab-3 appears. → TEST PASSES ✓
      //
      // Without `cache: 'no-cache'` (regression): the browser serves the
      // cached v1 response for the fixture URL → fixture server is NOT hit →
      // only 2 tabs; iteration-tab-3 never becomes visible. → TEST FAILS ✓
      await page.reload();
      await page.waitForLoadState("load");

      await expect(page.getByTestId("iteration-tab-3")).toBeVisible();
      await expect(page.getByTestId("iteration-tab-1")).toBeVisible();
      await expect(page.getByTestId("iteration-tab-2")).toBeVisible();

      // The fixture server must have been contacted again after the reload
      // (i.e. the browser did NOT serve a cached response).
      expect(fixture.getRequestCount(commentsPath)).toBeGreaterThanOrEqual(2);
    }
  );
});
