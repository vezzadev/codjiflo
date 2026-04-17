/**
 * Tests for SpanTracker computation.
 *
 * Specifically guards against off-by-one errors in the added-file and
 * deleted-file branches when computing line counts from raw content.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IterationDatabase } from '../db/database';
import { computeSpanTrackers } from './tracker';

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

interface SpanMappingRowRaw {
  tracker_id: number;
  left_line_start: number | null;
  left_line_end: number | null;
  right_line_start: number | null;
  right_line_end: number | null;
  mapping_type: string;
}

function getMappings(db: IterationDatabase, trackerId: number): SpanMappingRowRaw[] {
  // Reach into the underlying better-sqlite3 instance. tracker.ts already
  // uses the public insert API so we only need a read path for assertions.
  const rawDb = (db as unknown as { db: import('better-sqlite3').Database }).db;
  return rawDb
    .prepare<[number], SpanMappingRowRaw>(
      `SELECT * FROM span_mappings WHERE tracker_id = ? ORDER BY id`
    )
    .all(trackerId);
}

describe('computeSpanTrackers', () => {
  let db: IterationDatabase;
  let dbPath: string;
  let artifactId: number;

  beforeEach(() => {
    const tempDir = os.tmpdir();
    dbPath = path.join(tempDir, `codjiflo-tracker-test-${Date.now()}-${Math.random()}.db`);
    db = new IterationDatabase(dbPath);
    artifactId = db.getOrCreateArtifact('test-file.txt');
  });

  afterEach(() => {
    db.close();
    for (const suffix of ['', '-wal', '-shm']) {
      const p = dbPath + suffix;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  describe('added file (leftContent === null)', () => {
    it('should set right_line_end to the actual line count when content ends with a trailing newline', () => {
      const content = 'foo\nbar\nbaz\n'; // 3 lines, trailing newline
      computeSpanTrackers(db, [
        {
          artifactId,
          leftSnapshotIndex: 0,
          rightSnapshotIndex: 1,
          leftContent: null,
          rightContent: content,
        },
      ]);

      const rawDb = (db as unknown as { db: import('better-sqlite3').Database }).db;
      const tracker = rawDb
        .prepare<[number], { id: number }>(
          `SELECT id FROM span_trackers WHERE artifact_id = ?`
        )
        .get(artifactId);
      expect(tracker).toBeDefined();

      const mappings = getMappings(db, tracker!.id);
      expect(mappings).toHaveLength(1);
      expect(mappings[0].mapping_type).toBe('added');
      expect(mappings[0].right_line_start).toBe(1);
      // The buggy implementation returns 4 here because 'foo\nbar\nbaz\n'
      // split on '\n' yields 4 elements (with a trailing empty string).
      expect(mappings[0].right_line_end).toBe(3);
    });

    it('should not insert a span mapping when the added file is empty', () => {
      computeSpanTrackers(db, [
        {
          artifactId,
          leftSnapshotIndex: 0,
          rightSnapshotIndex: 1,
          leftContent: null,
          rightContent: '',
        },
      ]);

      const rawDb = (db as unknown as { db: import('better-sqlite3').Database }).db;
      const tracker = rawDb
        .prepare<[number], { id: number }>(
          `SELECT id FROM span_trackers WHERE artifact_id = ?`
        )
        .get(artifactId);
      expect(tracker).toBeDefined();

      const mappings = getMappings(db, tracker!.id);
      // The buggy implementation inserts a phantom [1,1] mapping for empty
      // content because ''.split('\n').length === 1.
      expect(mappings).toHaveLength(0);
    });
  });

  describe('deleted file (rightContent === null)', () => {
    it('should set left_line_end to the actual line count when content ends with a trailing newline', () => {
      const content = 'alpha\nbeta\n'; // 2 lines, trailing newline
      computeSpanTrackers(db, [
        {
          artifactId,
          leftSnapshotIndex: 0,
          rightSnapshotIndex: 1,
          leftContent: content,
          rightContent: null,
        },
      ]);

      const rawDb = (db as unknown as { db: import('better-sqlite3').Database }).db;
      const tracker = rawDb
        .prepare<[number], { id: number }>(
          `SELECT id FROM span_trackers WHERE artifact_id = ?`
        )
        .get(artifactId);
      expect(tracker).toBeDefined();

      const mappings = getMappings(db, tracker!.id);
      expect(mappings).toHaveLength(1);
      expect(mappings[0].mapping_type).toBe('deleted');
      expect(mappings[0].left_line_start).toBe(1);
      expect(mappings[0].left_line_end).toBe(2);
    });

    it('should not insert a span mapping when the deleted file was empty', () => {
      computeSpanTrackers(db, [
        {
          artifactId,
          leftSnapshotIndex: 0,
          rightSnapshotIndex: 1,
          leftContent: '',
          rightContent: null,
        },
      ]);

      const rawDb = (db as unknown as { db: import('better-sqlite3').Database }).db;
      const tracker = rawDb
        .prepare<[number], { id: number }>(
          `SELECT id FROM span_trackers WHERE artifact_id = ?`
        )
        .get(artifactId);
      expect(tracker).toBeDefined();

      const mappings = getMappings(db, tracker!.id);
      expect(mappings).toHaveLength(0);
    });
  });
});
