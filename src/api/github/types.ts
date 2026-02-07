/**
 * GitHub API response types
 * These are GitHub-specific and get mapped to platform-agnostic types
 */

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
}

export interface GitHubBranch {
  ref: string;
  sha: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  merged: boolean;
  draft: boolean;
  user: GitHubUser;
  head: GitHubBranch;
  base: GitHubBranch;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export interface GitHubReviewComment {
  id: number;
  body: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  path: string;
  line: number | null;
  side: "LEFT" | "RIGHT";
  position: number | null;
  in_reply_to_id?: number;
  /** Line number when comment was created (for outdated comments) */
  original_line: number | null;
  /** Current HEAD commit SHA */
  commit_id: string;
  /** Commit SHA when comment was originally created */
  original_commit_id: string;
}

/**
 * GitHub Contents API response
 * Used for fetching file content at a specific ref
 */
export interface GitHubContentsResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  content?: string; // Base64 encoded for files
  encoding?: string;
  download_url: string | null;
}

// ============================================================================
// PR Commits API Types
// GET /repos/{owner}/{repo}/pulls/{pr_number}/commits
// ============================================================================

export interface GitHubCommitAuthor {
  name: string;
  email: string;
  date: string; // ISO 8601
}

export interface GitHubCommitDetail {
  message: string;
  author: GitHubCommitAuthor;
}

export interface GitHubPRCommit {
  sha: string;
  commit: GitHubCommitDetail;
  author: GitHubUser | null; // null if author not a GitHub user
}

// ============================================================================
// Issues Timeline API Types
// GET /repos/{owner}/{repo}/issues/{pr_number}/timeline
// ============================================================================

export interface GitHubTimelineCommitRef {
  sha: string;
}

export interface GitHubTimelineForcePushEvent {
  id: number;
  event: 'head_ref_force_pushed';
  created_at: string;
  before_commit: GitHubTimelineCommitRef;
  after_commit: GitHubTimelineCommitRef;
}

export interface GitHubTimelineOtherEvent {
  id: number;
  event: string;
  created_at: string;
}

export type GitHubTimelineEvent =
  | GitHubTimelineForcePushEvent
  | GitHubTimelineOtherEvent;

// ============================================================================
// Compare API Types
// GET /repos/{owner}/{repo}/compare/{basehead}
// ============================================================================

export interface GitHubCompareCommit {
  sha: string;
  commit: GitHubCommitDetail;
  author: GitHubUser | null;
}

export interface GitHubCompareResponse {
  commits: GitHubCompareCommit[];
  status: 'ahead' | 'behind' | 'diverged' | 'identical';
  ahead_by: number;
  behind_by: number;
}
