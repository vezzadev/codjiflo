/**
 * SpanTracker Domain Layer Exports
 *
 * Clean Architecture: This layer contains pure domain logic
 * with no dependencies on infrastructure (SQLite, GitHub API, etc.)
 */

// Value Objects
export type { TextSpan, LineSpan } from './text-span';
export {
  createSpan,
  spanEnd,
  spansOverlap,
  spanContains,
  spanFromRange,
  shiftSpan,
  emptySpan,
  isEmptySpan,
  createLineSpan,
  singleLine,
  lineCount,
  lineSpansOverlap,
} from './text-span';

// Span Mapping Types
export type {
  SpanMappingType,
  LineMapping,
  SpanMappingData,
  SerializedLineMapping,
} from './span-mapping';
export {
  emptySpanMappingData,
  createSpanMappingData,
  serializeMappings,
  deserializeMappings,
} from './span-mapping';

// SpanTracker Interface and Implementations
export type { ISpanTracker } from './span-tracker';
export {
  PrecomputedSpanTracker,
  IdentitySpanTracker,
  ChainedSpanTracker,
  createSpanTracker,
  chainTrackers,
} from './span-tracker';
