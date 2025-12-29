import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { githubBackends, GitHubAPIError } from '@/api';
import type { DiffState, DiffViewConfig } from '../types';

/** Index -1 represents the PR description "file" */
export const PR_DESCRIPTION_INDEX = -1;

/** Default view configuration */
const DEFAULT_VIEW_CONFIG: DiffViewConfig = {
  mode: 'unified',
  filter: 'both',
  showFullFile: false,
  showWhitespace: false,
};

export const useDiffStore = create<DiffState>()(
  persist(
    (set, get) => ({
      files: [],
      selectedFileIndex: PR_DESCRIPTION_INDEX,
      isLoading: false,
      error: null,
      viewConfig: DEFAULT_VIEW_CONFIG,

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

      // View configuration actions (S-3.3)
      setViewMode: (mode) => {
        set((state) => ({
          viewConfig: { ...state.viewConfig, mode },
        }));
      },

      setContentFilter: (filter) => {
        set((state) => ({
          viewConfig: { ...state.viewConfig, filter },
        }));
      },

      toggleFullFile: () => {
        set((state) => ({
          viewConfig: {
            ...state.viewConfig,
            showFullFile: !state.viewConfig.showFullFile,
          },
        }));
      },

      toggleWhitespace: () => {
        set((state) => ({
          viewConfig: {
            ...state.viewConfig,
            showWhitespace: !state.viewConfig.showWhitespace,
          },
        }));
      },

      reset: () => set({
        files: [],
        selectedFileIndex: PR_DESCRIPTION_INDEX,
        isLoading: false,
        error: null,
        // Keep viewConfig on reset - it's a user preference
      }),
    }),
    {
      name: 'diff-store',
      // Only persist view configuration (S-3.3.13, S-3.3.14, AC-3.1.11, AC-3.5.3)
      partialize: (state) => ({
        viewConfig: state.viewConfig,
      }),
    }
  )
);
