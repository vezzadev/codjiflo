import { describe, it, expect } from "vitest";
import {
  singleLineRegion,
  multiLineRegion,
  subLineRegion,
  isMultiLineRegion,
  hasColumnSelection,
} from "./types";

describe("CommentRegion helpers", () => {
  describe("singleLineRegion", () => {
    it("creates a region with same start and end line", () => {
      const region = singleLineRegion(5);

      expect(region.startLine).toBe(5);
      expect(region.endLine).toBe(5);
      expect(region.startColumn).toBeUndefined();
      expect(region.endColumn).toBeUndefined();
    });
  });

  describe("multiLineRegion", () => {
    it("creates a region spanning multiple lines", () => {
      const region = multiLineRegion(5, 10);

      expect(region.startLine).toBe(5);
      expect(region.endLine).toBe(10);
      expect(region.startColumn).toBeUndefined();
      expect(region.endColumn).toBeUndefined();
    });

    it("handles single line range", () => {
      const region = multiLineRegion(5, 5);

      expect(region.startLine).toBe(5);
      expect(region.endLine).toBe(5);
    });
  });

  describe("subLineRegion", () => {
    it("creates a region with column-level selection", () => {
      const region = subLineRegion(5, 10, 20);

      expect(region.startLine).toBe(5);
      expect(region.endLine).toBe(5);
      expect(region.startColumn).toBe(10);
      expect(region.endColumn).toBe(20);
    });

    it("handles zero-based columns", () => {
      const region = subLineRegion(1, 0, 5);

      expect(region.startColumn).toBe(0);
      expect(region.endColumn).toBe(5);
    });
  });

  describe("isMultiLineRegion", () => {
    it("returns true when region spans multiple lines", () => {
      const region = multiLineRegion(5, 10);

      expect(isMultiLineRegion(region)).toBe(true);
    });

    it("returns false when region is single line", () => {
      const region = singleLineRegion(5);

      expect(isMultiLineRegion(region)).toBe(false);
    });

    it("returns false for sub-line region on same line", () => {
      const region = subLineRegion(5, 0, 10);

      expect(isMultiLineRegion(region)).toBe(false);
    });
  });

  describe("hasColumnSelection", () => {
    it("returns true when startColumn is defined", () => {
      const region = { startLine: 5, endLine: 5, startColumn: 0 };

      expect(hasColumnSelection(region)).toBe(true);
    });

    it("returns true when endColumn is defined", () => {
      const region = { startLine: 5, endLine: 5, endColumn: 10 };

      expect(hasColumnSelection(region)).toBe(true);
    });

    it("returns true for full sub-line region", () => {
      const region = subLineRegion(5, 0, 10);

      expect(hasColumnSelection(region)).toBe(true);
    });

    it("returns false for single line region", () => {
      const region = singleLineRegion(5);

      expect(hasColumnSelection(region)).toBe(false);
    });

    it("returns false for multi-line region without columns", () => {
      const region = multiLineRegion(5, 10);

      expect(hasColumnSelection(region)).toBe(false);
    });
  });
});
