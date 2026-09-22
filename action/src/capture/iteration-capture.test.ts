/**
 * Tests for captureIteration
 *
 * Verifies that re-running captureIteration on the same head_sha does not
 * produce duplicate phantom iterations (issue #486).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IterationDatabase } from '../db/database';
import { captureIteration } from './iteration-capture';

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock @actions/github so github.context.actor is defined
vi.mock('@actions/github', () => ({
  context: {
    actor: 'test-actor',
    repo: { owner: 'octo', repo: 'repo' },
    payload: {},
  },
  getOctokit: vi.fn(),
}));

// Mock file-fetcher to avoid network
vi.mock('./file-fetcher', () => ({
  fetchFileContent: vi.fn(async () => 'file contents'),
}));

function makeOctokit() {
  const listFiles = vi.fn();
  // paginate just calls the method with the params and returns a fixed list
  const paginate = vi.fn(async () => [
    {
      filename: 'foo.txt',
      status: 'modified',
      sha: 'file-sha-1',
    },
  ]);
  return {
    paginate,
    rest: {
      pulls: { listFiles },
    },
  } as unknown as Parameters<typeof captureIteration>[1]['octokit'];
}

describe('captureIteration dedup on same head_sha (issue #486)', () => {
  let db: IterationDatabase;
  let dbPath: string;

  beforeEach(() => {
    const tempDir = os.tmpdir();
    dbPath = path.join(tempDir, `codjiflo-dedup-test-${Date.now()}-${Math.random()}.db`);
    db = new IterationDatabase(dbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  it('does not create duplicate iteration rows when run twice with same head_sha', async () => {
    const ctx = {
      octokit: makeOctokit(),
      owner: 'octo',
      repo: 'repo',
      prNumber: 1,
      headSha: 'deadbeef',
      baseSha: 'basefeed',
      beforeSha: null,
    };

    const firstId = await captureIteration(db, ctx);
    const firstSnapshotCount = (db as unknown as {
      db: { prepare: (sql: string) => { get: () => { count: number } } };
    }).db.prepare('SELECT COUNT(*) as count FROM artifact_snapshots').get().count;

    const secondId = await captureIteration(db, ctx);

    // Only one iteration row should exist
    expect(db.getIterationCount()).toBe(1);
    // Second call should short-circuit and return the same iteration id
    expect(secondId).toBe(firstId);

    // No new snapshots should have been written by the second call
    const secondSnapshotCount = (db as unknown as {
      db: { prepare: (sql: string) => { get: () => { count: number } } };
    }).db.prepare('SELECT COUNT(*) as count FROM artifact_snapshots').get().count;
    expect(secondSnapshotCount).toBe(firstSnapshotCount);
  });
});
