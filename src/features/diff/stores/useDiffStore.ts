import { create } from 'zustand';
import { githubBackends, GitHubAPIError } from '@/api';
import type { DiffState } from '../types';

/** Index -1 represents the PR description "file" */
export const PR_DESCRIPTION_INDEX = -1;

export const useDiffStore = create<DiffState>((set, get) => ({
  files: [],
  selectedFileIndex: PR_DESCRIPTION_INDEX,
  isLoading: false,
  error: null,

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

  reset: () => set({ files: [], selectedFileIndex: PR_DESCRIPTION_INDEX, isLoading: false, error: null }),
}));
