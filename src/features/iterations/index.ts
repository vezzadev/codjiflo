/**
 * Iteration Management Feature (Milestone 4)
 *
 * Public API for iteration tracking functionality.
 * See docs/M4-IMPLEMENTATION-PLAN.md for architecture details.
 */

// Components
export { IterationSelector } from './components';

// Store
export { useIterationStore } from './stores';

// Types
export type {
  Iteration,
  IterationRange,
  IterationPreset,
  IterationMode,
  ReviewFileArtifact,
  FileContent,
  ArtifactReference,
  IterationComparison,
  FileComparison,
  IterationState,
  StatelessIteration,
  StatelessIterationStatus,
  CollapsedIterationGroup,
  CollapsedGroupVisibility,
  DiscardedCommit,
  DiscardedCommitStatus,
  DiscoveryResult,
  CommitIterationResult,
} from './types';

export {
  IterationStatus,
  FileChangeType,
  iterationToRightSnapshot,
} from './types';
