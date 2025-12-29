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
