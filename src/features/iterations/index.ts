/**
 * Iteration Management Feature (Milestone 4)
 *
 * Public API for iteration tracking functionality.
 * See docs/M4-IMPLEMENTATION-PLAN.md for architecture details.
 */

// Components
export { IterationSelector, DegradedModeBanner } from './components';

// Store
export { useIterationStore } from './stores';

// Types
export type {
  Iteration,
  IterationRange,
  IterationPreset,
  ReviewFileArtifact,
  FileContent,
  ArtifactReference,
  IterationComparison,
  FileComparison,
  IterationState,
} from './types';

export {
  IterationStatus,
  FileChangeType,
  iterationToRightSnapshot,
} from './types';

// Domain (SpanTracker)
export type { TextSpan, LineSpan } from './domain';
export type { ISpanTracker, LineMapping, SpanMappingData, SpanMappingType } from './domain';


// Application
export { SpanTrackerService } from './application';
export type { ISpanTrackerReader } from './application';

// Infrastructure (for advanced use cases)
export { SQLiteSpanTrackerReader } from './infrastructure';


