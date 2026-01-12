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
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

// Load schema from SQL file to avoid duplication
// This matches action/src/db/schema.sql
const SCHEMA_VERSION = 2;
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
// Path from e2e/fixtures/ to action/src/db/schema.sql
const SCHEMA_FILE_PATH = join(__dirname, '..', '..', 'action', 'src', 'db', 'schema.sql');
const schemaTemplate = readFileSync(SCHEMA_FILE_PATH, 'utf-8');
const SCHEMA_SQL = schemaTemplate.replace('{{SCHEMA_VERSION}}', String(SCHEMA_VERSION));

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

    db.prepare(
      `INSERT INTO iterations (revision, head_sha, base_sha, before_sha, author, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(revision, headSha, baseSha, beforeSha, author, createdAt);

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

  withAuthor(author: string): this {
    this.defaultAuthor = author;
    return this;
  }

  build(): MockIterationDb {
    return buildIterationDb({
      initialFiles: this.initialFiles,
      patches: this.patches,
      baseSha: this.baseSha,
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

// ============================================================================
// Rebase Scenario Builder
// ============================================================================

export interface RebaseIterationDbOptions {
  /** File path */
  filePath: string;
  /** Content at the original base (before rebase) */
  originalBaseContent: string;
  /** Content at head after iteration 1 */
  iteration1HeadContent: string;
  /** Content at the new base (after rebase) */
  rebasedBaseContent: string;
  /** Content at head after iteration 2 (after rebase) */
  iteration2HeadContent: string;
}

/**
 * Build a mock SQLite iteration database that simulates a rebase scenario.
 *
 * This is specifically for testing issue #151:
 * - Iteration 1: oldBase → head1
 * - Rebase happens: base changes to newBase
 * - Iteration 2: newBase → head2
 *
 * The key difference from normal iteration tracking is that iteration 2's
 * left snapshot has DIFFERENT content than what iteration 1 ended with.
 */
export function buildRebaseIterationDb(
  options: RebaseIterationDbOptions
): MockIterationDb {
  const {
    filePath,
    originalBaseContent,
    iteration1HeadContent,
    rebasedBaseContent,
    iteration2HeadContent,
  } = options;

  // Create in-memory SQLite database
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  // Insert artifact record
  const changeTrackingId = hashContent(filePath);
  db.prepare(
    "INSERT INTO file_artifacts (id, change_tracking_id) VALUES (?, ?)"
  ).run(1, changeTrackingId);

  // Iteration 1: oldBase → head1
  // Snapshots: 0 (left = oldBase), 1 (right = head1)
  db.prepare(
    `INSERT INTO iterations (revision, head_sha, base_sha, before_sha, author, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(1, "head-sha-1", "old-base-sha", null, "test-user", new Date().toISOString());

  const baseHash1 = storeContent(db, originalBaseContent);
  const headHash1 = storeContent(db, iteration1HeadContent);

  db.prepare(
    `INSERT INTO artifact_snapshots (artifact_id, snapshot_index, file_path, content_hash)
     VALUES (?, ?, ?, ?)`
  ).run(1, 0, filePath, baseHash1); // Snapshot 0: old base

  db.prepare(
    `INSERT INTO artifact_snapshots (artifact_id, snapshot_index, file_path, content_hash)
     VALUES (?, ?, ?, ?)`
  ).run(1, 1, filePath, headHash1); // Snapshot 1: head after iter 1

  // Iteration 2: newBase → head2 (after rebase)
  // Snapshots: 2 (left = newBase), 3 (right = head2)
  db.prepare(
    `INSERT INTO iterations (revision, head_sha, base_sha, before_sha, author, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(2, "head-sha-2", "new-base-sha", "head-sha-1", "test-user", new Date().toISOString());

  const baseHash2 = storeContent(db, rebasedBaseContent);
  const headHash2 = storeContent(db, iteration2HeadContent);

  db.prepare(
    `INSERT INTO artifact_snapshots (artifact_id, snapshot_index, file_path, content_hash)
     VALUES (?, ?, ?, ?)`
  ).run(1, 2, filePath, baseHash2); // Snapshot 2: NEW base (after rebase)

  db.prepare(
    `INSERT INTO artifact_snapshots (artifact_id, snapshot_index, file_path, content_hash)
     VALUES (?, ?, ?, ?)`
  ).run(1, 3, filePath, headHash2); // Snapshot 3: head after iter 2

  // Compute span trackers for both iterations
  for (const [leftIdx, rightIdx, leftContent, rightContent] of [
    [0, 1, originalBaseContent, iteration1HeadContent],
    [2, 3, rebasedBaseContent, iteration2HeadContent],
  ] as const) {
    const trackerId = db
      .prepare(
        `INSERT INTO span_trackers (artifact_id, left_snapshot_index, right_snapshot_index)
         VALUES (?, ?, ?)`
      )
      .run(1, leftIdx, rightIdx).lastInsertRowid;

    const diffs = computeLineDiff(leftContent, rightContent);
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

  // Export database to buffer
  const uint8Array = db.serialize();
  db.close();

  return {
    buffer: uint8Array.buffer.slice(
      uint8Array.byteOffset,
      uint8Array.byteOffset + uint8Array.byteLength
    ) as ArrayBuffer,
    meta: {
      iterationCount: 2,
      fileCount: 1,
      snapshotCount: 4,
    },
  };
}
