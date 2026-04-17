// Platform-agnostic types
export type {
  Review,
  Author,
  FileChange,
  BackendFactory,
  IReviewBackend,
  IFileBackend,
} from './types';

export { ReviewState, FileChangeStatus } from './types';

// GitHub implementation
export { githubBackends, GitHubAPIError, createGitHubBackendFactory } from './github';
