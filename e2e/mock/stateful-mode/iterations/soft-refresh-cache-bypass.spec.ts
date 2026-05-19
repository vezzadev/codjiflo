/**
 * Regression test for issue #494.
 *
 * The user-visible bug: after pushing a new commit to a PR, soft refresh
 * (F5 / Ctrl+R) did not show the new iteration in the iteration selector.
 * Only Ctrl+F5 (hard refresh) worked. Root cause: GitHub returns
 * `cache-control: public, max-age=60` and fetch() used the default cache
 * mode, so the browser served the OLD codjiflo-data comment from the HTTP
 * cache. The parsed artifactId/timestamp matched the IndexedDB cache and
 * the SPA kept showing the stale iteration set.
 *
 * The fix is `cache: 'no-cache'` in the github-client fetch options.
 *
 * Test coverage scope: this E2E covers the user-visible reload flow —
 * route handler is invoked again on reload, returns the new comment
 * pointing at the new artifact, and the new iteration tab is rendered.
 * Note that Playwright's `page.route` interception bypasses the browser
 * HTTP cache, so this test cannot reproduce the cache-hit failure mode
 * directly. The direct cache-mode regression is covered by unit tests:
 *   - src/api/github/github-client.test.ts (verifies fetch is called
 *     with `cache: 'no-cache'`)
 *   - src/features/iterations/artifact-loader.test.ts (verifies the
 *     direct artifact ZIP fetch passes `cache: 'no-cache'`)
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

test.describe("Soft refresh bypasses HTTP cache (issue #494)", () => {
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

  test("new iteration appears after soft refresh without Ctrl+F5", async ({
    page,
  }) => {
    // The route handler invocation counter doubles as an instrumentation
    // probe — if the comments endpoint isn't hit a second time on reload,
    // the iteration selector can't see the new artifact reference. This
    // guards against future regressions like a Zustand persist layer
    // accidentally caching iteration data across reloads.

    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupFullPRMocks(page, "test", "repo", 494, {
      pr: mockPR,
      files: mockFiles,
    });

    // Two artifact DBs: 2 iterations initially, 3 after the simulated push.
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

    // Mutable server state — flipped between the initial load and the reload.
    const ARTIFACT_ID_V1 = 111111;
    const ARTIFACT_ID_V2 = 222222;
    let currentArtifactId = ARTIFACT_ID_V1;
    let currentIterationCount = 2;
    let currentTimestamp = "2026-05-19T10:00:00Z";

    // Mock the PR comments endpoint with realistic GitHub cache headers
    // (`public, max-age=60` — same as api.github.com). Counter verifies
    // the endpoint is re-hit on reload.
    let commentsFetchCount = 0;
    await page.route(
      "https://api.github.com/repos/test/repo/issues/494/comments",
      async (route) => {
        commentsFetchCount++;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "Cache-Control": "public, max-age=60" },
          body: JSON.stringify([
            {
              id: 999999,
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
          ]),
        });
      }
    );

    // Mock artifact ZIP downloads (one route per artifact id).
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

    // Initial load: 2 iterations expected.
    await page.goto("/test/repo/494");
    await page.waitForLoadState("load");

    const selector = page.getByTestId("iteration-selector");
    await expect(selector).toBeVisible();
    await expect(page.getByTestId("iteration-tab-1")).toBeVisible();
    await expect(page.getByTestId("iteration-tab-2")).toBeVisible();
    await expect(page.getByTestId("iteration-tab-3")).toHaveCount(0);

    // Simulate a new push: workflow uploads a new artifact and updates the
    // codjiflo comment (new artifactId + new timestamp).
    currentArtifactId = ARTIFACT_ID_V2;
    currentIterationCount = 3;
    currentTimestamp = "2026-05-19T10:05:00Z";

    // Soft refresh (equivalent to F5 / Ctrl+R — NOT Ctrl+F5).
    await page.reload();
    await page.waitForLoadState("load");

    // With the fix, the new comment is fetched (no HTTP cache hit), the new
    // artifact is downloaded, and the third iteration tab appears.
    await expect(page.getByTestId("iteration-tab-3")).toBeVisible();
    await expect(page.getByTestId("iteration-tab-1")).toBeVisible();
    await expect(page.getByTestId("iteration-tab-2")).toBeVisible();

    // Sanity: comments endpoint must have been hit on each load.
    expect(commentsFetchCount).toBeGreaterThanOrEqual(2);
  });
});
