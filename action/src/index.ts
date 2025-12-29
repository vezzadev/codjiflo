/**
 * CodjiFlo GitHub Action Entry Point
 *
 * Captures PR iterations for force-push resilient code review.
 *
 * Workflow:
 * 1. Open/create SQLite database
 * 2. Capture iteration data (files, content)
 * 3. Compute SpanTrackers
 * 4. Output paths for artifact upload (handled by action.yml)
 * 5. Update PR comment
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

import { IterationDatabase } from './db/database';
import { captureIteration, getCaptureContext } from './capture/iteration-capture';
import { computeSpanTrackers, prepareSpanTrackerInputs } from './spantracker/tracker';
import { updatePRComment } from './comment/comment-manager';

// ============================================================================
// Main Action
// ============================================================================

async function run(): Promise<void> {
  try {
    // Get token from environment (set by action.yml)
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
    const octokit = github.getOctokit(token);

    // Get context
    const ctx = getCaptureContext(octokit);
    if (!ctx) {
      core.info('Not a pull_request event, skipping');
      return;
    }

    const { owner, repo, prNumber } = ctx;
    core.info(`Processing PR #${prNumber} in ${owner}/${repo}`);

    // Setup paths - use workspace for artifact upload
    const workDir = process.env.GITHUB_WORKSPACE
      ? join(process.env.GITHUB_WORKSPACE, '.codjiflo')
      : join(process.cwd(), '.codjiflo');
    if (!existsSync(workDir)) {
      mkdirSync(workDir, { recursive: true });
    }
    const dbPath = join(workDir, 'iterations.db');
    const artifactName = `codjiflo-pr-${prNumber}`;

    // Check if we have an existing database (downloaded by action.yml)
    const hasExistingDb = existsSync(dbPath);
    if (hasExistingDb) {
      core.info('Found existing database from previous iteration');
    } else {
      core.info('Creating new database');
    }

    // Open database
    const db = new IterationDatabase(dbPath);

    try {
      // Capture iteration
      core.info('Capturing iteration...');
      const iterationId = await captureIteration(db, ctx);
      core.info(`Captured iteration ${iterationId}`);

      // Get iteration info for SpanTracker computation
      const iteration = db.getLatestIteration();
      if (!iteration) {
        throw new Error('Failed to get iteration after capture');
      }

      const leftSnapshotIndex = (iteration.revision - 1) * 2;
      const rightSnapshotIndex = leftSnapshotIndex + 1;

      // Get all artifact IDs for this iteration
      // TODO: Query actual artifact IDs from database
      const artifactIds: number[] = [];

      // Compute SpanTrackers
      core.info('Computing SpanTrackers...');
      const trackerInputs = prepareSpanTrackerInputs(
        db,
        artifactIds,
        leftSnapshotIndex,
        rightSnapshotIndex
      );
      computeSpanTrackers(db, trackerInputs);
      core.info('SpanTrackers computed');

      // Export and close database
      const dbBuffer = db.export();
      db.close();

      // Write to file for artifact upload
      writeFileSync(dbPath, dbBuffer);
      core.info(`Database written to ${dbPath}`);

      // Set outputs for subsequent steps
      core.setOutput('db-path', dbPath);
      core.setOutput('artifact-name', artifactName);
      core.setOutput('iteration-count', iteration.revision);
      core.setOutput('work-dir', workDir);

      // Update PR comment
      core.info('Updating PR comment...');
      await updatePRComment(octokit, owner, repo, prNumber, {
        iterationCount: iteration.revision,
        artifactName,
        runId: github.context.runId,
        timestamp: new Date().toISOString(),
      });
      core.info('PR comment updated');

      core.info('Done! Artifact upload will be handled by action.yml');
    } catch (error) {
      db.close();
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();
