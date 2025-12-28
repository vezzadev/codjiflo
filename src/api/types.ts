/**
 * Platform-agnostic API interfaces
 * These abstractions enable future Azure DevOps/GitLab support
 */

// ============================================================================
// Review (Pull Request) Domain Types
// ============================================================================

export interface Review {
  id: number;
  number: number;
  title: string;
  description: string;
  state: ReviewState;
  author: Author;
  sourceBranch: string;
  targetBranch: string;
  /** SHA of the base (target) commit */
  baseSha: string;
  /** SHA of the head (source) commit */
  headSha: string;
  htmlUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum ReviewState {
  Open = 'open',
  Closed = 'closed',
  Merged = 'merged',
  Draft = 'draft',
}

export interface Author {
  id: string;
  displayName: string;
  avatarUrl: string;
}

// ============================================================================
// File Change Domain Types
// ============================================================================

export interface FileChange {
  filename: string;
  status: FileChangeStatus;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
  previousFilename?: string;
}

export enum FileChangeStatus {
  Added = 'added',
  Modified = 'modified',
  Deleted = 'removed',
  Renamed = 'renamed',
}

// ============================================================================
// File Content Types (S-3.1, M4-ready)
// ============================================================================

/**
 * Raw file content fetched from the repository
 */
export interface RawFileContent {
  path: string;
  sha: string;
  content: string; // Decoded content
  size: number;
  encoding: 'utf-8' | 'base64' | 'none';
}

// ============================================================================
// Backend Interfaces
// ============================================================================

export interface IReviewBackend {
  getReview(owner: string, repo: string, number: number): Promise<Review>;
}

export interface IFileBackend {
  getFiles(owner: string, repo: string, number: number): Promise<FileChange[]>;
  /**
   * Fetch raw file content at a specific ref (S-3.1)
   * @param owner Repository owner
   * @param repo Repository name
   * @param path File path within repository
   * @param ref Git ref (SHA, branch, or tag)
   * @throws GitHubAPIError if file not found or too large
   */
  getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref: string
  ): Promise<RawFileContent>;
}

export interface BackendFactory {
  review: IReviewBackend;
  file: IFileBackend;
}
