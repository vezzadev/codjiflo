/**
 * Iteration Database Builder
 *
 * Generates SQLite iteration databases for E2E tests.
 * Takes initial files and git format-patch strings, produces an ArrayBuffer
 * compatible with the CodjiFlo iteration artifact format.
 */

import Database from "better-sqlite3";
import { createHash } from "crypto";
import { computeLineDiff, lineDiffsToSpanMappings } from "@codjiflo/diff-engine";
import { parsePatch, applyPatch as applyParsedPatch } from "./patch-parser";

// Inline schema to avoid import resolution issues with Playwright
// This matches action/src/db/schema.ts SCHEMA_SQL
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO schema_meta (key, value) VALUES ('version', '2');
CREATE TABLE IF NOT EXISTS iterations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  revision INTEGER NOT NULL UNIQUE,
  head_sha TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  before_sha TEXT,
  author TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS file_artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  change_tracking_id TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS content_blobs (
  content_hash TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  size_bytes INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS artifact_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER NOT NULL REFERENCES file_artifacts(id),
  snapshot_index INTEGER NOT NULL,
  file_path TEXT,
  content_hash TEXT REFERENCES content_blobs(content_hash),
  UNIQUE(artifact_id, snapshot_index)
);
CREATE TABLE IF NOT EXISTS span_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER NOT NULL REFERENCES file_artifacts(id),
  left_snapshot_index INTEGER NOT NULL,
  right_snapshot_index INTEGER NOT NULL,
  UNIQUE(artifact_id, left_snapshot_index, right_snapshot_index)
);
CREATE TABLE IF NOT EXISTS span_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracker_id INTEGER NOT NULL REFERENCES span_trackers(id),
  left_line_start INTEGER,
  left_line_end INTEGER,
  right_line_start INTEGER,
  right_line_end INTEGER,
  mapping_type TEXT NOT NULL CHECK(mapping_type IN ('unchanged', 'modified', 'deleted', 'added'))
);
CREATE INDEX IF NOT EXISTS idx_artifact_snapshots_artifact ON artifact_snapshots(artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_snapshots_hash ON artifact_snapshots(content_hash);
CREATE INDEX IF NOT EXISTS idx_span_trackers_artifact ON span_trackers(artifact_id);
CREATE INDEX IF NOT EXISTS idx_span_mappings_tracker ON span_mappings(tracker_id);
`;

// ============================================================================
// Types
// ============================================================================

export type InitialFiles = Record<string, string>;

export interface IterationDbBuilderOptions {
  /** Initial file contents (base state before first iteration) */
  initialFiles: InitialFiles;
  /** Array of git format-patch strings, one per iteration */
  patches: string[];
  /** Base SHA for all iterations (default: 'mock-base-sha') */
  baseSha?: string;
  /**
   * Per-iteration base SHAs (optional).
   * Key is 1-based revision number, value is the base SHA for that iteration.
   * Used to simulate rebase scenarios where base_sha changes.
   * Example: { 3: 'new-base-sha' } means iteration 3 was captured after a rebase.
   */
  baseShaOverrides?: Record<number, string>;
  /** Default author if not in patch (default: 'test-user') */
  defaultAuthor?: string;
}

export interface MockIterationDb {
  /** SQLite database as ArrayBuffer */
  buffer: ArrayBuffer;
  /** Metadata about the generated database */
  meta: {
    iterationCount: number;
    fileCount: number;
    snapshotCount: number;
  };
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Build a mock SQLite iteration database from initial files and patches.
 */
export function buildIterationDb(
  options: IterationDbBuilderOptions
): MockIterationDb {
  const {
    initialFiles,
    patches,
    baseSha = "mock-base-sha",
    baseShaOverrides = {},
    defaultAuthor = "test-user",
  } = options;

  // Create in-memory SQLite database
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  // Track file artifacts and their content across iterations
  const artifactIds = new Map<string, number>(); // path -> artifact_id
  let artifactIdCounter = 1;
  let snapshotCount = 0;

  // Current state of files (updated after each patch)
  let currentFiles = { ...initialFiles };

  // Process each patch as an iteration
  for (let revision = 1; revision <= patches.length; revision++) {
    const patchString = patches[revision - 1];
    if (!patchString) continue;

    const parsedPatch = parsePatch(patchString);

    // Calculate snapshot indices
    const leftSnapshotIndex = (revision - 1) * 2;
    const rightSnapshotIndex = leftSnapshotIndex + 1;

    // Insert iteration record
    const headSha =
      parsedPatch.commitSha ?? `mock-head-sha-${String(revision)}`;
    const beforeSha =
      revision > 1 ? `mock-head-sha-${String(revision - 1)}` : null;
    const author = parsedPatch.author ?? defaultAuthor;
    const createdAt = parsedPatch.date ?? new Date().toISOString();
    // Use override base SHA if provided (for rebase scenarios)
    const iterationBaseSha = baseShaOverrides[revision] ?? baseSha;

    db.prepare(
      `INSERT INTO iterations (revision, head_sha, base_sha, before_sha, author, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(revision, headSha, iterationBaseSha, beforeSha, author, createdAt);

    // Get file state before applying this patch
    const previousFiles = { ...currentFiles };

    // Apply the patch to get new state
    currentFiles = applyParsedPatch(currentFiles, parsedPatch);

    // Process each file change in the patch
    for (const fileDiff of parsedPatch.files) {
      const path = fileDiff.newPath ?? fileDiff.oldPath;
      if (!path) continue;

      // Get or create artifact
      let artifactId = artifactIds.get(path);
      if (artifactId === undefined) {
        artifactId = artifactIdCounter++;
        artifactIds.set(path, artifactId);

        // Insert artifact record
        const changeTrackingId = hashContent(path); // Use path hash as tracking ID
        db.prepare(
          "INSERT INTO file_artifacts (id, change_tracking_id) VALUES (?, ?)"
        ).run(artifactId, changeTrackingId);
      }

      // Get content for left (before) and right (after) snapshots
      const leftContent =
        fileDiff.oldPath !== null
          ? (previousFiles[fileDiff.oldPath] ?? null)
          : null;
      const rightContent =
        fileDiff.newPath !== null ? (currentFiles[fileDiff.newPath] ?? null) : null;

      // Store left snapshot
      const leftHash = leftContent !== null ? storeContent(db, leftContent) : null;
      const leftPath = fileDiff.oldPath;
      db.prepare(
        `INSERT INTO artifact_snapshots (artifact_id, snapshot_index, file_path, content_hash)
         VALUES (?, ?, ?, ?)`
      ).run(artifactId, leftSnapshotIndex, leftPath, leftHash);
      snapshotCount++;

      // Store right snapshot
      const rightHash = rightContent !== null ? storeContent(db, rightContent) : null;
      const rightPath = fileDiff.newPath;
      db.prepare(
        `INSERT INTO artifact_snapshots (artifact_id, snapshot_index, file_path, content_hash)
         VALUES (?, ?, ?, ?)`
      ).run(artifactId, rightSnapshotIndex, rightPath, rightHash);
      snapshotCount++;

      // Compute and store span tracker
      const trackerId = db
        .prepare(
          `INSERT INTO span_trackers (artifact_id, left_snapshot_index, right_snapshot_index)
           VALUES (?, ?, ?)`
        )
        .run(artifactId, leftSnapshotIndex, rightSnapshotIndex).lastInsertRowid;

      // Build and store span mappings
      const diffs = computeLineDiff(leftContent ?? "", rightContent ?? "");
      const mappings = lineDiffsToSpanMappings(diffs);
      const insertMapping = db.prepare(
        `INSERT INTO span_mappings (tracker_id, left_line_start, left_line_end, right_line_start, right_line_end, mapping_type)
         VALUES (?, ?, ?, ?, ?, ?)`
      );

      for (const mapping of mappings) {
        insertMapping.run(
          trackerId,
          mapping.left_line_start,
          mapping.left_line_end,
          mapping.right_line_start,
          mapping.right_line_end,
          mapping.mapping_type
        );
      }
    }
  }

  // Export database to buffer
  const uint8Array = db.serialize();
  db.close();

  return {
    buffer: uint8Array.buffer.slice(
      uint8Array.byteOffset,
      uint8Array.byteOffset + uint8Array.byteLength
    ) as ArrayBuffer,
    meta: {
      iterationCount: patches.length,
      fileCount: artifactIds.size,
      snapshotCount,
    },
  };
}

