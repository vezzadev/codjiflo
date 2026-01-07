/**
 * Line-level Diff Computation
 *
 * Computes line-level diffs using diff-match-patch.
 * Shared between GitHub Action and E2E test fixtures.
 */
export interface LineDiff {
    type: "unchanged" | "modified" | "deleted" | "added";
    leftLines: number;
    rightLines: number;
}
export interface SpanMapping {
    left_line_start: number | null;
    left_line_end: number | null;
    right_line_start: number | null;
    right_line_end: number | null;
    mapping_type: "unchanged" | "modified" | "deleted" | "added";
}
/**
 * Compute line-level diff between two strings.
 * Returns a sequence of LineDiff operations.
 */
export declare function computeLineDiff(left: string, right: string): LineDiff[];
/**
 * Convert a LineDiff array to SpanMapping array with correct line numbers.
 * Line numbers are 1-based.
 */
export declare function lineDiffsToSpanMappings(diffs: LineDiff[]): SpanMapping[];
/**
 * Convert a single LineDiff to a SpanMapping.
 */
export declare function lineDiffToSpanMapping(diff: LineDiff, leftStart: number, rightStart: number): SpanMapping;
//# sourceMappingURL=line-diff.d.ts.map