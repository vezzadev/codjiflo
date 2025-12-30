/**
 * Tests for IterationDatabase
 *
 * Verifies database operations including content deduplication.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IterationDatabase } from './database';
import { SCHEMA_VERSION } from './schema';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('IterationDatabase', () => {
  let db: IterationDatabase;
  let dbPath: string;

  beforeEach(() => {
    // Create temp file for database
    const tempDir = os.tmpdir();
    dbPath = path.join(tempDir, `codjiflo-test-${Date.now()}.db`);
    db = new IterationDatabase(dbPath);
  });

  afterEach(() => {
    db.close();
    // Clean up temp file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    // Also clean up WAL files
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  describe('insertIteration', () => {
    it('should insert an iteration and return its ID', () => {
      const id = db.insertIteration({
        revision: 1,
        head_sha: 'abc123',
        base_sha: 'def456',
        before_sha: null,
        author: 'test-user',
        created_at: '2025-01-01T00:00:00Z',
      });

      expect(id).toBe(1);
    });

    it('should increment IDs for multiple iterations', () => {
      const id1 = db.insertIteration({
        revision: 1,
        head_sha: 'abc123',
        base_sha: 'def456',
        before_sha: null,
        author: 'test-user',
        created_at: '2025-01-01T00:00:00Z',
      });

      const id2 = db.insertIteration({
        revision: 2,
        head_sha: 'ghi789',
        base_sha: 'def456',
        before_sha: 'abc123',
        author: 'test-user',
        created_at: '2025-01-02T00:00:00Z',
      });

      expect(id1).toBe(1);
      expect(id2).toBe(2);
    });
  });

  describe('getLatestIteration', () => {
    it('should return undefined when no iterations exist', () => {
      const result = db.getLatestIteration();
      expect(result).toBeUndefined();
    });

    it('should return the latest iteration by revision', () => {
      db.insertIteration({
        revision: 1,
        head_sha: 'abc123',
        base_sha: 'def456',
        before_sha: null,
        author: 'user1',
        created_at: '2025-01-01T00:00:00Z',
      });

      db.insertIteration({
        revision: 2,
        head_sha: 'ghi789',
        base_sha: 'def456',
        before_sha: 'abc123',
        author: 'user2',
        created_at: '2025-01-02T00:00:00Z',
      });

      const latest = db.getLatestIteration();
      expect(latest?.revision).toBe(2);
      expect(latest?.head_sha).toBe('ghi789');
    });
  });

  describe('getIterationCount', () => {
    it('should return 0 when no iterations exist', () => {
      expect(db.getIterationCount()).toBe(0);
    });

    it('should return correct count', () => {
      db.insertIteration({
        revision: 1,
        head_sha: 'abc',
        base_sha: 'def',
        before_sha: null,
        author: 'user',
        created_at: '2025-01-01T00:00:00Z',
      });

      db.insertIteration({
        revision: 2,
        head_sha: 'ghi',
        base_sha: 'def',
        before_sha: 'abc',
        author: 'user',
        created_at: '2025-01-02T00:00:00Z',
      });

      expect(db.getIterationCount()).toBe(2);
    });
  });

  describe('getOrCreateArtifact', () => {
    it('should create a new artifact and return its ID', () => {
      const id = db.getOrCreateArtifact('file-tracking-id-1');
      expect(id).toBe(1);
    });

    it('should return existing artifact ID for same tracking ID', () => {
      const id1 = db.getOrCreateArtifact('file-tracking-id-1');
      const id2 = db.getOrCreateArtifact('file-tracking-id-1');
      expect(id1).toBe(id2);
    });

    it('should create different artifacts for different tracking IDs', () => {
      const id1 = db.getOrCreateArtifact('file-tracking-id-1');
      const id2 = db.getOrCreateArtifact('file-tracking-id-2');
      expect(id1).not.toBe(id2);
    });
  });

  describe('content deduplication', () => {
    it('should deduplicate identical content across different snapshots', () => {
      const artifactId = db.getOrCreateArtifact('file-1');
      const content = 'Hello, World!';

      // Insert same content for two different snapshots
      db.insertArtifactSnapshot(artifactId, 0, 'file.txt', content);
      db.insertArtifactSnapshot(artifactId, 1, 'file.txt', content);

      // Verify both snapshots reference the same content
      const snapshot0 = db.getArtifactSnapshot(artifactId, 0);
      const snapshot1 = db.getArtifactSnapshot(artifactId, 1);

      expect(snapshot0?.content).toBe(content);
      expect(snapshot1?.content).toBe(content);
      expect(snapshot0?.contentHash).toBe(snapshot1?.contentHash);
    });

    it('should deduplicate identical content across different artifacts', () => {
      const artifact1 = db.getOrCreateArtifact('file-1');
      const artifact2 = db.getOrCreateArtifact('file-2');
      const content = 'Shared content';

      db.insertArtifactSnapshot(artifact1, 0, 'file1.txt', content);
      db.insertArtifactSnapshot(artifact2, 0, 'file2.txt', content);

      const snapshot1 = db.getArtifactSnapshot(artifact1, 0);
      const snapshot2 = db.getArtifactSnapshot(artifact2, 0);

      expect(snapshot1?.contentHash).toBe(snapshot2?.contentHash);
    });

    it('should store different content separately', () => {
      const artifactId = db.getOrCreateArtifact('file-1');

      db.insertArtifactSnapshot(artifactId, 0, 'file.txt', 'Content v1');
      db.insertArtifactSnapshot(artifactId, 1, 'file.txt', 'Content v2');

      const snapshot0 = db.getArtifactSnapshot(artifactId, 0);
      const snapshot1 = db.getArtifactSnapshot(artifactId, 1);

      expect(snapshot0?.content).toBe('Content v1');
      expect(snapshot1?.content).toBe('Content v2');
      expect(snapshot0?.contentHash).not.toBe(snapshot1?.contentHash);
    });

    it('should handle null content for deleted files', () => {
      const artifactId = db.getOrCreateArtifact('file-1');

      db.insertArtifactSnapshot(artifactId, 0, 'file.txt', 'Some content');
      db.insertArtifactSnapshot(artifactId, 1, null, null); // File deleted

      const snapshot0 = db.getArtifactSnapshot(artifactId, 0);
      const snapshot1 = db.getArtifactSnapshot(artifactId, 1);

      expect(snapshot0?.content).toBe('Some content');
      expect(snapshot1?.content).toBeNull();
      expect(snapshot1?.contentHash).toBeNull();
    });

    it('should calculate correct size in bytes', () => {
      const artifactId = db.getOrCreateArtifact('file-1');
      const content = 'Hello, 世界!'; // Mixed ASCII and UTF-8

      db.insertArtifactSnapshot(artifactId, 0, 'file.txt', content);

      const snapshot = db.getArtifactSnapshot(artifactId, 0);
      // "Hello, " = 7 bytes, "世界" = 6 bytes (3 per char), "!" = 1 byte = 14 bytes
      expect(snapshot?.sizeBytes).toBe(Buffer.byteLength(content, 'utf-8'));
    });
  });

  describe('getOrCreateContentBlob', () => {
    it('should return same hash for identical content', () => {
      const hash1 = db.getOrCreateContentBlob('test content');
      const hash2 = db.getOrCreateContentBlob('test content');
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different content', () => {
      const hash1 = db.getOrCreateContentBlob('content A');
      const hash2 = db.getOrCreateContentBlob('content B');
      expect(hash1).not.toBe(hash2);
    });

    it('should return valid SHA-1 hash format', () => {
      const hash = db.getOrCreateContentBlob('test');
      expect(hash).toMatch(/^[a-f0-9]{40}$/);
    });
  });

  describe('getContentBlob', () => {
    it('should retrieve stored content by hash', () => {
      const content = 'Test content for blob';
      const hash = db.getOrCreateContentBlob(content);

      const blob = db.getContentBlob(hash);
      expect(blob?.content).toBe(content);
      expect(blob?.content_hash).toBe(hash);
    });

    it('should return undefined for non-existent hash', () => {
      const blob = db.getContentBlob('nonexistent-hash');
      expect(blob).toBeUndefined();
    });
  });

  describe('insertArtifactSnapshot', () => {
    it('should store path and content together', () => {
      const artifactId = db.getOrCreateArtifact('file-1');

      db.insertArtifactSnapshot(artifactId, 0, 'src/file.ts', 'const x = 1;');

      const snapshot = db.getArtifactSnapshot(artifactId, 0);
      expect(snapshot?.filePath).toBe('src/file.ts');
      expect(snapshot?.content).toBe('const x = 1;');
    });

    it('should replace existing snapshot on conflict', () => {
      const artifactId = db.getOrCreateArtifact('file-1');

      db.insertArtifactSnapshot(artifactId, 0, 'file.txt', 'v1');
      db.insertArtifactSnapshot(artifactId, 0, 'file.txt', 'v2');

      const snapshot = db.getArtifactSnapshot(artifactId, 0);
      expect(snapshot?.content).toBe('v2');
    });
  });

  describe('SpanTracker methods', () => {
    it('should insert and retrieve span trackers', () => {
      const artifactId = db.getOrCreateArtifact('file-1');
      const trackerId = db.insertSpanTracker(artifactId, 0, 1);

      expect(trackerId).toBeGreaterThan(0);
    });

    it('should insert span mappings', () => {
      const artifactId = db.getOrCreateArtifact('file-1');
      const trackerId = db.insertSpanTracker(artifactId, 0, 1);

      // Should not throw
      db.insertSpanMapping(trackerId, 1, 5, 1, 5, 'unchanged');
      db.insertSpanMapping(trackerId, 6, 10, 6, 12, 'modified');
      db.insertSpanMapping(trackerId, 11, 15, null, null, 'deleted');
      db.insertSpanMapping(trackerId, null, null, 13, 20, 'added');
    });
  });

  describe('export', () => {
    it('should export database as Buffer', () => {
      db.insertIteration({
        revision: 1,
        head_sha: 'abc',
        base_sha: 'def',
        before_sha: null,
        author: 'user',
        created_at: '2025-01-01T00:00:00Z',
      });

      const buffer = db.export();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('schema version', () => {
    it('should store schema version in database', () => {
      const version = db.getSchemaVersion();
      expect(version).toBe(SCHEMA_VERSION);
    });

    it('should report schema as compatible', () => {
      expect(db.isSchemaCompatible()).toBe(true);
    });

    it('should return current schema version constant', () => {
      expect(SCHEMA_VERSION).toBe(2);
    });
  });
});
