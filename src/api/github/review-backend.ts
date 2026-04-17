import { githubClient } from './github-client';
import type { IReviewBackend, Review } from '../types';
import { ReviewState } from '../types';
import type { GitHubPullRequest } from './types';

/**
 * GitHub implementation of IReviewBackend
 * Transforms GitHub API responses to platform-agnostic Review type
 */
export class GitHubReviewBackend implements IReviewBackend {
  async getReview(owner: string, repo: string, number: number): Promise<Review> {
    const data = await githubClient.fetch<GitHubPullRequest>(
      `/repos/${owner}/${repo}/pulls/${number}`
    );

    return {
      id: data.id,
      number: data.number,
      title: data.title,
      description: data.body ?? '',
      state: this.mapState(data.state, data.merged, data.draft),
      author: {
        id: data.user.id.toString(),
        displayName: data.user.login,
        avatarUrl: data.user.avatar_url,
      },
      sourceBranch: data.head.ref,
      targetBranch: data.base.ref,
      baseSha: data.base.sha,
      headSha: data.head.sha,
      htmlUrl: data.html_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapState(state: string, merged: boolean, draft: boolean): ReviewState {
    if (draft) return ReviewState.Draft;
    if (merged) return ReviewState.Merged;
    return state === 'open' ? ReviewState.Open : ReviewState.Closed;
  }
}
