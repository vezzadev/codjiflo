import { create } from 'zustand';
import { githubBackends, GitHubAPIError } from '@/api';
import type { PRState } from '../types';

export const usePRStore = create<PRState>((set) => ({
  currentPR: null,
  isLoading: false,
  error: null,

  loadPR: async (owner, repo, number) => {
    set({ isLoading: true, error: null });
    try {
      const pr = await githubBackends.review.getReview(owner, repo, number);
      set({ currentPR: pr, isLoading: false });
    } catch (err) {
      let message = 'Failed to load pull request';
      let kind: import('../types').PRErrorKind = 'generic';

      if (err instanceof GitHubAPIError) {
        if (err.status === 404 && err.isPrivateRepo) {
          message = 'This PR may be private or doesn\'t exist.';
          kind = 'private-repo';
        } else if (err.status === 404) {
          message = 'Pull request not found.';
          kind = 'not-found';
        } else if (err.status === 403 && err.isPrivateRepo) {
          message = 'This PR may be private or doesn\'t exist.';
          kind = 'private-repo';
        } else if (err.status === 401) {
          message = err.message;
          kind = 'forbidden';
        } else if (err.status === 403) {
          message = 'You don\'t have permission to view this pull request.';
          kind = 'forbidden';
        } else {
          message = err.message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }

      set({ error: { message, kind }, isLoading: false, currentPR: null });
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({ currentPR: null, isLoading: false, error: null }),
}));
