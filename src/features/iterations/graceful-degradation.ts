/**
 * Graceful Degradation (S-4.10)
 *
 * Fallback to GitHub commits API when CodjiFlo artifact is unavailable.
 * Provides parity with GitHub native experience for repos without the workflow.
 */

import { githubClient } from '@/api/github/github-client';
import type { Iteration, ReviewFileArtifact, FileContent, FileChangeType } from './types';

// ============================================================================
// GitHub API Types
// ============================================================================

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  author?: {
    login: string;
  };
}

interface GitHubCompareFile {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  previous_filename?: string;
  patch?: string;
  contents_url: string;
}

interface GitHubCompareResponse {
  base_commit: {
    sha: string;
  };
  merge_base_commit: {
    sha: string;
  };
  files?: GitHubCompareFile[];
}

// ============================================================================
// Commit Fallback Client
// ============================================================================

/**
 * Provides iteration-like interface using GitHub commits API.
 * Used when CodjiFlo workflow is not installed on a repository.
 */
export class CommitFallbackClient {
  private owner: string;
  private repo: string;
  private prNumber: number;

  constructor(owner: string, repo: string, prNumber: number) {
    this.owner = owner;
    this.repo = repo;
    this.prNumber = prNumber;
  }

  /**
   * Fetch commits for the PR and convert to Iteration format.
   * Each commit becomes an "iteration" for compatibility.
   */
  async getIterations(): Promise<Iteration[]> {
    const commits = await this.fetchCommits();

    return commits.map((commit, index) => ({
      id: index + 1,
      revision: index + 1,
      headSha: commit.sha,
      baseSha: commits[0]?.sha ?? commit.sha, // Use first commit as base
      beforeSha: index > 0 ? commits[index - 1]?.sha ?? null : null,
      author: commit.author?.login ?? commit.commit.author.name,
      createdAt: new Date(commit.commit.author.date),
    }));
  }

  /**
   * Get file artifacts from a comparison between two commits.
   */
  async getArtifactsForRange(
    baseSha: string,
    headSha: string
  ): Promise<ReviewFileArtifact[]> {
    const comparison = await this.fetchComparison(baseSha, headSha);

    if (!comparison.files) {
      return [];
    }

    return comparison.files.map((file, index) => ({
      id: index + 1,
      changeTrackingId: file.sha,
      repoPaths: [
        file.previous_filename ?? (file.status === 'added' ? null : file.filename),
        file.status === 'removed' ? null : file.filename,
      ],
      firstSnapshotIndex: 0,
      lastSnapshotIndex: 1,
    }));
  }

  /**
   * Get file content at a specific commit.
   * Uses GitHub Contents API.
   */
  async getFileContent(path: string, ref: string): Promise<FileContent | null> {
    try {
      interface GitHubContent {
        content?: string;
        encoding?: string;
        sha: string;
        size: number;
      }

      const response = await githubClient.fetch<GitHubContent>(
        `/repos/${this.owner}/${this.repo}/contents/${encodeURIComponent(path)}?ref=${ref}`
      );

      if (!response.content) {
        return null;
      }

      const content = atob(response.content.replace(/\n/g, ''));

      return {
        artifactId: 0, // Not applicable for GitHub API
        snapshotIndex: 0,
        content,
        contentHash: response.sha,
        sizeBytes: response.size,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get change type for a file in a comparison.
   */
  static parseChangeType(status: GitHubCompareFile['status']): FileChangeType {
    switch (status) {
      case 'added':
        return 'added' as FileChangeType;
      case 'removed':
        return 'deleted' as FileChangeType;
      case 'renamed':
        return 'renamed' as FileChangeType;
      case 'modified':
      case 'changed':
        return 'modified' as FileChangeType;
      case 'unchanged':
      case 'copied':
        return 'unchanged' as FileChangeType;
      default:
        return 'modified' as FileChangeType;
    }
  }

  /**
   * Fetch PR commits from GitHub API.
   */
  private async fetchCommits(): Promise<GitHubCommit[]> {
    return githubClient.fetch<GitHubCommit[]>(
      `/repos/${this.owner}/${this.repo}/pulls/${String(this.prNumber)}/commits`
    );
  }

  /**
   * Fetch comparison between two commits.
   */
  private async fetchComparison(
    baseSha: string,
    headSha: string
  ): Promise<GitHubCompareResponse> {
    return githubClient.fetch<GitHubCompareResponse>(
      `/repos/${this.owner}/${this.repo}/compare/${baseSha}...${headSha}`
    );
  }
}

// ============================================================================
// Detection Logic
// ============================================================================

/**
 * Check if graceful degradation is needed.
 * Called when no CodjiFlo artifact comment is found.
 */
export function shouldUseFallback(artifactFound: boolean): boolean {
  return !artifactFound;
}

/**
 * Degradation mode capabilities.
 */
export interface DegradedModeCapabilities {
  /** Can compare any two commits */
  commitRangeComparison: boolean;
  /** Has force-push resilience */
  forcePushResilience: boolean;
  /** Character-level comment anchors */
  characterLevelAnchors: boolean;
  /** Precomputed SpanTrackers available */
  spanTrackerAvailable: boolean;
  /** Cross-iteration comment tracking */
  commentTracking: boolean;
}

/**
 * Get capabilities for degraded mode.
 */
export function getDegradedModeCapabilities(): DegradedModeCapabilities {
  return {
    commitRangeComparison: true, // Yes, via GitHub compare API
    forcePushResilience: false, // No, commits become unreachable
    characterLevelAnchors: false, // No, GitHub only supports line-level
    spanTrackerAvailable: false, // No, not computed
    commentTracking: false, // No, comments may not track correctly
  };
}

/**
 * Get full capabilities when CodjiFlo artifact is available.
 */
export function getFullModeCapabilities(): DegradedModeCapabilities {
  return {
    commitRangeComparison: true,
    forcePushResilience: true,
    characterLevelAnchors: true,
    spanTrackerAvailable: true,
    commentTracking: true,
  };
}
