/**
 * Tests for line-level diff computation
 */

import { describe, it, expect } from "vitest";
import { computeLineDiff } from "./line-diff.js";

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
