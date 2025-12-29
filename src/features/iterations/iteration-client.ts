/**
 * Iteration Client
 *
 * High-level query interface for iteration SQLite database.
 * Provides typed methods for querying iterations, file artifacts, and content.
 */

import type { SQLiteDatabase } from '@/lib/sqlite-wasm';
import type { Iteration, ReviewFileArtifact, FileContent } from './types';

// ============================================================================
// SQLite Row Types
// ============================================================================

interface IterationRow {
  id: number;
  revision: number;
  head_sha: string;
  base_sha: string;
  before_sha: string | null;
  author: string;
  created_at: string;
}

interface FileArtifactRow {
  id: number;
  change_tracking_id: string;
}

interface ArtifactSnapshotRow {
  artifact_id: number;
  snapshot_index: number;
  file_path: string | null;
}

interface FileContentRow {
  artifact_id: number;
  snapshot_index: number;
  content: string | null;
  content_hash: string;
  size_bytes: number;
}

// ============================================================================
// Iteration Client Class
// ============================================================================

export class IterationClient {
  private db: SQLiteDatabase;

  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  // ============================================================================
  // Iteration Queries
  // ============================================================================

  /**
   * Get all iterations ordered by revision.
   */
  getIterations(): Iteration[] {
    const rows = this.db.query<IterationRow>(
      'SELECT * FROM iterations ORDER BY revision ASC'
    );

    return rows.map((row) => ({
      id: row.id,
      revision: row.revision,
      headSha: row.head_sha,
      baseSha: row.base_sha,
      beforeSha: row.before_sha,
      author: row.author,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Get a specific iteration by revision number.
   */
  getIteration(revision: number): Iteration | undefined {
    const row = this.db.queryOne<IterationRow>(
      'SELECT * FROM iterations WHERE revision = ?',
      [revision]
    );

    if (!row) return undefined;

    return {
      id: row.id,
      revision: row.revision,
      headSha: row.head_sha,
      baseSha: row.base_sha,
      beforeSha: row.before_sha,
      author: row.author,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Get the latest iteration.
   */
  getLatestIteration(): Iteration | undefined {
    const row = this.db.queryOne<IterationRow>(
      'SELECT * FROM iterations ORDER BY revision DESC LIMIT 1'
    );

    if (!row) return undefined;

    return {
      id: row.id,
      revision: row.revision,
      headSha: row.head_sha,
      baseSha: row.base_sha,
      beforeSha: row.before_sha,
      author: row.author,
      createdAt: new Date(row.created_at),
    };
  }

  // ============================================================================
  // File Artifact Queries
  // ============================================================================

  /**
   * Get all file artifacts with their snapshot paths.
   */
  getAllArtifacts(): ReviewFileArtifact[] {
    const artifactRows = this.db.query<FileArtifactRow>(
      'SELECT * FROM file_artifacts'
    );

    const snapshotRows = this.db.query<ArtifactSnapshotRow>(
      'SELECT * FROM artifact_snapshots ORDER BY artifact_id, snapshot_index'
    );

    // Build repo paths map per artifact
    const pathsByArtifact = new Map<number, Map<number, string | null>>();
    for (const row of snapshotRows) {
      let artifactPaths = pathsByArtifact.get(row.artifact_id);
      if (!artifactPaths) {
        artifactPaths = new Map();
        pathsByArtifact.set(row.artifact_id, artifactPaths);
      }
      artifactPaths.set(row.snapshot_index, row.file_path);
    }

    return artifactRows.map((artifact) => {
      const paths = pathsByArtifact.get(artifact.id) ?? new Map<number, string | null>();
      const snapshotIndices = Array.from(paths.keys()).sort((a, b) => a - b);

      // Build repoPaths array
      const lastIndex = snapshotIndices[snapshotIndices.length - 1];
      const maxIndex = lastIndex ?? 0;
      const repoPaths: (string | null)[] = [];
      for (let i = 0; i <= maxIndex; i++) {
        const path = paths.get(i);
        repoPaths.push(path ?? null);
      }

      return {
        id: artifact.id,
        changeTrackingId: artifact.change_tracking_id,
        repoPaths,
        firstSnapshotIndex: snapshotIndices[0] ?? 0,
        lastSnapshotIndex: lastIndex ?? 0,
      };
    });
  }

  /**
   * Get file artifacts that changed in a specific snapshot range.
   */
  getArtifactsForRange(leftSnapshot: number, rightSnapshot: number): ReviewFileArtifact[] {
    const allArtifacts = this.getAllArtifacts();

    return allArtifacts.filter((artifact) => {
      // Include if artifact exists in both snapshots OR was added/deleted in range
      return (
        artifact.firstSnapshotIndex <= rightSnapshot &&
        artifact.lastSnapshotIndex >= leftSnapshot
      );
    });
  }

  /**
   * Get a single file artifact by ID.
   */
  getArtifact(artifactId: number): ReviewFileArtifact | undefined {
    const artifact = this.db.queryOne<FileArtifactRow>(
      'SELECT * FROM file_artifacts WHERE id = ?',
      [artifactId]
    );

    if (!artifact) return undefined;

    const snapshots = this.db.query<ArtifactSnapshotRow>(
      'SELECT * FROM artifact_snapshots WHERE artifact_id = ? ORDER BY snapshot_index',
      [artifactId]
    );

    const maxIndex = snapshots.reduce((max, s) => Math.max(max, s.snapshot_index), 0);
    const repoPaths: (string | null)[] = [];
    for (let i = 0; i <= maxIndex; i++) {
      const snapshot = snapshots.find((s) => s.snapshot_index === i);
      repoPaths.push(snapshot?.file_path ?? null);
    }

    const snapshotIndices = snapshots.map((s) => s.snapshot_index);

    return {
      id: artifact.id,
      changeTrackingId: artifact.change_tracking_id,
      repoPaths,
      firstSnapshotIndex: Math.min(...snapshotIndices),
      lastSnapshotIndex: Math.max(...snapshotIndices),
    };
  }

  // ============================================================================
  // File Content Queries
  // ============================================================================

  /**
   * Get file content at a specific snapshot.
   *
   * Since content is only stored when a file changes, this method looks for
   * the most recent non-null content at or before the requested snapshot index.
   * This ensures:
   * - Files added in earlier iterations are found when comparing later iterations
   * - Files marked as "added" in the PR (where left snapshots have null content)
   *   correctly find their actual content from right snapshots
   */
  getFileContent(artifactId: number, snapshotIndex: number): FileContent | undefined {
    // Look for most recent non-null content at or before the requested snapshot
    // This handles the case where left snapshots of "added" files have null content
    const row = this.db.queryOne<FileContentRow>(
      `SELECT * FROM file_contents
       WHERE artifact_id = ? AND snapshot_index <= ? AND content IS NOT NULL
       ORDER BY snapshot_index DESC LIMIT 1`,
      [artifactId, snapshotIndex]
    );

    if (!row) return undefined;

    return {
      artifactId: row.artifact_id,
      snapshotIndex: row.snapshot_index,
      content: row.content,
      contentHash: row.content_hash,
      sizeBytes: row.size_bytes,
    };
  }

  /**
   * Get file path at a specific snapshot.
   */
  getFilePath(artifactId: number, snapshotIndex: number): string | null {
    const row = this.db.queryOne<ArtifactSnapshotRow>(
      'SELECT file_path FROM artifact_snapshots WHERE artifact_id = ? AND snapshot_index = ?',
      [artifactId, snapshotIndex]
    );

    return row?.file_path ?? null;
  }

  /**
   * Check if two snapshots have identical content (for optimization).
   */
  areContentsIdentical(
    artifactId: number,
    leftSnapshot: number,
    rightSnapshot: number
  ): boolean {
    const hashes = this.db.query<{ content_hash: string }>(
      `SELECT content_hash FROM file_contents
       WHERE artifact_id = ? AND snapshot_index IN (?, ?)`,
      [artifactId, leftSnapshot, rightSnapshot]
    );

    const first = hashes[0];
    const second = hashes[1];

    if (!first || !second) {
      return false;
    }

    return first.content_hash === second.content_hash;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get statistics about the database.
   */
  getStats(): {
    iterationCount: number;
    artifactCount: number;
    totalContentSize: number;
  } {
    const iterationCount = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM iterations'
    )?.count ?? 0;

    const artifactCount = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM file_artifacts'
    )?.count ?? 0;

    const totalContentSize = this.db.queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(size_bytes), 0) as total FROM file_contents'
    )?.total ?? 0;

    return {
      iterationCount,
      artifactCount,
      totalContentSize,
    };
  }

  /**
   * Close the database.
   */
  close(): void {
    this.db.close();
  }
}
