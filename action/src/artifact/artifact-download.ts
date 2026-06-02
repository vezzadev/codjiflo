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
 * Maximum pages to scan when searching for a PR's newest codjiflo artifact.
 * With per_page: 100, this covers up to 1000 most recent artifacts.
 * GitHub retention is 90 days, so this is more than sufficient for active PRs
 * while bounding the API cost on extremely busy repos.
 */
const FIND_ARTIFACT_MAX_PAGES = 10;

/**
 * Shape of a single artifact as returned by the GitHub REST API.
 * Defined locally to avoid importing the full Octokit types surface.
 */
interface RepoArtifact {
  id: number;
  name: string;
  created_at?: string | null;
  expired?: boolean;
  workflow_run?: { id?: number } | null;
}

/**
 * Find the newest codjiflo artifact for a specific PR.
 * Used as fallback when the specific artifact ID is not valid.
 *
 * Paginates through results because on busy repos the newest page(s) may be
 * dominated by unrelated CI artifacts, pushing the target PR artifact to later
 * pages. Without pagination we would silently return null and iteration
 * continuity would reset (see issue #485).
 */
export async function findNewestCodjifloArtifactForPR(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number
): Promise<ArtifactInfo | null> {
  // Pattern: codjiflo-pr-{prNumber}-{runId}
  const prPattern = new RegExp(`^codjiflo-pr-${prNumber}-\\d+$`);

  const iterator = octokit.paginate.iterator(
    octokit.rest.actions.listArtifactsForRepo,
    {
      owner,
      repo,
      per_page: 100,
    }
  );

  let pagesScanned = 0;
  for await (const response of iterator) {
    pagesScanned += 1;
    const artifacts = (response.data ?? []) as RepoArtifact[];

    // Artifacts are sorted by created_at desc within each page, so the first
    // non-expired match is the newest.
    for (const artifact of artifacts) {
      if (artifact.expired) {
        continue;
      }
      if (!prPattern.test(artifact.name)) {
        continue;
      }
      return {
        id: artifact.id,
        name: artifact.name,
        created_at: artifact.created_at ?? '',
        workflow_run_id: artifact.workflow_run?.id ?? 0,
      };
    }

    if (pagesScanned >= FIND_ARTIFACT_MAX_PAGES) {
      break;
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
