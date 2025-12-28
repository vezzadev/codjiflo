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
// Backend Interfaces
// ============================================================================

export interface IReviewBackend {
  getReview(owner: string, repo: string, number: number): Promise<Review>;
}

export interface IFileBackend {
  getFiles(owner: string, repo: string, number: number): Promise<FileChange[]>;
  getFileContent(owner: string, repo: string, path: string, ref: string): Promise<string>;
}

export interface BackendFactory {
  review: IReviewBackend;
  file: IFileBackend;
}
