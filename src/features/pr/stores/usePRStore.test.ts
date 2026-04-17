import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { usePRStore } from './usePRStore';
import { ReviewState } from '@/api/types';
import * as api from '@/api';

// Store mock reference outside to avoid unbound-method warning
let mockGetReview: Mock;

// Mock the API
vi.mock('@/api', () => {
  const getReviewFn = vi.fn();
  return {
    githubBackends: {
      review: {
        getReview: getReviewFn,
      },
      file: {
        getFiles: vi.fn(),
      },
    },
    GitHubAPIError: class GitHubAPIError extends Error {
      isPrivateRepo?: boolean;
      constructor(public status: number, public statusText: string, message: string) {
        super(message);
        this.name = 'GitHubAPIError';
      }
    },
  };
});

describe('usePRStore', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    mockGetReview = api.githubBackends.review.getReview as Mock;
    usePRStore.setState({
      currentPR: null,
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loadPR', () => {
    it('loads PR successfully', async () => {
      const mockPR = {
        id: 1,
        number: 123,
        title: 'Test PR',
        description: 'Test description',
        state: ReviewState.Open,
        author: { id: '1', displayName: 'testuser', avatarUrl: 'https://example.com/avatar' },
        sourceBranch: 'feature',
        targetBranch: 'main',
        htmlUrl: 'https://github.com/owner/repo/pull/123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetReview.mockResolvedValue(mockPR);

      await usePRStore.getState().loadPR('owner', 'repo', 123);

      expect(usePRStore.getState().currentPR).toEqual(mockPR);
      expect(usePRStore.getState().isLoading).toBe(false);
      expect(usePRStore.getState().error).toBeNull();
    });

    it('sets isLoading to true while loading', async () => {
      mockGetReview.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const loadPromise = usePRStore.getState().loadPR('owner', 'repo', 123);

      expect(usePRStore.getState().isLoading).toBe(true);

      await loadPromise;
    });

    it('handles 404 error without isPrivateRepo as not-found', async () => {
      mockGetReview.mockRejectedValue(
        new api.GitHubAPIError(404, 'Not Found', 'Not Found')
      );

      await usePRStore.getState().loadPR('owner', 'repo', 999);

      expect(usePRStore.getState().error).toEqual({
        message: 'Pull request not found.',
        kind: 'not-found',
      });
      expect(usePRStore.getState().currentPR).toBeNull();
      expect(usePRStore.getState().isLoading).toBe(false);
    });

    it('handles 404 error with isPrivateRepo as private-repo', async () => {
      const err = new api.GitHubAPIError(404, 'Not Found', 'Not Found');
      err.isPrivateRepo = true;
      mockGetReview.mockRejectedValue(err);

      await usePRStore.getState().loadPR('owner', 'repo', 999);

      expect(usePRStore.getState().error).toEqual({
        message: "This PR may be private or doesn't exist.",
        kind: 'private-repo',
      });
    });

    it('handles 401 error as forbidden', async () => {
      mockGetReview.mockRejectedValue(
        new api.GitHubAPIError(401, 'Unauthorized', 'Session expired. Please log in again.')
      );

      await usePRStore.getState().loadPR('owner', 'repo', 123);

      expect(usePRStore.getState().error).toEqual({
        message: 'Session expired. Please log in again.',
        kind: 'forbidden',
      });
    });

    it('handles 403 error without isPrivateRepo as forbidden', async () => {
      mockGetReview.mockRejectedValue(
        new api.GitHubAPIError(403, 'Forbidden', 'Forbidden')
      );

      await usePRStore.getState().loadPR('owner', 'repo', 123);

      expect(usePRStore.getState().error).toEqual({
        message: "You don't have permission to view this pull request.",
        kind: 'forbidden',
      });
    });

    it('handles 403 error with isPrivateRepo as private-repo', async () => {
      const err = new api.GitHubAPIError(403, 'Forbidden', 'Forbidden');
      err.isPrivateRepo = true;
      mockGetReview.mockRejectedValue(err);

      await usePRStore.getState().loadPR('owner', 'repo', 123);

      expect(usePRStore.getState().error).toEqual({
        message: "This PR may be private or doesn't exist.",
        kind: 'private-repo',
      });
    });

    it('handles other GitHubAPIError status codes as generic', async () => {
      mockGetReview.mockRejectedValue(
        new api.GitHubAPIError(500, 'Internal Server Error', 'Server error occurred')
      );

      await usePRStore.getState().loadPR('owner', 'repo', 123);

      expect(usePRStore.getState().error).toEqual({
        message: 'Server error occurred',
        kind: 'generic',
      });
      expect(usePRStore.getState().currentPR).toBeNull();
      expect(usePRStore.getState().isLoading).toBe(false);
    });

    it('handles regular Error instances as generic', async () => {
      mockGetReview.mockRejectedValue(new Error('Network failure'));

      await usePRStore.getState().loadPR('owner', 'repo', 123);

      expect(usePRStore.getState().error).toEqual({
        message: 'Network failure',
        kind: 'generic',
      });
      expect(usePRStore.getState().currentPR).toBeNull();
      expect(usePRStore.getState().isLoading).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets store to initial state', () => {
      // Set some state
      usePRStore.setState({
        currentPR: { id: 1 } as never,
        isLoading: true,
        error: { message: 'Some error', kind: 'generic' as const },
      });

      usePRStore.getState().reset();

      expect(usePRStore.getState().currentPR).toBeNull();
      expect(usePRStore.getState().isLoading).toBe(false);
      expect(usePRStore.getState().error).toBeNull();
    });
  });

  describe('clearError', () => {
    it('clears the error', () => {
      usePRStore.setState({ error: { message: 'Some error', kind: 'generic' as const } });

      usePRStore.getState().clearError();

      expect(usePRStore.getState().error).toBeNull();
    });
  });
});
