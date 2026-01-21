import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { githubBackends, GitHubAPIError } from '@/api';
import type { DiffState, DiffViewConfig } from '../types';

/** Index -1 represents the PR description "file" */
export const PR_DESCRIPTION_INDEX = -1;

/** Default view configuration */
const DEFAULT_VIEW_CONFIG: DiffViewConfig = {
  mode: 'inline',
  filter: 'both',
  showFullFile: false,
  showWhitespace: false,
  showComments: true,
  textWrap: 'nowrap',
};

export const useDiffStore = create<DiffState>()(
  persist(
    (set, get) => ({
      files: [],
      selectedFileIndex: PR_DESCRIPTION_INDEX,
      isLoading: false,
      error: null,
      viewConfig: DEFAULT_VIEW_CONFIG,
      currentChangeIndex: -1,
      totalChangeCount: 0,
      goToLineState: 'hidden' as const,

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
        // Allow -1 for PR description, or any non-negative index
        // Note: In iteration mode, artifact-only files may have indices >= GitHub files.length
        // DiffView handles missing files gracefully via useIterationAwareFiles
        if (index === PR_DESCRIPTION_INDEX || index >= 0) {
          set({ selectedFileIndex: index, currentChangeIndex: -1 });
        }
      },

      selectNextFile: () => {
        const { selectedFileIndex, files } = get();
        // From description (-1) go to first file (0), then continue through files
        if (selectedFileIndex < files.length - 1) {
          set({ selectedFileIndex: selectedFileIndex + 1, currentChangeIndex: -1 });
        }
      },

      selectPreviousFile: () => {
        const { selectedFileIndex } = get();
        // Allow going back to description (-1)
        if (selectedFileIndex > PR_DESCRIPTION_INDEX) {
          set({ selectedFileIndex: selectedFileIndex - 1, currentChangeIndex: -1 });
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

      toggleComments: () => {
        set((state) => ({
          viewConfig: {
            ...state.viewConfig,
            showComments: !state.viewConfig.showComments,
          },
        }));
      },

      setTextWrap: (wrap) => {
        set((state) => ({
          viewConfig: {
            ...state.viewConfig,
            textWrap: wrap,
          },
        }));
      },

      // Change navigation actions
      scrollToNextChange: () => {
        const { currentChangeIndex, totalChangeCount } = get();
        // If the current index is out of range (e.g. after a view mode change),
        // reset it to "before the first hunk" so the next navigation lands on index 0.
        const normalizedIndex =
          currentChangeIndex >= totalChangeCount ? -1 : currentChangeIndex;
        // Only advance if there are more hunks
        if (normalizedIndex < totalChangeCount - 1) {
          set({ currentChangeIndex: normalizedIndex + 1 });
        }
      },

      scrollToPreviousChange: () => {
        const { currentChangeIndex, totalChangeCount } = get();
        // If the current index is out of range (e.g. after a view mode change),
        // clamp it to the last available hunk so previous navigation still works.
        const normalizedIndex =
          currentChangeIndex >= totalChangeCount
            ? totalChangeCount - 1
            : currentChangeIndex;
        if (normalizedIndex > 0) {
          set({ currentChangeIndex: normalizedIndex - 1 });
        }
      },

      resetChangeIndex: () => {
        set({ currentChangeIndex: -1, totalChangeCount: 0 });
      },

      setTotalChangeCount: (count) => {
        set({ totalChangeCount: count });
      },

      reset: () => set({
        files: [],
        selectedFileIndex: PR_DESCRIPTION_INDEX,
        isLoading: false,
        error: null,
        currentChangeIndex: -1,
        totalChangeCount: 0,
        goToLineState: 'hidden',
        // Keep viewConfig on reset - it's a user preference
      }),

      // Go to Line actions
      showGoToLine: () => set({ goToLineState: 'visible' }),
      hideGoToLine: () => set({ goToLineState: 'hidden' }),
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
