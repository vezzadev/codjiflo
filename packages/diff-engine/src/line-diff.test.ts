/**
 * Tests for line-level diff computation
 */

import { describe, it, expect } from "vitest";
import {
  computeLineDiff,
  lineDiffsToSpanMappings,
  lineDiffToSpanMapping,
} from "./line-diff.js";

describe("computeLineDiff", () => {
  it("returns empty array for identical strings", () => {
    const result = computeLineDiff("hello\nworld\n", "hello\nworld\n");
    expect(result).toEqual([
      { type: "unchanged", leftLines: 2, rightLines: 2 },
    ]);
  });

  it("returns empty array for both empty strings", () => {
    const result = computeLineDiff("", "");
    expect(result).toEqual([]);
  });

  it("detects added lines", () => {
    const result = computeLineDiff("", "hello\nworld\n");
    expect(result).toEqual([{ type: "added", leftLines: 0, rightLines: 2 }]);
  });

  it("detects deleted lines", () => {
    const result = computeLineDiff("hello\nworld\n", "");
    expect(result).toEqual([{ type: "deleted", leftLines: 2, rightLines: 0 }]);
  });

  it("detects modified lines (delete followed by insert)", () => {
    const result = computeLineDiff("hello\n", "goodbye\n");
    expect(result).toEqual([
      { type: "modified", leftLines: 1, rightLines: 1 },
    ]);
  });

  it("handles mixed changes", () => {
    const left = "line1\nline2\nline3\n";
    const right = "line1\nmodified\nline3\nnewline\n";
    const result = computeLineDiff(left, right);

    // diff_cleanupSemantic groups adjacent changes together
    // line1 unchanged, rest is one modification
    expect(result).toEqual([
      { type: "unchanged", leftLines: 1, rightLines: 1 },
      { type: "modified", leftLines: 2, rightLines: 3 },
    ]);
  });

  it("handles lines without trailing newlines", () => {
    const result = computeLineDiff("hello", "hello");
    expect(result).toEqual([
      { type: "unchanged", leftLines: 1, rightLines: 1 },
    ]);
  });

  it("handles adding content to empty file", () => {
    const result = computeLineDiff("", "new content\n");
    expect(result).toEqual([{ type: "added", leftLines: 0, rightLines: 1 }]);
  });

  it("handles deleting all content", () => {
    const result = computeLineDiff("old content\n", "");
    expect(result).toEqual([{ type: "deleted", leftLines: 1, rightLines: 0 }]);
  });

  it("handles multi-line modifications", () => {
    const left = "a\nb\nc\n";
    const right = "x\ny\nz\n";
    const result = computeLineDiff(left, right);

    // All lines modified
    expect(result).toEqual([
      { type: "modified", leftLines: 3, rightLines: 3 },
    ]);
  });

  it("handles insertion in the middle", () => {
    const left = "first\nlast\n";
    const right = "first\nmiddle\nlast\n";
    const result = computeLineDiff(left, right);

    expect(result).toEqual([
      { type: "unchanged", leftLines: 1, rightLines: 1 },
      { type: "added", leftLines: 0, rightLines: 1 },
      { type: "unchanged", leftLines: 1, rightLines: 1 },
    ]);
  });

  it("handles deletion in the middle", () => {
    const left = "first\nmiddle\nlast\n";
    const right = "first\nlast\n";
    const result = computeLineDiff(left, right);

    expect(result).toEqual([
      { type: "unchanged", leftLines: 1, rightLines: 1 },
      { type: "deleted", leftLines: 1, rightLines: 0 },
      { type: "unchanged", leftLines: 1, rightLines: 1 },
    ]);
  });
});

describe("lineDiffToSpanMapping", () => {
  it("converts unchanged diff to span mapping", () => {
    const result = lineDiffToSpanMapping(
      { type: "unchanged", leftLines: 3, rightLines: 3 },
      1,
      1
    );
    expect(result).toEqual({
      left_line_start: 1,
      left_line_end: 3,
      right_line_start: 1,
      right_line_end: 3,
      mapping_type: "unchanged",
    });
  });

  it("converts modified diff to span mapping", () => {
    const result = lineDiffToSpanMapping(
      { type: "modified", leftLines: 2, rightLines: 3 },
      5,
      5
    );
    expect(result).toEqual({
      left_line_start: 5,
      left_line_end: 6,
      right_line_start: 5,
      right_line_end: 7,
      mapping_type: "modified",
    });
  });

  it("converts deleted diff to span mapping with null right", () => {
    const result = lineDiffToSpanMapping(
      { type: "deleted", leftLines: 2, rightLines: 0 },
      10,
      10
    );
    expect(result).toEqual({
      left_line_start: 10,
      left_line_end: 11,
      right_line_start: null,
      right_line_end: null,
      mapping_type: "deleted",
    });
  });

  it("converts added diff to span mapping with null left", () => {
    const result = lineDiffToSpanMapping(
      { type: "added", leftLines: 0, rightLines: 4 },
      1,
      1
    );
    expect(result).toEqual({
      left_line_start: null,
      left_line_end: null,
      right_line_start: 1,
      right_line_end: 4,
      mapping_type: "added",
    });
  });
});

describe("lineDiffsToSpanMappings", () => {
  it("returns empty array for empty diffs", () => {
    const result = lineDiffsToSpanMappings([]);
    expect(result).toEqual([]);
  });

  it("converts single unchanged diff", () => {
    const result = lineDiffsToSpanMappings([
      { type: "unchanged", leftLines: 2, rightLines: 2 },
    ]);
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

  it("tracks line numbers correctly across multiple diffs", () => {
    const result = lineDiffsToSpanMappings([
      { type: "unchanged", leftLines: 1, rightLines: 1 },
      { type: "added", leftLines: 0, rightLines: 2 },
      { type: "unchanged", leftLines: 1, rightLines: 1 },
    ]);

    expect(result).toEqual([
      {
        left_line_start: 1,
        left_line_end: 1,
        right_line_start: 1,
        right_line_end: 1,
        mapping_type: "unchanged",
      },
      {
        left_line_start: null,
        left_line_end: null,
        right_line_start: 2,
        right_line_end: 3,
        mapping_type: "added",
      },
      {
        left_line_start: 2,
        left_line_end: 2,
        right_line_start: 4,
        right_line_end: 4,
        mapping_type: "unchanged",
      },
    ]);
  });

  it("works with computeLineDiff for identical content", () => {
    const diffs = computeLineDiff("line1\nline2\n", "line1\nline2\n");
    const result = lineDiffsToSpanMappings(diffs);

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

  it("works with computeLineDiff for added content", () => {
    const diffs = computeLineDiff("", "new line 1\nnew line 2\n");
    const result = lineDiffsToSpanMappings(diffs);

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

  it("works with computeLineDiff for deleted content", () => {
    const diffs = computeLineDiff("old line 1\nold line 2\n", "");
    const result = lineDiffsToSpanMappings(diffs);

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

  it("works with computeLineDiff for modified content", () => {
    const diffs = computeLineDiff("old line\n", "new line\n");
    const result = lineDiffsToSpanMappings(diffs);

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
});
