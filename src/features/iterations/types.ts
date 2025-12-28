/**
 * Iteration data models
 * S-3.4: Iteration Snapshotting
 * AC-3.4.27, AC-3.4.28, AC-3.4.29
 * 
 * See spec/functional/iterations.md for full specification
 */

export enum IterationStatus {
  Submitted = 'submitted',
  Deleted = 'deleted',
}

/**
 * Iteration represents a pull request revision
 * AC-3.4.27
 */
export interface Iteration {
  id: number;
  revision: number; // Sequential 1, 2, 3...
  author: string;
  description: string;
  comment: string;
  submittedOn: Date;
  status: IterationStatus;
  
  // Git-specific metadata
  sourceCommitId?: string; // head_sha
  targetCommitId?: string; // base_sha
  beforeCommitId?: string; // before SHA (for force-push tracking)
}

/**
 * File artifact tracks a file across iterations and renames
 * AC-3.4.28
 */
export interface ReviewFileArtifact {
  id: number;
  changeTrackingId: string; // Platform-specific stable ID
  
  // Path at each snapshot (null if file doesn't exist)
  repoPaths: (string | null)[];
  
  // Existence range
  firstSnapshotIndex: number;
  lastSnapshotIndex: number;
}

/**
 * Snapshot index conversion utilities
 * AC-3.4.29
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SnapshotIndexConverter {
  /**
   * Convert snapshot index to iteration number
   * floor(snapshotIndex / 2) + 1
   */
  static snapshotToIteration(snapshotIndex: number): number {
    return Math.floor(snapshotIndex / 2) + 1;
  }

  /**
   * Convert iteration to left snapshot index
   * (iteration - 1) * 2
   */
  static iterationToLeftSnapshot(iteration: number): number {
    return (iteration - 1) * 2;
  }

  /**
   * Convert iteration to right snapshot index
   * (iteration - 1) * 2 + 1
   */
  static iterationToRightSnapshot(iteration: number): number {
    return (iteration - 1) * 2 + 1;
  }

  /**
   * Check if snapshot is a left snapshot (even index)
   */
  static isLeftSnapshot(snapshotIndex: number): boolean {
    return snapshotIndex % 2 === 0;
  }

  /**
   * Check if snapshot is a right snapshot (odd index)
   */
  static isRightSnapshot(snapshotIndex: number): boolean {
    return snapshotIndex % 2 === 1;
  }
}

/**
 * Iteration comparison represents diff between two iterations
 */
export interface IterationComparison {
  leftSnapshot: number;
  rightSnapshot: number;
  leftIteration: number;
  rightIteration: number;
  isCrossIteration: boolean; // True if not comparing adjacent snapshots
}

/**
 * File content cache entry for iterations
 */
export interface IterationFileContent {
  artifactId: number;
  snapshotIndex: number;
  content: string;
  contentHash: string;
}
