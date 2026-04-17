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
 * Download artifact directly by ID.
 * Returns null if artifact not found or expired.
 */
export async function downloadArtifactById(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  artifactId: number
): Promise<DownloadResult | null> {
  try {
    // Get artifact info first
    const { data: artifact } = await octokit.rest.actions.getArtifact({
      owner,
      repo,
      artifact_id: artifactId,
    });

    if (artifact.expired) {
      return null;
    }

    const artifactInfo: ArtifactInfo = {
      id: artifact.id,
      name: artifact.name,
      created_at: artifact.created_at ?? '',
      workflow_run_id: artifact.workflow_run?.id ?? 0,
    };

    const data = await downloadArtifact(octokit, owner, repo, artifactInfo);
    return { data, artifactInfo };
  } catch {
    // Artifact not found or expired
    return null;
  }
}

/**
 * Find the newest codjiflo artifact for a specific PR.
 * Used as fallback when the specific artifact ID is not valid.
 */
export async function findNewestCodjifloArtifactForPR(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number
): Promise<ArtifactInfo | null> {
  // List all artifacts matching codjiflo pattern for this PR
  const { data } = await octokit.rest.actions.listArtifactsForRepo({
    owner,
    repo,
    per_page: 100,
  });

  // Pattern: codjiflo-pr-{prNumber}-{runId}
  const prPattern = new RegExp(`^codjiflo-pr-${prNumber}-\\d+$`);

  // Find the first matching, non-expired artifact (list is sorted by created_at desc)
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
 * 1. Try to download specific artifact by ID (from PR comment)
 * 2. If not found/expired, fall back to newest artifact for this PR
 *
 * Returns null if no artifact exists at all.
 */
export async function downloadArtifactWithFallback(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
  specificArtifactId: number | null
): Promise<DownloadResult | null> {
  // Strategy 1: Try specific artifact by ID from PR comment
  if (specificArtifactId) {
    const result = await downloadArtifactById(octokit, owner, repo, specificArtifactId);
    if (result) {
      return result;
    }
  }

  // Strategy 2: Find newest artifact for this PR (fallback)
  const newestArtifact = await findNewestCodjifloArtifactForPR(octokit, owner, repo, prNumber);

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
