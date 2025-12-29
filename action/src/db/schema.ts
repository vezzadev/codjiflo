/**
 * SQLite Schema for CodjiFlo Iteration Tracking
 *
 * Defines the database schema for storing iterations, file artifacts,
 * content, and precomputed SpanTrackers.
 */

export const SCHEMA_SQL = `
-- Iterations table
-- Each row represents a PR revision (synchronize event)
CREATE TABLE IF NOT EXISTS iterations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  revision INTEGER NOT NULL UNIQUE,
  head_sha TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  before_sha TEXT,
  author TEXT,
  created_at TEXT NOT NULL
);

-- File artifacts table
-- Tracks a file's identity across iterations (handles renames)
CREATE TABLE IF NOT EXISTS file_artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  change_tracking_id TEXT NOT NULL UNIQUE
);

-- Artifact snapshots table
-- Maps artifact ID to file path at each snapshot
-- null path means file doesn't exist at that snapshot
CREATE TABLE IF NOT EXISTS artifact_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER NOT NULL REFERENCES file_artifacts(id),
  snapshot_index INTEGER NOT NULL,
  file_path TEXT,
  UNIQUE(artifact_id, snapshot_index)
);

-- File contents table (with deduplication via content_hash)
-- Stores actual file content at each snapshot
CREATE TABLE IF NOT EXISTS file_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER NOT NULL REFERENCES file_artifacts(id),
  snapshot_index INTEGER NOT NULL,
  content TEXT,
  content_hash TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  UNIQUE(artifact_id, snapshot_index)
);

-- SpanTrackers table
-- Precomputed line mappings between snapshots
CREATE TABLE IF NOT EXISTS span_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER NOT NULL REFERENCES file_artifacts(id),
  left_snapshot_index INTEGER NOT NULL,
  right_snapshot_index INTEGER NOT NULL,
  UNIQUE(artifact_id, left_snapshot_index, right_snapshot_index)
);

-- Span mappings table (normalized, not BLOB)
-- Line-by-line mappings for SpanTracker
CREATE TABLE IF NOT EXISTS span_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracker_id INTEGER NOT NULL REFERENCES span_trackers(id),
  left_line_start INTEGER,
  left_line_end INTEGER,
  right_line_start INTEGER,
  right_line_end INTEGER,
  mapping_type TEXT NOT NULL CHECK(mapping_type IN ('unchanged', 'modified', 'deleted', 'added'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_artifact_snapshots_artifact ON artifact_snapshots(artifact_id);
CREATE INDEX IF NOT EXISTS idx_file_contents_artifact ON file_contents(artifact_id);
CREATE INDEX IF NOT EXISTS idx_span_trackers_artifact ON span_trackers(artifact_id);
CREATE INDEX IF NOT EXISTS idx_span_mappings_tracker ON span_mappings(tracker_id);
`;

export const SCHEMA_VERSION = 1;
