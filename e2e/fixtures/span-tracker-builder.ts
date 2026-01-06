/**
 * Span Tracker Builder
 *
 * Converts line diffs to database span_mappings format.
 * Uses the shared diff-engine to compute line-level differences.
 */

import { computeLineDiff, type LineDiff } from "@codjiflo/diff-engine";

// ============================================================================
// Types
// ============================================================================

export interface SpanMapping {
  left_line_start: number | null;
  left_line_end: number | null;
  right_line_start: number | null;
  right_line_end: number | null;
  mapping_type: "unchanged" | "modified" | "deleted" | "added";
}

// ============================================================================
// Building Span Mappings
// ============================================================================

/**
 * Build span mappings from two content strings.
 * Returns an array of SpanMapping objects suitable for database insertion.
 *
 * Line numbers are 1-based (matching the span_mappings table schema).
 */
export function buildSpanMappings(
  leftContent: string,
  rightContent: string
): SpanMapping[] {
  const lineDiffs = computeLineDiff(leftContent, rightContent);
  return lineDiffsToSpanMappings(lineDiffs);
}

/**
 * Convert LineDiff array to SpanMapping array with correct line numbers.
 */
function lineDiffsToSpanMappings(diffs: LineDiff[]): SpanMapping[] {
  const mappings: SpanMapping[] = [];
  let leftLine = 1;
  let rightLine = 1;

  for (const diff of diffs) {
    const mapping = lineDiffToSpanMapping(diff, leftLine, rightLine);
    mappings.push(mapping);

    // Advance line counters
    leftLine += diff.leftLines;
    rightLine += diff.rightLines;
  }

  return mappings;
}

/**
 * Convert a single LineDiff to a SpanMapping.
 */
function lineDiffToSpanMapping(
  diff: LineDiff,
  leftStart: number,
  rightStart: number
): SpanMapping {
  switch (diff.type) {
    case "unchanged":
      return {
        left_line_start: leftStart,
        left_line_end: leftStart + diff.leftLines - 1,
        right_line_start: rightStart,
        right_line_end: rightStart + diff.rightLines - 1,
        mapping_type: "unchanged",
      };

    case "modified":
      return {
        left_line_start: leftStart,
        left_line_end: leftStart + diff.leftLines - 1,
        right_line_start: rightStart,
        right_line_end: rightStart + diff.rightLines - 1,
        mapping_type: "modified",
      };

    case "deleted":
      return {
        left_line_start: leftStart,
        left_line_end: leftStart + diff.leftLines - 1,
        right_line_start: null,
        right_line_end: null,
        mapping_type: "deleted",
      };

    case "added":
      return {
        left_line_start: null,
        left_line_end: null,
        right_line_start: rightStart,
        right_line_end: rightStart + diff.rightLines - 1,
        mapping_type: "added",
      };
  }
}
