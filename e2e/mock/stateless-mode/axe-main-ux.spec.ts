import { test, expect, type Page } from "@playwright/test";
import {
  setupAuthState,
  setupFullPRMocks,
  type MockPR,
  type MockFile,
} from "../../fixtures/github-mocks";
import { setupLegacyDefaults } from "../../fixtures/legacy-defaults";

// Rules we deliberately exclude from the regression gate.
//
//   - color-contrast: palette decisions live in ui-shell, tracked separately.
//     The current dark palette has known low-contrast spots (file-list red/green
//     line counts, .branch-separator, .comment-time, CodeMirror's diff gutter).
//   - scrollable-region-focusable: only fires on CodeMirror's .cm-scroller. The
//     editor surface .cm-content already exposes role=textbox + aria-label, so
//     the scroller wrapper does not need its own focusable region.
const ALLOWED_RULES = new Set(["color-contrast", "scrollable-region-focusable"]);

interface AxeNode {
  target: string[];
  html?: string;
}
interface AxeViolation {
  id: string;
  impact?: string | null;
  help: string;
  nodes: AxeNode[];
}

async function runAxe(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: Document, opts: { resultTypes: string[] }) => Promise<{ violations: AxeViolation[] }> } }).axe;
    const r = await axe.run(document, { resultTypes: ["violations"] });
    return r.violations;
  });
  return violations;
}

function regress(violations: AxeViolation[]): AxeViolation[] {
  return violations.filter(
    (v) => !ALLOWED_RULES.has(v.id) && (v.impact === "serious" || v.impact === "critical"),
  );
}

test.describe("axe-core regression sweep on the main PR UX", () => {
  const mockPR: MockPR = {
    id: 1,
    number: 900,
    title: "Axe regression fixture",
    body: "## Summary\n\nMain UX accessibility scan baseline.",
    state: "open",
    merged: false,
    draft: false,
    user: {
      id: 1,
      login: "testuser",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feat/axe", sha: "aaa" },
    base: { ref: "main", sha: "bbb" },
    html_url: "https://github.com/test/repo/pull/900",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-02T15:00:00Z",
  };

  const mockFiles: MockFile[] = [
    {
      filename: "src/alpha.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: "@@ -1 +1,2 @@\n line\n+added",
    },
  ];

  test.beforeEach(async ({ page }) => {
    await setupLegacyDefaults(page);
    await setupAuthState(page);
    await setupFullPRMocks(page, "test", "repo", 900, { pr: mockPR, files: mockFiles });
  });

  test("PR description view has no new serious axe violations", async ({ page }) => {
    await page.goto("/test/repo/900");

    await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
    await expect(page.getByRole("region", { name: "Discussion" })).toBeVisible();

    const violations = await runAxe(page);
    const regressions = regress(violations);
    expect(
      regressions,
      `Unexpected axe regressions:\n${JSON.stringify(regressions, null, 2)}`,
    ).toEqual([]);
  });

  test("Diff editor view has no new serious axe violations", async ({ page }) => {
    await page.goto("/test/repo/900");

    const fileNav = page.getByRole("navigation", { name: /Changed files/i });
    await expect(fileNav).toBeVisible();
    await expect(fileNav.getByRole("status", { name: "Loading files" })).toHaveCount(0);

    await fileNav.getByRole("row", { name: /alpha\.ts/i }).click();

    const editor = page.getByRole("textbox", { name: /Diff for src\/alpha\.ts/ });
    await expect(editor).toBeVisible();

    const violations = await runAxe(page);
    const regressions = regress(violations);
    expect(
      regressions,
      `Unexpected axe regressions:\n${JSON.stringify(regressions, null, 2)}`,
    ).toEqual([]);
  });
});
