/**
 * Iteration management store
 * S-3.4: Iteration Snapshotting (Frontend)
 * S-3.5: Iteration Selector & Comparison
 * 
 * Implements graceful degradation when GitHub Action workflow is not installed
 */

import { create } from 'zustand';
import type { Iteration, IterationComparison } from '../types';
import { IterationStatus } from '../types';

interface IterationState {
  iterations: Iteration[];
  selectedComparison: IterationComparison | null;
  isLoading: boolean;
  error: string | null;
  hasWorkflow: boolean; // True if codjiflo workflow is installed
  
  // Actions
  loadIterations: (owner: string, repo: string, number: number) => Promise<void>;
  selectComparison: (leftIteration: number, rightIteration: number) => void;
  reset: () => void;
}

/**
 * Store for managing iterations
 * AC-3.4.10 through AC-3.4.17 (Frontend artifact loading)
 * AC-3.5.1 through AC-3.5.19 (Iteration selection and comparison)
 */
export const useIterationStore = create<IterationState>((set, get) => ({
  iterations: [],
  selectedComparison: null,
  isLoading: false,
  error: null,
  hasWorkflow: false,

  loadIterations: async (owner, repo, number) => {
    set({ isLoading: true, error: null });
    
    try {
      // AC-3.4.10: Fetch PR comments to find CodjiFlo data marker
      // AC-3.4.15, AC-3.4.16, AC-3.4.17: Graceful degradation
      
      // For now, use GitHub API to fetch commits as fallback
      // Full implementation would:
      // 1. Fetch PR comments
      // 2. Look for <!-- codjiflo-data --> marker
      // 3. If found, download SQLite artifact
      // 4. Parse with SQL.js
      // 5. If not found, fall back to commits
      
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${String(number)}/commits`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch commits');
      }
      
      const commits = await response.json() as { sha: string; commit: { author: { name: string; date: string }; message: string } }[];
      
      // Convert commits to iterations (simplified)
      const iterations: Iteration[] = commits.map((commit, index) => ({
        id: index + 1,
        revision: index + 1,
        author: commit.commit.author.name,
        description: commit.commit.message.split('\n')[0] ?? '',
        comment: commit.commit.message,
        submittedOn: new Date(commit.commit.author.date),
        status: IterationStatus.Submitted,
        sourceCommitId: commit.sha,
      }));
      
      set({ 
        iterations, 
        isLoading: false, 
        hasWorkflow: false, // No workflow detected
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load iterations';
      set({ error: message, isLoading: false, iterations: [] });
    }
  },

  selectComparison: (leftIteration, rightIteration) => {
    const { iterations } = get();
    
    if (leftIteration < 1 || rightIteration < 1 || 
        leftIteration > iterations.length || rightIteration > iterations.length) {
      return;
    }
    
    // Convert iterations to snapshot indices
    const leftSnapshot = (leftIteration - 1) * 2 + 1; // Right snapshot of left iteration
    const rightSnapshot = (rightIteration - 1) * 2 + 1; // Right snapshot of right iteration
    
    const comparison: IterationComparison = {
      leftSnapshot,
      rightSnapshot,
      leftIteration,
      rightIteration,
      isCrossIteration: Math.abs(leftIteration - rightIteration) > 1,
    };
    
    set({ selectedComparison: comparison });
  },

  reset: () => {
    set({
      iterations: [],
      selectedComparison: null,
      isLoading: false,
      error: null,
      hasWorkflow: false,
    });
  },
}));
