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
// Stateless Iteration Types (Milestone 4.2)
// ============================================================================

/** Git lineage state - whether commit is in current HEAD history or orphaned */
export type IterationLineage = 'current' | 'discarded';

/** UI visibility state for collapsed groups */
export type CollapsedVisibility = 'collapsed' | 'expanded';

/** An iteration derived from commit data (stateless mode) */
export interface StatelessIteration {
  /** Sequential revision number across all commits (live + discarded) */
  revision: number;
  /** Git commit SHA */
  commitSha: string;
  /** Parent commit SHA or PR base */
  baseSha: string;
  /** Commit author username */
  author: string;
  /** First line of commit message */
  message: string;
  /** Commit timestamp */
  createdAt: Date;
  /** Git lineage: current HEAD history or orphaned by force-push */
  lineage: IterationLineage;
  /** Group ID if this iteration was discarded by a force-push */
  collapsedGroupId?: string;
}

/** A group of iterations discarded by a single force-push */
export interface CollapsedIterationGroup {
  /** Unique ID for this group */
  id: string;
  /** SHA of HEAD before force-push (discarded) */
  beforeSha: string;
  /** SHA of HEAD after force-push (new) */
  afterSha: string;
  /** Iterations that were discarded */
  iterations: StatelessIteration[];
  /** UI visibility state */
  visibility: CollapsedVisibility;
  /** Set if commits are no longer available (GC'd) */
  unavailableReason?: string;
}

/** A force-push event from GitHub Timeline API */
export interface ForcePushEvent {
  /** SHA before force-push */
  beforeSha: string;
  /** SHA after force-push */
  afterSha: string;
  /** When the force-push occurred */
  timestamp: Date;
  /** User who performed the force-push */
  actor: string;
}

/** Result of loading stateless iterations */
export interface StatelessIterationData {
  iterations: StatelessIteration[];
  collapsedGroups: CollapsedIterationGroup[];
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



/** Get left (before/base) snapshot index for an iteration */
export function iterationToLeftSnapshot(revision: number): number {
  return (revision - 1) * 2;
}

/** Get right (after) snapshot index for an iteration */
export function iterationToRightSnapshot(revision: number): number {
  return (revision - 1) * 2 + 1;
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
  artifactId: number;
  timestamp: string; // ISO 8601
  iterationCount: number;
}

// ============================================================================
// Store State Types
// ============================================================================

/** Iteration storage mode: stateful (artifact available) or stateless (GitHub API only) */
export type IterationMode = 'stateful' | 'stateless';

export interface IterationState {
  /** All iterations loaded from artifact */
  iterations: Iteration[];

  /** Current PR key for lookup in selectedRanges */
  currentPrKey: string | null;

  /** Selected ranges partitioned by PR key */
  selectedRanges: Record<string, IterationRange>;

  /** All file artifacts */
  artifacts: ReviewFileArtifact[];

  /** Timestamp of current artifact (for cache validation) */
  artifactTimestamp: string | null;

  /** Loading state */
  isLoading: boolean;

  /** Error message if load failed */
  error: string | null;

  /** Iteration storage mode: 'stateful' when artifact is available, 'stateless' for GitHub API only */
  mode: IterationMode;

  /** Reason for stateless mode (for debugging, null when stateful) */
  statelessReason: string | null;

  // Actions
  loadIterations: (owner: string, repo: string, prNumber: number) => Promise<void>;
  selectRange: (fromSnapshot: number, toSnapshot: number) => void;
  selectPreset: (preset: IterationPreset) => void;
  reset: () => void;
}

export type IterationPreset = 'full' | 'latest' | 'lastReview';
