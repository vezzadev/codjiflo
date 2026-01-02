/**
 * Diff Engine
 *
 * Computes line-level diffs using diff-match-patch.
 */
export interface LineDiff {
    type: 'unchanged' | 'modified' | 'deleted' | 'added';
    leftLines: number;
    rightLines: number;
}
/**
 * Compute line-level diff between two strings.
 * Returns a sequence of LineDiff operations.
 */
export declare function computeLineDiff(left: string, right: string): LineDiff[];
//# sourceMappingURL=diff-engine.d.ts.map