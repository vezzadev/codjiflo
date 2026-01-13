import { test, expect } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";

/**
 * Side Filter E2E Tests
 *
 * Tests the content filter (left/both/right) combined with view modes (changes/full).
 * This ensures that filtering works correctly in both patch-based and full-file views.
 *
 * Bug context: Left/right filter modes didn't work when viewing full files in virtualized mode.
 * The bug only manifests with 500+ lines (virtualization threshold).
 */
test.describe("Side filter with view modes", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 123,
    title: "Test PR with additions and deletions",
    body: "Test PR body",
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

  // Generate a large file (600+ lines) to trigger virtualization (threshold is 500)
  // The file has context lines interspersed with changes to properly test filtering
  function generateLargeFile() {
    const baseLines: string[] = [];
    const headLines: string[] = [];
    const patchLines: string[] = ["@@ -1,300 +1,310 @@"];

    for (let i = 0; i < 60; i++) {
      // 8 context lines per block
      for (let j = 0; j < 8; j++) {
        const line = `// Context line ${String(i * 8 + j)}`;
        baseLines.push(line);
        headLines.push(line);
        patchLines.push(` ${line}`);
      }
      // Then a change: deletion followed by addition
      const oldLine = `const oldVar${String(i)} = ${String(i)};`;
      const newLine = `const newVar${String(i)} = ${String(i + 100)};`;
      baseLines.push(oldLine);
      headLines.push(newLine);
      patchLines.push(`-${oldLine}`);
      patchLines.push(`+${newLine}`);
    }

    return {
      patch: patchLines.join("\n"),
      baseContent: baseLines.join("\n"),
      headContent: headLines.join("\n"),
    };
  }

  const largeFile = generateLargeFile();

  // Small file for non-virtualized tests (changes view)
  const smallFile: MockFile = {
    filename: "src/small.ts",
    status: "modified",
    additions: 3,
    deletions: 2,
    changes: 5,
    patch:
      "@@ -1,5 +1,6 @@\n const x = 1;\n-const oldY = 2;\n+const newY = 3;\n+const z = 4;\n // comment\n-const oldA = 5;\n+const newA = 6;",
  };

  // Large file for virtualized tests (full file view with 500+ lines)
  const largeFileMock: MockFile = {
    filename: "src/large.ts",
    status: "modified",
    additions: 60,
    deletions: 60,
    changes: 120,
    patch: largeFile.patch,
    baseContent: largeFile.baseContent,
    headContent: largeFile.headContent,
  };

  const mockFiles: MockFile[] = [smallFile, largeFileMock];

  const config = {
    owner: "test",
    repo: "repo",
    prNumber: 123,
    pageUrl: "/test/repo/123",
  };

  test.beforeEach(async ({ page }) => {
    await setupAuthState(page);
    await setupFullPRMocks(page, config.owner, config.repo, config.prNumber, {
      pr: mockPR,
      files: mockFiles,
    });
  });

  // Helper to navigate to a specific file and wait for diff to render
  async function navigateToFile(page: import("@playwright/test").Page, filename: string) {
    await page.goto(config.pageUrl);
    await page.waitForLoadState("load");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await fileNav.getByText(filename).click();

    await expect(
      page.getByRole("heading", { name: filename })
    ).toBeVisible();

    const diffRegion = page.getByRole("region", { name: /Diff content/i });
    await expect(diffRegion).toBeVisible();
    return diffRegion;
  }

  // Helper to count visible addition and deletion lines
  async function countLineTypes(diffRegion: import("@playwright/test").Locator) {
    const additions = await diffRegion.locator('[data-line-type="addition"]').count();
    const deletions = await diffRegion.locator('[data-line-type="deletion"]').count();
    return { additions, deletions };
  }

  // Helper to set content filter via keyboard shortcut
  async function setFilter(page: import("@playwright/test").Page, filter: "left" | "both" | "right") {
    await page.locator("body").click();
    await page.keyboard.press(filter === "left" ? "l" : filter === "both" ? "o" : "r");
  }

  // Helper to toggle full file view
  async function setFullFileView(page: import("@playwright/test").Page, showFull: boolean) {
    await page.locator("body").click();
    // 'F' for full file, 'C' for changes only
    await page.keyboard.press(showFull ? "f" : "c");
  }

  // ============================================================================
  // Changes View Tests (patch-based, small file, non-virtualized)
  // ============================================================================

  test("left filter shows only deletions in changes view", async ({ page }) => {
    const diffRegion = await navigateToFile(page, "src/small.ts");

    // Set filter to left (deletions only)
    await setFilter(page, "left");

    // Verify filter is applied
    const counts = await countLineTypes(diffRegion);
    expect(counts.deletions).toBeGreaterThan(0);
    expect(counts.additions).toBe(0);
  });

  test("both filter shows additions and deletions in changes view", async ({ page }) => {
    const diffRegion = await navigateToFile(page, "src/small.ts");

    // Default is 'both', but set it explicitly
    await setFilter(page, "both");

    // Verify both types are visible
    const counts = await countLineTypes(diffRegion);
    expect(counts.deletions).toBeGreaterThan(0);
    expect(counts.additions).toBeGreaterThan(0);
  });

  test("right filter shows only additions in changes view", async ({ page }) => {
    const diffRegion = await navigateToFile(page, "src/small.ts");

    // Set filter to right (additions only)
    await setFilter(page, "right");

    // Verify filter is applied
    const counts = await countLineTypes(diffRegion);
    expect(counts.additions).toBeGreaterThan(0);
    expect(counts.deletions).toBe(0);
  });

  // ============================================================================
  // Full File View Tests (large file, virtualized, 500+ lines)
  // These tests verify the bug fix: filters must work in virtualized full file view
  // Bug: VirtualizedDiffTable was missing contentFilter prop
  // ============================================================================

  test("left filter shows only deletions in full file view", async ({ page }) => {
    // Use large file (600+ lines) to trigger virtualization
    const diffRegion = await navigateToFile(page, "src/large.ts");

    // Enable full file view
    await setFullFileView(page, true);

    // Wait for full file content to load (button label changes to "Full")
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(toolbar.getByText("Full")).toBeVisible();

    // Set filter to left (deletions only)
    await setFilter(page, "left");

    // Verify filter is applied in virtualized full file view
    const counts = await countLineTypes(diffRegion);
    expect(counts.deletions).toBeGreaterThan(0);
    expect(counts.additions).toBe(0);
  });

  test("both filter shows additions and deletions in full file view", async ({ page }) => {
    // Use large file (600+ lines) to trigger virtualization
    const diffRegion = await navigateToFile(page, "src/large.ts");

    // Enable full file view
    await setFullFileView(page, true);

    // Wait for full file content to load
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(toolbar.getByText("Full")).toBeVisible();

    // Set filter to both
    await setFilter(page, "both");

    // Verify both types are visible
    const counts = await countLineTypes(diffRegion);
    expect(counts.deletions).toBeGreaterThan(0);
    expect(counts.additions).toBeGreaterThan(0);
  });

  test("right filter shows only additions in full file view", async ({ page }) => {
    // Use large file (600+ lines) to trigger virtualization
    const diffRegion = await navigateToFile(page, "src/large.ts");

    // Enable full file view
    await setFullFileView(page, true);

    // Wait for full file content to load
    const toolbar = page.getByRole("toolbar", { name: "Diff view controls" });
    await expect(toolbar.getByText("Full")).toBeVisible();

    // Set filter to right (additions only)
    await setFilter(page, "right");

    // Verify filter is applied in virtualized full file view
    const counts = await countLineTypes(diffRegion);
    expect(counts.additions).toBeGreaterThan(0);
    expect(counts.deletions).toBe(0);
  });
});
