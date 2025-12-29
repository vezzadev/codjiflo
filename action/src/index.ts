/**
 * CodjiFlo GitHub Action Entry Point
 *
 * Captures PR iterations for force-push resilient code review.
 *
 * Workflow:
 * 1. Download previous artifact (if exists)
 * 2. Open/create SQLite database
 * 3. Capture iteration data (files, content)
 * 4. Compute SpanTrackers
 * 5. Upload artifact
 * 6. Update PR comment
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as artifact from '@actions/artifact';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
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
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const octokit = github.getOctokit(token);

    // Get context
    const ctx = getCaptureContext(octokit);
    if (!ctx) {
      core.info('Not a pull_request event, skipping');
      return;
    }

    const { owner, repo, prNumber } = ctx;
    core.info(`Processing PR #${prNumber} in ${owner}/${repo}`);

    // Setup paths
    const workDir = join(tmpdir(), 'codjiflo-action');
    if (!existsSync(workDir)) {
      mkdirSync(workDir, { recursive: true });
    }
    const dbPath = join(workDir, 'iterations.db');
    const artifactName = `codjiflo-pr-${prNumber}`;

    // Try to download existing artifact
    const artifactClient = artifact.default ?? artifact;
    let hasExistingArtifact = false;

    try {
      const downloadResult = await artifactClient.downloadArtifact(artifactName, {
        path: workDir,
      });
      hasExistingArtifact = downloadResult.downloadPath !== undefined;
      core.info(`Downloaded existing artifact: ${hasExistingArtifact}`);
    } catch {
      core.info('No existing artifact found, creating new database');
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

      // Write to file
      writeFileSync(dbPath, dbBuffer);

      // Upload artifact
      core.info('Uploading artifact...');
      await artifactClient.uploadArtifact(artifactName, [dbPath], workDir, {
        retentionDays: 90,
      });
      core.info('Artifact uploaded');

      // Update PR comment
      core.info('Updating PR comment...');
      await updatePRComment(octokit, owner, repo, prNumber, {
        iterationCount: iteration.revision,
        artifactName,
        runId: github.context.runId,
        timestamp: new Date().toISOString(),
      });
      core.info('PR comment updated');

      // Cleanup
      if (existsSync(dbPath)) {
        unlinkSync(dbPath);
      }

      core.info('Done!');
      core.setOutput('iteration-count', iteration.revision);
      core.setOutput('artifact-name', artifactName);
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
