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
