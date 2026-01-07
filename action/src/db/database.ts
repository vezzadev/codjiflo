/**
 * Database Operations for CodjiFlo Action
 *
 * Provides typed query methods for the iteration database.
 */

import Database from 'better-sqlite3';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';

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
  id: number;
  artifact_id: number;
  snapshot_index: number;
  file_path: string | null;
  content_hash: string | null;
}

export interface ContentBlobRow {
  content_hash: string;
  content: string;
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

export interface PRDescriptionRow {
  id: number;
  iteration_id: number;
  source_hash: string;
  rendered_hash: string;
}

export interface PRCommentRow {
  id: number;
  iteration_id: number;
  github_id: number;
  author_login: string;
  author_avatar_url: string | null;
  file_path: string | null;
  line_number: number | null;
  side: 'LEFT' | 'RIGHT' | null;
  source_hash: string;
  rendered_hash: string;
  created_at: string;
  updated_at: string;
  in_reply_to_id: number | null;
}

export interface PRCommentInput {
  github_id: number;
  author_login: string;
  author_avatar_url?: string;
  file_path?: string;
  line_number?: number;
  side?: 'LEFT' | 'RIGHT';
  source_md: string;
  rendered_html: string;
  created_at: string;
  updated_at: string;
  in_reply_to_id?: number;
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
    this.checkSchemaVersion();
  }

