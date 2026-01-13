/**
 * Composite Diff Pipeline Hook
 *
 * Chains all pipeline stages together into a single entry point.
 * Each stage handles one concern, branches for variants, and outputs
 * a consistent shape for the next stage.
 *
 * Pipeline flow:
 * Source → Filter → Shape → Display → SideFilter → Navigation → Comments
 */

import {
  useDiffSource,
  useDiffFilter,
  useDiffShape,
  useDiffDisplay,
  useDiffSideFilter,
  useDiffNavigation,
  useDiffComments,
  type DiffPipelineOutput,
} from './pipeline';

/**
 * Complete diff pipeline hook that composes all stages.
 *
 * Usage:
 * ```tsx
 * function DiffView() {
 *   const pipeline = useDiffPipeline();
 *
 *   if (pipeline._isLoadingFullFile) return <Loading />;
 *
 *   return pipeline.viewMode === 'inline'
 *     ? <InlineDiffTable diffLines={pipeline.diffLines} ... />
 *     : <SideBySideDiffView alignedLines={pipeline.alignedLines} ... />;
 * }
 * ```
 */
export function useDiffPipeline(): DiffPipelineOutput {
  // Stage 1: Get data from appropriate source (degraded vs iteration)
  const source = useDiffSource();

  // Stage 2: Apply content filter (full file vs changes only)
  const filtered = useDiffFilter(source);

  // Stage 3: Shape data for view mode (inline vs split)
  const shaped = useDiffShape(filtered);

  // Stage 4: Apply display preferences (whitespace, content filter)
  const display = useDiffDisplay(shaped);

  // Stage 5: Apply side filter (left/both/right) to diff content
  const sideFiltered = useDiffSideFilter(display);

  // Stage 6: Calculate navigation (hunk indices, scroll targets)
  const navigation = useDiffNavigation(sideFiltered);

  // Stage 7: Map comment threads to positions
  const comments = useDiffComments(navigation);

  return comments;
}
