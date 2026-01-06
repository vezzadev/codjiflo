/**
 * @codjiflo/diff-engine
 *
 * Line-level diff computation for CodjiFlo.
 * Shared between GitHub Action and E2E test fixtures.
 */

export {
  computeLineDiff,
  lineDiffsToSpanMappings,
  lineDiffToSpanMapping,
  type LineDiff,
  type SpanMapping,
} from "./line-diff.js";
