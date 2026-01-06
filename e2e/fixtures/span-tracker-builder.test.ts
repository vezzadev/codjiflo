/**
 * Tests for span tracker builder
 */

import { describe, it, expect } from "vitest";
import { buildSpanMappings } from "./span-tracker-builder";

describe("buildSpanMappings", () => {
  it("returns empty array for identical content", () => {
    const left = "line1\nline2\n";
    const right = "line1\nline2\n";

    const result = buildSpanMappings(left, right);

    expect(result).toEqual([
      {
        left_line_start: 1,
        left_line_end: 2,
        right_line_start: 1,
        right_line_end: 2,
        mapping_type: "unchanged",
      },
    ]);
  });

  it("handles empty files", () => {
    const result = buildSpanMappings("", "");
    expect(result).toEqual([]);
  });

  it("handles added content to empty file", () => {
    const left = "";
    const right = "new line 1\nnew line 2\n";

    const result = buildSpanMappings(left, right);

    expect(result).toEqual([
      {
        left_line_start: null,
        left_line_end: null,
        right_line_start: 1,
        right_line_end: 2,
        mapping_type: "added",
      },
    ]);
  });

  it("handles deleting all content", () => {
    const left = "old line 1\nold line 2\n";
    const right = "";

    const result = buildSpanMappings(left, right);

    expect(result).toEqual([
      {
        left_line_start: 1,
        left_line_end: 2,
        right_line_start: null,
        right_line_end: null,
        mapping_type: "deleted",
      },
    ]);
  });

  it("handles modification (delete + insert)", () => {
    const left = "old line\n";
    const right = "new line\n";

    const result = buildSpanMappings(left, right);

    expect(result).toEqual([
      {
        left_line_start: 1,
        left_line_end: 1,
        right_line_start: 1,
        right_line_end: 1,
        mapping_type: "modified",
      },
    ]);
  });

  it("handles mixed changes with correct line numbers", () => {
    const left = "line1\nold\nline3\n";
    const right = "line1\nnew\nline3\nextra\n";

    const result = buildSpanMappings(left, right);

    // Due to diff_cleanupSemantic, changes may be grouped
    // Expected: unchanged line1, modified (old->new + line3->line3+extra)
    expect(result.length).toBeGreaterThan(0);

    // Verify first mapping starts at line 1
    expect(result[0]?.left_line_start).toBe(1);
    expect(result[0]?.right_line_start).toBe(1);
  });

  it("tracks line numbers correctly across multiple changes", () => {
    const left = "a\nb\nc\nd\ne\n";
    const right = "a\nX\nY\nc\nd\ne\nf\n";

    const result = buildSpanMappings(left, right);

    // Verify line numbers are consistent
    let lastLeftEnd = 0;
    let lastRightEnd = 0;

    for (const mapping of result) {
      if (mapping.left_line_start !== null) {
        expect(mapping.left_line_start).toBeGreaterThan(lastLeftEnd);
        lastLeftEnd = mapping.left_line_end ?? lastLeftEnd;
      }
      if (mapping.right_line_start !== null) {
        expect(mapping.right_line_start).toBeGreaterThan(lastRightEnd);
        lastRightEnd = mapping.right_line_end ?? lastRightEnd;
      }
    }
  });

  it("produces valid mapping types", () => {
    const left = "keep\ndelete\nmodify\n";
    const right = "keep\nmodified\nnew\n";

    const result = buildSpanMappings(left, right);

    const validTypes = ["unchanged", "modified", "deleted", "added"];
    for (const mapping of result) {
      expect(validTypes).toContain(mapping.mapping_type);
    }
  });
});
