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

      if (err instanceof GitHubAPIError) {
        if (err.status === 404) {
          message = 'Pull request not found. Please check the URL.';
        } else if (err.status === 401 || err.status === 403) {
          message = 'Access denied. Please check your token permissions.';
        } else {
          message = err.message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }

      set({ error: message, isLoading: false, currentPR: null });
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({ currentPR: null, isLoading: false, error: null }),
}));
