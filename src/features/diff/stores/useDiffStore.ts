import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { githubBackends, GitHubAPIError } from '@/api';
import type { DiffState } from '../types';
import { DiffViewMode, DiffContentFilter, DiffDisplayMode } from '../types';

/** Index -1 represents the PR description "file" */
export const PR_DESCRIPTION_INDEX = -1;

/**
 * Store for managing diff state
 * Implements S-1.3: File navigation and selection
 * Implements S-3.3: View mode toggles with persistence
 */
export const useDiffStore = create<DiffState>()(
  persist(
    (set, get) => ({
      files: [],
      selectedFileIndex: PR_DESCRIPTION_INDEX,
      isLoading: false,
      error: null,
      viewMode: DiffViewMode.Inline,
      contentFilter: DiffContentFilter.Both,
      displayMode: DiffDisplayMode.ChangesOnly,

      loadFiles: async (owner, repo, number) => {
        set({ isLoading: true, error: null });
        try {
          const files = await githubBackends.file.getFiles(owner, repo, number);
          set({ files, isLoading: false, selectedFileIndex: PR_DESCRIPTION_INDEX });
        } catch (err) {
          let message = 'Failed to load files';

          if (err instanceof GitHubAPIError) {
            if (err.status === 404) {
              message = 'Pull request not found';
            } else if (err.status === 401 || err.status === 403) {
              message = 'Access denied';
            } else {
              message = err.message;
            }
          } else if (err instanceof Error) {
            message = err.message;
          }

          set({ error: message, isLoading: false, files: [] });
        }
      },

      selectFile: (index) => {
        const { files } = get();
        // Allow -1 for PR description, or valid file indices
        if (index === PR_DESCRIPTION_INDEX || (index >= 0 && index < files.length)) {
          set({ selectedFileIndex: index });
        }
      },

      selectNextFile: () => {
        const { selectedFileIndex, files } = get();
        // From description (-1) go to first file (0), then continue through files
        if (selectedFileIndex < files.length - 1) {
          set({ selectedFileIndex: selectedFileIndex + 1 });
        }
      },

      selectPreviousFile: () => {
        const { selectedFileIndex } = get();
        // Allow going back to description (-1)
        if (selectedFileIndex > PR_DESCRIPTION_INDEX) {
          set({ selectedFileIndex: selectedFileIndex - 1 });
        }
      },

      setViewMode: (mode: DiffViewMode) => {
        set({ viewMode: mode });
      },

      setContentFilter: (filter: DiffContentFilter) => {
        set({ contentFilter: filter });
      },

      setDisplayMode: (mode: DiffDisplayMode) => {
        set({ displayMode: mode });
      },

      reset: () => 
        set({ 
          files: [], 
          selectedFileIndex: PR_DESCRIPTION_INDEX, 
          isLoading: false, 
          error: null,
          // Preserve view preferences on reset
        }),
    }),
    {
      name: 'codjiflo-diff-preferences',
      // Only persist view preferences, not transient data
      partialize: (state) => ({
        viewMode: state.viewMode,
        contentFilter: state.contentFilter,
        displayMode: state.displayMode,
      }),
    }
  )
);
