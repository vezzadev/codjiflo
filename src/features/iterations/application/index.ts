/**
 * SpanTracker Application Layer Exports
 *
 * Clean Architecture: This layer contains use cases and orchestration.
 * Depends on domain layer, provides ports for infrastructure.
 */

export type { ISpanTrackerReader } from './span-tracker-service';
export { SpanTrackerService } from './span-tracker-service';
