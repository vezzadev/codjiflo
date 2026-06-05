/**
 * Iteration Management Feature (Milestone 4)
 *
 * Public API for iteration tracking functionality.
 * See docs/M4-IMPLEMENTATION-PLAN.md for architecture details.
 */

// Components
export { IterationSelector, StatelessModeIndicator } from './components';

// Store
export { useIterationStore } from './stores';

// Types
export type {
  Iteration,
  IterationLifecycle,
  IterationRange,
  IterationPreset,
  IterationMode,
  ReviewFileArtifact,
  FileContent,
  ArtifactReference,
  IterationComparison,
  FileComparison,
  IterationState,
  DiscardedCommit,
  DiscardedCommitAvailability,
  CollapsedIterationGroup,
  CollapsedGroupVisibility,
  TimelineLoaderResult,
} from './types';

export {
  IterationStatus,
  FileChangeType,
  iterationToRightSnapshot,
} from './types';
