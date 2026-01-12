import { create } from 'zustand';
import posthog from 'posthog-js';
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

      // PostHog: Track successful PR load
      posthog.capture('pr_loaded', {
        owner,
        repo,
        pr_number: number,
        pr_title: pr.title,
        pr_state: pr.state,
      });
    } catch (err) {
      let message = 'Failed to load pull request';
      let errorType = 'unknown';

      if (err instanceof GitHubAPIError) {
        if (err.status === 404) {
          message = 'Pull request not found. Please check the URL.';
          errorType = 'not_found';
        } else if (err.status === 401 || err.status === 403) {
          message = 'Access denied. Please check your token permissions.';
          errorType = 'access_denied';
        } else {
          message = err.message;
          errorType = 'api_error';
        }
      } else if (err instanceof Error) {
        message = err.message;
        errorType = 'exception';
      }

      // PostHog: Track failed PR load
      posthog.capture('pr_load_failed', {
        owner,
        repo,
        pr_number: number,
        error_type: errorType,
        error_message: message,
      });

      set({ error: message, isLoading: false, currentPR: null });
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({ currentPR: null, isLoading: false, error: null }),
}));
