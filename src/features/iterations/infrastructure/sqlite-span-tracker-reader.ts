/**
 * SpanTracker Infrastructure Layer: SQLite Reader
 *
 * Implements ISpanTrackerReader using SQL.js to read from artifact database.
 * This is the adapter that connects domain logic to SQLite storage.
 */

import type { ISpanTrackerReader } from '../application';
import type { ISpanTracker, LineMapping, SpanMappingType } from '../domain';
import { createSpanTracker, createLineSpan } from '../domain';
import type { SQLiteDatabase } from '@/lib/sqlite-wasm';

// ============================================================================
// SQLite Row Types
// ============================================================================

interface SpanTrackerRow {
  id: number;
  artifact_id: number;
  left_snapshot_index: number;
  right_snapshot_index: number;
}

interface SpanMappingRow {
  id: number;
  tracker_id: number;
  left_line_start: number | null;
  left_line_end: number | null;
  right_line_start: number | null;
  right_line_end: number | null;
  mapping_type: string;
}

interface FileContentRow {
  content_hash: string;
}

// ============================================================================
// SQLite SpanTracker Reader
// ============================================================================

/**
 * Reads SpanTrackers from SQLite artifact database.
 * Implements the ISpanTrackerReader port interface.
 */
export class SQLiteSpanTrackerReader implements ISpanTrackerReader {
  private db: SQLiteDatabase;

  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  /**
   * Load a precomputed SpanTracker for a specific snapshot pair.
   */
  getSpanTracker(
    artifactId: number,
    leftSnapshotIndex: number,
    rightSnapshotIndex: number
  ): Promise<ISpanTracker | null> {
    // Find the tracker record
    const trackers = this.db.query<SpanTrackerRow>(
      `SELECT * FROM span_trackers
       WHERE artifact_id = ? AND left_snapshot_index = ? AND right_snapshot_index = ?`,
      [artifactId, leftSnapshotIndex, rightSnapshotIndex]
    );

    const tracker = trackers[0];
    if (!tracker) {
      return Promise.resolve(null);
    }

    // Load all mappings for this tracker
    const mappingRows = this.db.query<SpanMappingRow>(
      `SELECT * FROM span_mappings WHERE tracker_id = ? ORDER BY id`,
      [tracker.id]
    );

    // Convert rows to domain objects
    const mappings: LineMapping[] = mappingRows.map((row) => ({
      leftSpan:
        row.left_line_start !== null && row.left_line_end !== null
          ? createLineSpan(row.left_line_start, row.left_line_end)
          : null,
      rightSpan:
        row.right_line_start !== null && row.right_line_end !== null
          ? createLineSpan(row.right_line_start, row.right_line_end)
          : null,
      type: row.mapping_type as SpanMappingType,
    }));

    return Promise.resolve(createSpanTracker(leftSnapshotIndex, rightSnapshotIndex, mappings));
  }

  /**
   * Check if files are identical (same content hash) for identity optimization.
   */
  areFilesIdentical(
    artifactId: number,
    leftSnapshotIndex: number,
    rightSnapshotIndex: number
  ): Promise<boolean> {
    const hashes = this.db.query<FileContentRow>(
      `SELECT content_hash FROM file_contents
       WHERE artifact_id = ? AND snapshot_index IN (?, ?)`,
      [artifactId, leftSnapshotIndex, rightSnapshotIndex]
    );

    if (hashes.length !== 2) {
      // One or both snapshots missing - not identical
      return Promise.resolve(false);
    }

    const first = hashes[0];
    const second = hashes[1];
    if (!first || !second) {
      return Promise.resolve(false);
    }

    return Promise.resolve(first.content_hash === second.content_hash);
  }
}
