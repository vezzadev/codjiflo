/**
 * Diff Pipeline Hooks
 *
 * A series of composed hooks where each stage handles one concern,
 * branches for variants, and outputs a consistent shape.
 *
 * Pipeline flow:
 * Source → Filter → Shape → Display → Navigation → Comments → render
 */

export { useDiffSource } from './useDiffSource';
export { useDiffFilter } from './useDiffFilter';
export { useDiffShape } from './useDiffShape';
export { useDiffDisplay } from './useDiffDisplay';
export { useDiffNavigation } from './useDiffNavigation';
export { useDiffComments } from './useDiffComments';

export type {
  DiffSourceOutput,
  DiffFilterOutput,
  DiffShapeOutput,
  DiffDisplayOutput,
  DiffNavigationOutput,
  DiffCommentsOutput,
  DiffPipelineOutput,
} from './types';
