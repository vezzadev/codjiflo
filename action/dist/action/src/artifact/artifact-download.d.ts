/**
 * Artifact Download from Previous Runs
 *
 * Uses GitHub API to download artifacts from previous workflow runs.
 * This is necessary because actions/download-artifact@v4 only downloads
 * artifacts from the current workflow run.
 */
import * as github from '@actions/github';
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
/**
 * Find the latest non-expired artifact matching the given name.
 * Optionally excludes artifacts from the current run.
 */
export declare function findLatestArtifact(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, artifactName: string, excludeRunId?: number): Promise<ArtifactInfo | null>;
/**
 * Download an artifact by ID.
 * Returns the raw ZIP data as ArrayBuffer.
 */
export declare function downloadArtifact(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, artifactInfo: ArtifactInfo): Promise<ArrayBuffer>;
/**
 * Download the most recent artifact from previous runs.
 * Returns null if no previous artifact exists.
 */
export declare function downloadPreviousArtifact(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, artifactName: string, currentRunId: number): Promise<DownloadResult | null>;
/**
 * Download artifact directly by ID.
 * Returns null if artifact not found or expired.
 */
export declare function downloadArtifactById(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, artifactId: number): Promise<DownloadResult | null>;
/**
 * Find the newest codjiflo artifact for a specific PR.
 * Used as fallback when the specific artifact ID is not valid.
 */
export declare function findNewestCodjifloArtifactForPR(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, prNumber: number): Promise<ArtifactInfo | null>;
/**
 * Download artifact with fallback logic:
 * 1. Try to download specific artifact by ID (from PR comment)
 * 2. If not found/expired, fall back to newest artifact for this PR
 *
 * Returns null if no artifact exists at all.
 */
export declare function downloadArtifactWithFallback(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, prNumber: number, specificArtifactId: number | null): Promise<DownloadResult | null>;
//# sourceMappingURL=artifact-download.d.ts.map