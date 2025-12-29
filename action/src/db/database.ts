/**
 * Database Operations for CodjiFlo Action
 *
 * Provides typed query methods for the iteration database.
 */

import Database from 'better-sqlite3';
import { SCHEMA_SQL } from './schema.js';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface IterationRow {
  id: number;
  revision: number;
  head_sha: string;
  base_sha: string;
  before_sha: string | null;
  author: string | null;
  created_at: string;
}

export interface FileArtifactRow {
  id: number;
  change_tracking_id: string;
}

export interface ArtifactSnapshotRow {
  artifact_id: number;
  snapshot_index: number;
  file_path: string | null;
}

export interface FileContentRow {
  artifact_id: number;
  snapshot_index: number;
  content: string | null;
  content_hash: string;
  size_bytes: number;
}

export interface SpanTrackerRow {
  id: number;
  artifact_id: number;
  left_snapshot_index: number;
  right_snapshot_index: number;
}

export interface SpanMappingRow {
  tracker_id: number;
  left_line_start: number | null;
  left_line_end: number | null;
  right_line_start: number | null;
  right_line_end: number | null;
  mapping_type: 'unchanged' | 'modified' | 'deleted' | 'added';
}

// ============================================================================
// Database Class
// ============================================================================

export class IterationDatabase {
  private db: Database.Database;

  constructor(filePath: string) {
    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA_SQL);
  }

  // --------------------------------------------------------------------------
  // Iteration Methods
  // --------------------------------------------------------------------------

  insertIteration(data: Omit<IterationRow, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO iterations (revision, head_sha, base_sha, before_sha, author, created_at)
      VALUES (@revision, @head_sha, @base_sha, @before_sha, @author, @created_at)
    `);
    const result = stmt.run(data);
    return result.lastInsertRowid as number;
  }

  getLatestIteration(): IterationRow | undefined {
    return this.db.prepare<[], IterationRow>(`
      SELECT * FROM iterations ORDER BY revision DESC LIMIT 1
    `).get();
  }

  getIterationCount(): number {
    const row = this.db.prepare<[], { count: number }>(`
      SELECT COUNT(*) as count FROM iterations
    `).get();
    return row?.count ?? 0;
  }

  // --------------------------------------------------------------------------
  // File Artifact Methods
  // --------------------------------------------------------------------------

  getOrCreateArtifact(changeTrackingId: string): number {
    // Try to find existing
    const existing = this.db.prepare<[string], FileArtifactRow>(`
      SELECT * FROM file_artifacts WHERE change_tracking_id = ?
    `).get(changeTrackingId);

    if (existing) {
      return existing.id;
    }

    // Create new
    const stmt = this.db.prepare(`
      INSERT INTO file_artifacts (change_tracking_id)
      VALUES (?)
    `);
    const result = stmt.run(changeTrackingId);
    return result.lastInsertRowid as number;
  }

  insertArtifactSnapshot(artifactId: number, snapshotIndex: number, filePath: string | null): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO artifact_snapshots (artifact_id, snapshot_index, file_path)
      VALUES (?, ?, ?)
    `).run(artifactId, snapshotIndex, filePath);
  }

  // --------------------------------------------------------------------------
  // File Content Methods
  // --------------------------------------------------------------------------

  insertFileContent(
    artifactId: number,
    snapshotIndex: number,
    content: string | null
  ): void {
    const contentHash = content ? this.hashContent(content) : 'null';
    const sizeBytes = content ? Buffer.byteLength(content, 'utf-8') : 0;

    this.db.prepare(`
      INSERT OR REPLACE INTO file_contents (artifact_id, snapshot_index, content, content_hash, size_bytes)
      VALUES (?, ?, ?, ?, ?)
    `).run(artifactId, snapshotIndex, content, contentHash, sizeBytes);
  }

  getFileContent(artifactId: number, snapshotIndex: number): FileContentRow | undefined {
    return this.db.prepare<[number, number], FileContentRow>(`
      SELECT * FROM file_contents WHERE artifact_id = ? AND snapshot_index = ?
    `).get(artifactId, snapshotIndex);
  }

  // --------------------------------------------------------------------------
  // SpanTracker Methods
  // --------------------------------------------------------------------------

  insertSpanTracker(
    artifactId: number,
    leftSnapshotIndex: number,
    rightSnapshotIndex: number
  ): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO span_trackers (artifact_id, left_snapshot_index, right_snapshot_index)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(artifactId, leftSnapshotIndex, rightSnapshotIndex);
    return result.lastInsertRowid as number;
  }

  insertSpanMapping(
    trackerId: number,
    leftStart: number | null,
    leftEnd: number | null,
    rightStart: number | null,
    rightEnd: number | null,
    mappingType: SpanMappingRow['mapping_type']
  ): void {
    this.db.prepare(`
      INSERT INTO span_mappings (tracker_id, left_line_start, left_line_end, right_line_start, right_line_end, mapping_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(trackerId, leftStart, leftEnd, rightStart, rightEnd, mappingType);
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  export(): Buffer {
    return this.db.serialize();
  }

  close(): void {
    this.db.close();
  }
}
