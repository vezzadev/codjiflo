import { GitHubReviewBackend } from './review-backend';
import { GitHubFileBackend } from './file-backend';
import type { BackendFactory } from '../types';

export { GitHubAPIError } from './github-client';

/**
 * Creates GitHub backend factory
 * Future: Add createAzureDevOpsBackendFactory, createGitLabBackendFactory
 */
export function createGitHubBackendFactory(): BackendFactory {
  return {
    review: new GitHubReviewBackend(),
    file: new GitHubFileBackend(),
  };
}

// Default singleton for GitHub
export const githubBackends = createGitHubBackendFactory();
