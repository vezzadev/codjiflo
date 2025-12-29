/**
 * Iteration Capture Logic
 *
 * Captures PR iteration data from GitHub event payload.
 */

import * as github from '@actions/github';
import type { IterationDatabase } from '../db/database.js';
import { fetchFileContent } from './file-fetcher.js';

// ============================================================================
// Types
// ============================================================================

interface CaptureContext {
  octokit: ReturnType<typeof github.getOctokit>;
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  baseSha: string;
  beforeSha: string | null;
}

interface ChangedFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  previous_filename?: string;
  sha: string;
}

// ============================================================================
// Capture Functions
// ============================================================================

/**
 * Capture a new iteration from PR event.
 */
export async function captureIteration(
  db: IterationDatabase,
  ctx: CaptureContext
): Promise<number> {
  const iterationCount = db.getIterationCount();
  const revision = iterationCount + 1;

  // Insert iteration record
  const iterationId = db.insertIteration({
    revision,
    head_sha: ctx.headSha,
    base_sha: ctx.baseSha,
    before_sha: ctx.beforeSha,
    author: github.context.actor,
    created_at: new Date().toISOString(),
  });

  // Calculate snapshot indices for this iteration
  const leftSnapshotIndex = (revision - 1) * 2;
  const rightSnapshotIndex = leftSnapshotIndex + 1;

  // Fetch changed files
  const changedFiles = await fetchChangedFiles(ctx);

  // Process each file
  for (const file of changedFiles) {
    await captureFile(db, ctx, file, leftSnapshotIndex, rightSnapshotIndex);
  }

  return iterationId;
}

/**
 * Fetch list of changed files in the PR.
 */
async function fetchChangedFiles(ctx: CaptureContext): Promise<ChangedFile[]> {
  const { data } = await ctx.octokit.rest.pulls.listFiles({
    owner: ctx.owner,
    repo: ctx.repo,
    pull_number: ctx.prNumber,
    per_page: 100, // TODO: Handle pagination for large PRs
  });

  return data as ChangedFile[];
}

/**
 * Capture a single file's snapshots.
 */
async function captureFile(
  db: IterationDatabase,
  ctx: CaptureContext,
  file: ChangedFile,
  leftSnapshotIndex: number,
  rightSnapshotIndex: number
): Promise<void> {
  // Use SHA as change tracking ID for rename detection
  const changeTrackingId = file.sha;
  const artifactId = db.getOrCreateArtifact(changeTrackingId);

  // Determine paths for left/right snapshots
  const leftPath = file.status === 'added' ? null : (file.previous_filename ?? file.filename);
  const rightPath = file.status === 'removed' ? null : file.filename;

  // Insert artifact snapshots (path at each snapshot)
  db.insertArtifactSnapshot(artifactId, leftSnapshotIndex, leftPath);
  db.insertArtifactSnapshot(artifactId, rightSnapshotIndex, rightPath);

  // Fetch and store file content for left snapshot (base)
  if (leftPath) {
    const leftContent = await fetchFileContent(
      ctx.octokit,
      ctx.owner,
      ctx.repo,
      leftPath,
      ctx.baseSha
    );
    db.insertFileContent(artifactId, leftSnapshotIndex, leftContent);
  } else {
    db.insertFileContent(artifactId, leftSnapshotIndex, null);
  }

  // Fetch and store file content for right snapshot (head)
  if (rightPath) {
    const rightContent = await fetchFileContent(
      ctx.octokit,
      ctx.owner,
      ctx.repo,
      rightPath,
      ctx.headSha
    );
    db.insertFileContent(artifactId, rightSnapshotIndex, rightContent);
  } else {
    db.insertFileContent(artifactId, rightSnapshotIndex, null);
  }
}

/**
 * Get capture context from GitHub event.
 */
export function getCaptureContext(
  octokit: ReturnType<typeof github.getOctokit>
): CaptureContext | null {
  const { payload } = github.context;

  if (!payload.pull_request) {
    return null;
  }

  const pr = payload.pull_request;

  return {
    octokit,
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    prNumber: pr.number,
    headSha: pr.head.sha,
    baseSha: pr.base.sha,
    beforeSha: payload.before ?? null,
  };
}
