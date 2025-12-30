/**
 * Iteration Capture Logic
 *
 * Captures PR iteration data from GitHub event payload.
 */

import * as github from '@actions/github';
import type { IterationDatabase } from '../db/database';
import { fetchFileContent } from './file-fetcher';

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
 * Uses pagination to handle PRs with more than 100 files.
 */
async function fetchChangedFiles(ctx: CaptureContext): Promise<ChangedFile[]> {
  const files = await ctx.octokit.paginate(ctx.octokit.rest.pulls.listFiles, {
    owner: ctx.owner,
    repo: ctx.repo,
    pull_number: ctx.prNumber,
    per_page: 100,
  });

  return files as ChangedFile[];
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

  // Fetch and store left snapshot (base) - path and content together
  const leftContent = leftPath
    ? await fetchFileContent(ctx.octokit, ctx.owner, ctx.repo, leftPath, ctx.baseSha)
    : null;
  db.insertArtifactSnapshot(artifactId, leftSnapshotIndex, leftPath, leftContent);

  // Fetch and store right snapshot (head) - path and content together
  const rightContent = rightPath
    ? await fetchFileContent(ctx.octokit, ctx.owner, ctx.repo, rightPath, ctx.headSha)
    : null;
  db.insertArtifactSnapshot(artifactId, rightSnapshotIndex, rightPath, rightContent);
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