  /**
   * Check if the database schema version matches the code version.
   * Warns if there's a mismatch - this will be useful when we need to
   * perform schema migrations in future versions.
   */
  private checkSchemaVersion(): void {
    const dbVersion = this.getSchemaVersion();
    if (dbVersion !== SCHEMA_VERSION) {
      logger.warn({
        event: 'schema_version_mismatch',
        'db.schema.version': dbVersion,
        'db.schema.expected': SCHEMA_VERSION,
      }, 'Schema migrations will be added in a future release');
    }
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

  // --------------------------------------------------------------------------
  // Artifact Snapshot Methods
  // --------------------------------------------------------------------------

  /**
   * Insert or update an artifact snapshot with optional content.
   * Content is deduplicated via content_blobs table.
   */
  insertArtifactSnapshot(
    artifactId: number,
    snapshotIndex: number,
    filePath: string | null,
    content: string | null
  ): void {
    let contentHash: string | null = null;

    if (content !== null) {
      contentHash = this.getOrCreateContentBlob(content);
    }

    this.db.prepare(`
      INSERT OR REPLACE INTO artifact_snapshots (artifact_id, snapshot_index, file_path, content_hash)
      VALUES (?, ?, ?, ?)
    `).run(artifactId, snapshotIndex, filePath, contentHash);
  }

  /**
   * Get artifact snapshot with content.
   */
  getArtifactSnapshot(artifactId: number, snapshotIndex: number): {
    artifactId: number;
    snapshotIndex: number;
    filePath: string | null;
    content: string | null;
    contentHash: string | null;
    sizeBytes: number;
  } | undefined {
    const row = this.db.prepare<[number, number], {
      artifact_id: number;
      snapshot_index: number;
      file_path: string | null;
      content: string | null;
      content_hash: string | null;
      size_bytes: number | null;
    }>(`
      SELECT
        s.artifact_id,
        s.snapshot_index,
        s.file_path,
        b.content,
        s.content_hash,
        b.size_bytes
      FROM artifact_snapshots s
      LEFT JOIN content_blobs b ON s.content_hash = b.content_hash
      WHERE s.artifact_id = ? AND s.snapshot_index = ?
    `).get(artifactId, snapshotIndex);

    if (!row) return undefined;

    return {
      artifactId: row.artifact_id,
      snapshotIndex: row.snapshot_index,
      filePath: row.file_path,
      content: row.content,
      contentHash: row.content_hash,
      sizeBytes: row.size_bytes ?? 0,
    };
  }

  // --------------------------------------------------------------------------
  // Content Blob Methods
  // --------------------------------------------------------------------------

  /**
   * Get or create a content blob with deduplication.
   * Returns the content hash (which is the primary key).
   */
  getOrCreateContentBlob(content: string): string {
    const contentHash = this.hashContent(content);

    // Try to find existing blob with same hash
    const existing = this.db.prepare<[string], { content_hash: string }>(`
      SELECT content_hash FROM content_blobs WHERE content_hash = ?
    `).get(contentHash);

    if (existing) {
      return existing.content_hash;
    }

    // Create new blob
    const sizeBytes = Buffer.byteLength(content, 'utf-8');
    this.db.prepare(`
      INSERT INTO content_blobs (content_hash, content, size_bytes)
      VALUES (?, ?, ?)
    `).run(contentHash, content, sizeBytes);

    return contentHash;
  }

  /**
   * Get content by hash.
   */
  getContentBlob(contentHash: string): ContentBlobRow | undefined {
    return this.db.prepare<[string], ContentBlobRow>(`
      SELECT * FROM content_blobs WHERE content_hash = ?
    `).get(contentHash);
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
  // PR Description Methods
  // --------------------------------------------------------------------------

  /**
   * Insert or update PR description for an iteration.
   * Both source markdown and rendered HTML are stored in content_blobs.
   */
  insertPRDescription(
    iterationId: number,
    sourceMd: string,
    renderedHtml: string
  ): void {
    const sourceHash = this.getOrCreateContentBlob(sourceMd);
    const renderedHash = this.getOrCreateContentBlob(renderedHtml);

    this.db.prepare(`
      INSERT OR REPLACE INTO pr_descriptions (iteration_id, source_hash, rendered_hash)
      VALUES (?, ?, ?)
    `).run(iterationId, sourceHash, renderedHash);
  }

  /**
   * Get PR description for an iteration with resolved content.
   */
  getPRDescription(iterationId: number): {
    sourceMd: string;
    renderedHtml: string;
  } | undefined {
    const row = this.db.prepare<[number], {
      source_content: string;
      rendered_content: string;
    }>(`
      SELECT
        src.content as source_content,
        rnd.content as rendered_content
      FROM pr_descriptions d
      JOIN content_blobs src ON d.source_hash = src.content_hash
      JOIN content_blobs rnd ON d.rendered_hash = rnd.content_hash
      WHERE d.iteration_id = ?
    `).get(iterationId);

    if (!row) return undefined;

    return {
      sourceMd: row.source_content,
      renderedHtml: row.rendered_content,
    };
  }

  // --------------------------------------------------------------------------
  // PR Comment Methods
  // --------------------------------------------------------------------------

  /**
   * Insert or update a PR comment for an iteration.
   * Both source markdown and rendered HTML are stored in content_blobs.
   */
  insertPRComment(iterationId: number, comment: PRCommentInput): void {
    const sourceHash = this.getOrCreateContentBlob(comment.source_md);
    const renderedHash = this.getOrCreateContentBlob(comment.rendered_html);

    this.db.prepare(`
      INSERT OR REPLACE INTO pr_comments (
        iteration_id, github_id, author_login, author_avatar_url,
        file_path, line_number, side, source_hash, rendered_hash,
        created_at, updated_at, in_reply_to_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      iterationId,
      comment.github_id,
      comment.author_login,
      comment.author_avatar_url ?? null,
      comment.file_path ?? null,
      comment.line_number ?? null,
      comment.side ?? null,
      sourceHash,
      renderedHash,
      comment.created_at,
      comment.updated_at,
      comment.in_reply_to_id ?? null
    );
  }

  /**
   * Bulk insert PR comments for an iteration.
   */
  insertPRComments(iterationId: number, comments: PRCommentInput[]): void {
    const insertMany = this.db.transaction((comments: PRCommentInput[]) => {
      for (const comment of comments) {
        this.insertPRComment(iterationId, comment);
      }
    });
    insertMany(comments);
  }

  /**
   * Get all PR comments for an iteration with resolved content.
   */
  getPRComments(iterationId: number): Array<PRCommentRow & {
    source_md: string;
    rendered_html: string;
  }> {
    return this.db.prepare<[number], PRCommentRow & {
      source_md: string;
      rendered_html: string;
    }>(`
      SELECT
        c.*,
        src.content as source_md,
        rnd.content as rendered_html
      FROM pr_comments c
      JOIN content_blobs src ON c.source_hash = src.content_hash
      JOIN content_blobs rnd ON c.rendered_hash = rnd.content_hash
      WHERE c.iteration_id = ?
      ORDER BY c.created_at ASC
    `).all(iterationId);
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  private hashContent(content: string): string {
    return createHash('sha1').update(content).digest('hex');
  }

  /**
   * Get the schema version stored in the database.
   */
  getSchemaVersion(): number {
    const row = this.db.prepare<[], { value: string }>(`
      SELECT value FROM schema_meta WHERE key = 'version'
    `).get();
    return row ? parseInt(row.value, 10) : 0;
  }

  /**
   * Check if the database schema is compatible with the current code.
   */
  isSchemaCompatible(): boolean {
    return this.getSchemaVersion() === SCHEMA_VERSION;
  }

  export(): Buffer {
    return this.db.serialize();
  }

  close(): void {
    this.db.close();
  }
}