// ============================================================================
// Fluent Builder API
// ============================================================================

export class IterationDbBuilder {
  private initialFiles: InitialFiles = {};
  private patches: string[] = [];
  private baseSha = "mock-base-sha";
  private baseShaOverrides: Record<number, string> = {};
  private defaultAuthor = "test-user";

  withInitialFiles(files: InitialFiles): this {
    this.initialFiles = { ...this.initialFiles, ...files };
    return this;
  }

  withPatch(patch: string): this {
    this.patches.push(patch);
    return this;
  }

  withBaseSha(sha: string): this {
    this.baseSha = sha;
    return this;
  }

  /**
   * Set a different base SHA for a specific iteration (simulates rebase).
   * @param revision - 1-based iteration number
   * @param sha - The new base SHA after rebase
   */
  withRebaseAt(revision: number, sha: string): this {
    this.baseShaOverrides[revision] = sha;
    return this;
  }

  withAuthor(author: string): this {
    this.defaultAuthor = author;
    return this;
  }

  build(): MockIterationDb {
    return buildIterationDb({
      initialFiles: this.initialFiles,
      patches: this.patches,
      baseSha: this.baseSha,
      baseShaOverrides: this.baseShaOverrides,
      defaultAuthor: this.defaultAuthor,
    });
  }
}

export function createIterationDbBuilder(): IterationDbBuilder {
  return new IterationDbBuilder();
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Store content in content_blobs with deduplication.
 * Returns the content hash.
 */
function storeContent(db: Database.Database, content: string): string {
  const hash = hashContent(content);

  // Insert or ignore (deduplication)
  db.prepare(
    `INSERT OR IGNORE INTO content_blobs (content_hash, content, size_bytes)
     VALUES (?, ?, ?)`
  ).run(hash, content, Buffer.byteLength(content, "utf8"));

  return hash;
}

/**
 * Compute SHA-1 hash of content (same as Git).
 */
function hashContent(content: string): string {
  return createHash("sha1").update(content, "utf8").digest("hex");
}
