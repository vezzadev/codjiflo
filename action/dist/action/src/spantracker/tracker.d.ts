/**
 * SpanTracker Computation
 *
 * Computes line mappings between file versions using diff.
 */
import type { IterationDatabase } from '../db/database';
interface SpanTrackerInput {
    artifactId: number;
    leftSnapshotIndex: number;
    rightSnapshotIndex: number;
    leftContent: string | null;
    rightContent: string | null;
}
/**
 * Compute and store SpanTrackers for an iteration.
 * Computes:
 * 1. Adjacent tracker (left → right within iteration)
 * 2. Base → right tracker (for full diff comparison)
 */
export declare function computeSpanTrackers(db: IterationDatabase, inputs: SpanTrackerInput[]): void;
/**
 * Prepare SpanTracker inputs for a new iteration.
 */
export declare function prepareSpanTrackerInputs(db: IterationDatabase, artifactIds: number[], leftSnapshotIndex: number, rightSnapshotIndex: number): SpanTrackerInput[];
export {};
//# sourceMappingURL=tracker.d.ts.map