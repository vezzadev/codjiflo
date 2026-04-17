import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubReviewBackend } from './review-backend';
import { githubClient } from './github-client';
import { ReviewState } from '../types';

vi.mock('./github-client', () => ({
  githubClient: {
    fetch: vi.fn(),
  },
}));

describe('GitHubReviewBackend', () => {
  let backend: GitHubReviewBackend;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const mockFetch = vi.mocked(githubClient.fetch);

  beforeEach(() => {
    backend = new GitHubReviewBackend();
    vi.clearAllMocks();
  });

  describe('getReview', () => {
    it('fetches and transforms PR data correctly', async () => {
      const mockPR = {
        id: 123,
        number: 42,
        title: 'Test PR',
        body: 'PR description',
        state: 'open',
        merged: false,
        draft: false,
        user: {
          id: 1,
          login: 'testuser',
          avatar_url: 'https://example.com/avatar.png',
        },
        head: { ref: 'feature-branch', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' },
        html_url: 'https://github.com/owner/repo/pull/42',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockFetch.mockResolvedValue(mockPR);

      const result = await backend.getReview('owner', 'repo', 42);

      expect(mockFetch).toHaveBeenCalledWith('/repos/owner/repo/pulls/42');
      expect(result).toEqual({
        id: 123,
        number: 42,
        title: 'Test PR',
        description: 'PR description',
        state: ReviewState.Open,
        author: {
          id: '1',
          displayName: 'testuser',
          avatarUrl: 'https://example.com/avatar.png',
        },
        sourceBranch: 'feature-branch',
        targetBranch: 'main',
        baseSha: 'def456',
        headSha: 'abc123',
        htmlUrl: 'https://github.com/owner/repo/pull/42',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      });
    });

    it('maps closed state correctly', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        title: 'Closed PR',
        body: '',
        state: 'closed',
        merged: false,
        draft: false,
        user: { id: 1, login: 'user', avatar_url: '' },
        head: { ref: 'feature', sha: 'head123' },
        base: { ref: 'main', sha: 'base123' },
        html_url: '',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValue(mockPR);

      const result = await backend.getReview('owner', 'repo', 1);
      expect(result.state).toBe(ReviewState.Closed);
    });

    it('maps merged state correctly', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        title: 'Merged PR',
        body: '',
        state: 'closed',
        merged: true,
        draft: false,
        user: { id: 1, login: 'user', avatar_url: '' },
        head: { ref: 'feature', sha: 'head123' },
        base: { ref: 'main', sha: 'base123' },
        html_url: '',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValue(mockPR);

      const result = await backend.getReview('owner', 'repo', 1);
      expect(result.state).toBe(ReviewState.Merged);
    });

    it('maps draft state correctly', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        title: 'Draft PR',
        body: '',
        state: 'open',
        merged: false,
        draft: true,
        user: { id: 1, login: 'user', avatar_url: '' },
        head: { ref: 'feature', sha: 'head123' },
        base: { ref: 'main', sha: 'base123' },
        html_url: '',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValue(mockPR);

      const result = await backend.getReview('owner', 'repo', 1);
      expect(result.state).toBe(ReviewState.Draft);
    });
  });
});
