/**
 * Milestone 4: Iteration Management Types
 *
 * Core types for iteration tracking, file artifacts, and snapshot management.
 * See spec/functional/iterations.md for full documentation.
 */

// ============================================================================
// Iteration Types
// ============================================================================

export interface Iteration {
  id: number;
  revision: number; // Sequential 1-based number
  headSha: string;
  baseSha: string;
  beforeSha: string | null; // For force-push tracking
  author: string;
  createdAt: Date;
}

export enum IterationStatus {
  Submitted = 'submitted',
  Deleted = 'deleted',
}

// ============================================================================
// File Artifact Types
// ============================================================================

/**
 * Tracks a file's lineage across iterations (handles renames)
 */
export interface ReviewFileArtifact {
  id: number;
  changeTrackingId: string; // Platform-specific stable ID

  /** Path at each snapshot (null if file doesn't exist) */
  repoPaths: (string | null)[];

  /** Snapshot range where file exists */
  firstSnapshotIndex: number;
  lastSnapshotIndex: number;
}

export interface FileContent {
  artifactId: number;
  snapshotIndex: number;
  content: string | null; // null if binary/too large
  contentHash: string;
  sizeBytes: number;
}

// ============================================================================
// Snapshot Index Helpers
// ============================================================================

/**
 * Each iteration creates TWO snapshots:
 * - Left snapshot (even index) = state BEFORE this iteration
 * - Right snapshot (odd index) = state AFTER this iteration
 *
 * Iteration 1: Snapshot 0 (left) <-> Snapshot 1 (right)
 * Iteration 2: Snapshot 2 (left) <-> Snapshot 3 (right)
 * Iteration 3: Snapshot 4 (left) <-> Snapshot 5 (right)
 */

/** Convert snapshot index to iteration revision (1-based) */
export function snapshotToIteration(snapshotIndex: number): number {
  return Math.floor(snapshotIndex / 2) + 1;
}

/** Get left (before) snapshot index for an iteration */
export function iterationToLeftSnapshot(revision: number): number {
  return (revision - 1) * 2;
}

/** Get right (after) snapshot index for an iteration */
export function iterationToRightSnapshot(revision: number): number {
  return (revision - 1) * 2 + 1;
}

/** Check if snapshot is a left (before) snapshot */
export function isLeftSnapshot(snapshotIndex: number): boolean {
  return snapshotIndex % 2 === 0;
}

/** Check if snapshot is a right (after) snapshot */
export function isRightSnapshot(snapshotIndex: number): boolean {
  return snapshotIndex % 2 === 1;
}

// ============================================================================
// Iteration Comparison Types
// ============================================================================

export interface IterationRange {
  /** Snapshot index for the "from" side (usually a right snapshot) */
  fromSnapshot: number;
  /** Snapshot index for the "to" side (usually a right snapshot) */
  toSnapshot: number;
}

export interface IterationComparison {
  leftSnapshot: number;
  rightSnapshot: number;
  files: FileComparison[];
  isCrossIteration: boolean; // True if comparing non-adjacent iterations
}

export interface FileComparison {
  artifact: ReviewFileArtifact;
  leftPath: string | null;
  rightPath: string | null;
  changeType: FileChangeType;
}

export enum FileChangeType {
  Added = 'added',
  Deleted = 'deleted',
  Modified = 'modified',
  Renamed = 'renamed',
  Unchanged = 'unchanged',
}

// ============================================================================
// Artifact Reference (from PR comment)
// ============================================================================

export interface ArtifactReference {
  runId: number;
  artifactName: string;
  timestamp: string; // ISO 8601
  iterationCount: number;
}

// ============================================================================
// Store State Types
// ============================================================================

export interface IterationState {
  /** All iterations loaded from artifact */
  iterations: Iteration[];

  /** Currently selected range for comparison */
  selectedRange: IterationRange | null;

  /** All file artifacts */
  artifacts: ReviewFileArtifact[];

  /** Timestamp of current artifact (for cache validation) */
  artifactTimestamp: string | null;

  /** Loading state */
  isLoading: boolean;

  /** Error message if load failed */
  error: string | null;

  /** True if using GitHub commits fallback (no artifact) */
  isDegraded: boolean;

  // Actions
  loadIterations: (owner: string, repo: string, prNumber: number) => Promise<void>;
  selectRange: (fromSnapshot: number, toSnapshot: number) => void;
  selectPreset: (preset: IterationPreset) => void;
  reset: () => void;
}

export type IterationPreset = 'full' | 'latest' | 'lastReview';
