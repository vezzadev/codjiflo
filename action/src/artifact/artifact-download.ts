/**
 * Artifact Download from Previous Runs
 *
 * Uses GitHub API to download artifacts from previous workflow runs.
 * This is necessary because actions/download-artifact@v4 only downloads
 * artifacts from the current workflow run.
 */

import * as github from '@actions/github';

// ============================================================================
// Types
// ============================================================================

export interface ArtifactInfo {
  id: number;
  name: string;
  created_at: string;
  workflow_run_id: number;
}

export interface DownloadResult {
  data: ArrayBuffer;
  artifactInfo: ArtifactInfo;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Find the latest non-expired artifact matching the given name.
 * Optionally excludes artifacts from the current run.
 */
export async function findLatestArtifact(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  artifactName: string,
  excludeRunId?: number
): Promise<ArtifactInfo | null> {
  const { data } = await octokit.rest.actions.listArtifactsForRepo({
    owner,
    repo,
    name: artifactName,
    per_page: 10,
  });

  // Find the first matching, non-expired artifact (list is sorted by created_at desc)
  for (const artifact of data.artifacts) {
    // Skip expired artifacts
    if (artifact.expired) {
      continue;
    }

    // Skip artifacts from the current run
    if (excludeRunId && artifact.workflow_run?.id === excludeRunId) {
      continue;
    }

    // Match by name (the API filter may not be exact)
    if (artifact.name === artifactName) {
      return {
        id: artifact.id,
        name: artifact.name,
        created_at: artifact.created_at ?? '',
        workflow_run_id: artifact.workflow_run?.id ?? 0,
      };
    }
  }

  return null;
}

/**
 * Download an artifact by ID.
 * Returns the raw ZIP data as ArrayBuffer.
 */
export async function downloadArtifact(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  artifactInfo: ArtifactInfo
): Promise<ArrayBuffer> {
  const { data } = await octokit.rest.actions.downloadArtifact({
    owner,
    repo,
    artifact_id: artifactInfo.id,
    archive_format: 'zip',
  });

  return data as ArrayBuffer;
}

/**
 * Download the most recent artifact from previous runs.
 * Returns null if no previous artifact exists.
 */
export async function downloadPreviousArtifact(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  artifactName: string,
  currentRunId: number
): Promise<DownloadResult | null> {
  const artifactInfo = await findLatestArtifact(
    octokit,
    owner,
    repo,
    artifactName,
    currentRunId
  );

  if (!artifactInfo) {
    return null;
  }

  const data = await downloadArtifact(octokit, owner, repo, artifactInfo);

  return {
    data,
    artifactInfo,
  };
}

/**
 * Find the newest artifact matching a PR pattern.
 * Used as fallback when the specific artifact from comment is not found.
 */
export async function findNewestArtifactForPR(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number
): Promise<ArtifactInfo | null> {
  // List all artifacts and filter by PR pattern
  const { data } = await octokit.rest.actions.listArtifactsForRepo({
    owner,
    repo,
    per_page: 100,
  });

  const prPattern = new RegExp(`^codjiflo-pr-${prNumber}(-run-\\d+)?$`);

  // Find the first matching, non-expired artifact
  for (const artifact of data.artifacts) {
    if (artifact.expired) {
      continue;
    }

    if (prPattern.test(artifact.name)) {
      return {
        id: artifact.id,
        name: artifact.name,
        created_at: artifact.created_at ?? '',
        workflow_run_id: artifact.workflow_run?.id ?? 0,
      };
    }
  }

  return null;
}

/**
 * Download artifact with fallback logic:
 * 1. Try to download specific artifact by name (from PR comment)
 * 2. If not found/expired, fall back to newest artifact for the PR
 *
 * Returns null if no artifact exists at all.
 */
export async function downloadArtifactWithFallback(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
  specificArtifactName: string | null
): Promise<DownloadResult | null> {
  // Strategy 1: Try specific artifact from PR comment
  if (specificArtifactName) {
    const specificArtifact = await findLatestArtifact(
      octokit,
      owner,
      repo,
      specificArtifactName
    );

    if (specificArtifact) {
      try {
        const data = await downloadArtifact(octokit, owner, repo, specificArtifact);
        return { data, artifactInfo: specificArtifact };
      } catch {
        // Artifact may have been deleted or expired since we found it
        // Fall through to strategy 2
      }
    }
  }

  // Strategy 2: Find newest artifact for this PR (fallback)
  const newestArtifact = await findNewestArtifactForPR(octokit, owner, repo, prNumber);

  if (newestArtifact) {
    try {
      const data = await downloadArtifact(octokit, owner, repo, newestArtifact);
      return { data, artifactInfo: newestArtifact };
    } catch {
      // All artifacts are gone
      return null;
    }
  }

  return null;
}
