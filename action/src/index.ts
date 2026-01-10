/**
 * CodjiFlo GitHub Action Entry Point
 *
 * Captures PR iterations for force-push resilient code review.
 *
 * Workflow:
 * 1. Download previous artifact from GitHub API (if exists)
 * 2. Open/create SQLite database
 * 3. Capture iteration data (files, content)
 * 4. Compute SpanTrackers
 * 5. Output paths for artifact upload (handled by action.yml)
 * 6. Update PR comment
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import AdmZip from 'adm-zip';

import { IterationDatabase } from './db/database';
import { captureIteration, getCaptureContext } from './capture/iteration-capture';
import { computeSpanTrackers, prepareSpanTrackerInputs } from './spantracker/tracker';
import { updatePRComment, getArtifactNameFromComment, updatePRDescription } from './comment/comment-manager';
import { downloadArtifactWithFallback } from './artifact/artifact-download';

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
    const ctx = await getCaptureContext(octokit);
    if (!ctx) {
      core.info('Not a pull_request event and no PR_NUMBER provided, skipping');
      return;
    }

    const { owner, repo, prNumber } = ctx;
    core.info(`Processing PR #${prNumber} in ${owner}/${repo}`);

    // Setup paths - use workspace for artifact upload
    const workDir = process.env.GITHUB_WORKSPACE
      ? join(process.env.GITHUB_WORKSPACE, 'codjiflo-data')
      : join(process.cwd(), 'codjiflo-data');
    if (!existsSync(workDir)) {
      mkdirSync(workDir, { recursive: true });
    }
    const dbPath = join(workDir, 'iterations.db');
    const currentRunId = github.context.runId;

    // New artifact name includes run ID for uniqueness
    const artifactName = `codjiflo-pr-${prNumber}-run-${currentRunId}`;

    // Get artifact name from PR comment (if exists)
    core.info('Checking for previous artifact...');
    const previousArtifactName = await getArtifactNameFromComment(octokit, owner, repo, prNumber);
    if (previousArtifactName) {
      core.info(`PR comment references artifact: ${previousArtifactName}`);
    }

    // Download previous artifact with fallback logic
    const previousArtifact = await downloadArtifactWithFallback(
      octokit,
      owner,
      repo,
      prNumber,
      previousArtifactName
    );

    if (previousArtifact) {
      const usedFallback = previousArtifactName && previousArtifact.artifactInfo.name !== previousArtifactName;
      if (usedFallback) {
        core.info(`Referenced artifact not found, using fallback: ${previousArtifact.artifactInfo.name}`);
      } else {
        core.info(`Found previous artifact: ${previousArtifact.artifactInfo.name}`);
      }
      // Extract the database from the ZIP
      const zip = new AdmZip(Buffer.from(previousArtifact.data));
      const dbEntry = zip.getEntry('iterations.db');
      if (dbEntry) {
        const dbData = dbEntry.getData();
        writeFileSync(dbPath, dbData);
        core.info('Extracted previous database');
      } else {
        core.warning('Previous artifact did not contain iterations.db');
      }
    } else {
      core.info('No previous artifact found, creating new database');
    }

    // Check if we have an existing database
    const hasExistingDb = existsSync(dbPath);
    if (hasExistingDb) {
      core.info('Using existing database');
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

      // Update PR description with CodjiFlo link
      core.info('Updating PR description with CodjiFlo link...');
      await updatePRDescription(octokit, owner, repo, prNumber);
      core.info('PR description updated');

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
