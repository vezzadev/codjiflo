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
      visitedFileIndices: new Set<number>(),
      pendingScrollToChange: null,

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
          const { visitedFileIndices } = get();
          const isFirstVisit = !visitedFileIndices.has(index);

          if (isFirstVisit) {
            // First visit: auto-scroll to first change
            const newVisited = new Set(visitedFileIndices);
            newVisited.add(index);
            set({
              selectedFileIndex: index,
              currentChangeIndex: 0,
              pendingScrollToChange: 0,
              visitedFileIndices: newVisited,
            });
          } else {
            // Revisit: preserve scroll position (no pending scroll)
            set({
              selectedFileIndex: index,
              currentChangeIndex: -1,
            });
          }
        }
      },

      selectNextFile: () => {
        const { selectedFileIndex, files, visitedFileIndices } = get();
        // From description (-1) go to first file (0), then continue through files
        if (selectedFileIndex < files.length - 1) {
          const nextIndex = selectedFileIndex + 1;
          const isFirstVisit = !visitedFileIndices.has(nextIndex);

          if (isFirstVisit) {
            const newVisited = new Set(visitedFileIndices);
            newVisited.add(nextIndex);
            set({
              selectedFileIndex: nextIndex,
              currentChangeIndex: 0,
              pendingScrollToChange: 0,
              visitedFileIndices: newVisited,
            });
          } else {
            set({
              selectedFileIndex: nextIndex,
              currentChangeIndex: -1,
            });
          }
        }
      },

      selectPreviousFile: () => {
        const { selectedFileIndex, visitedFileIndices } = get();
        // Allow going back to description (-1)
        if (selectedFileIndex > PR_DESCRIPTION_INDEX) {
          const prevIndex = selectedFileIndex - 1;
          const isFirstVisit = !visitedFileIndices.has(prevIndex);

          if (isFirstVisit) {
            const newVisited = new Set(visitedFileIndices);
            newVisited.add(prevIndex);
            set({
              selectedFileIndex: prevIndex,
              currentChangeIndex: 0,
              pendingScrollToChange: 0,
              visitedFileIndices: newVisited,
            });
          } else {
            set({
              selectedFileIndex: prevIndex,
              currentChangeIndex: -1,
            });
          }
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
          // Reset visited files so they auto-scroll to first change in new mode
          visitedFileIndices: new Set<number>(),
        }));
      },

      toggleFullFile: () => {
        set((state) => ({
          viewConfig: {
            ...state.viewConfig,
            showFullFile: !state.viewConfig.showFullFile,
          },
          // Reset visited files so they auto-scroll to first change in new mode
          visitedFileIndices: new Set<number>(),
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
          const newIndex = normalizedIndex + 1;
          set({ currentChangeIndex: newIndex, pendingScrollToChange: newIndex });
        } else if (normalizedIndex >= 0 && totalChangeCount > 0) {
          // Can't advance but still re-center on current change (useful after mode toggle)
          set({ pendingScrollToChange: normalizedIndex });
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
          const newIndex = normalizedIndex - 1;
          set({ currentChangeIndex: newIndex, pendingScrollToChange: newIndex });
        } else if (normalizedIndex >= 0 && totalChangeCount > 0) {
          // Can't go back but still re-center on current change (useful after mode toggle)
          set({ pendingScrollToChange: normalizedIndex });
        }
      },

      resetChangeIndex: () => {
        set({ currentChangeIndex: -1, totalChangeCount: 0 });
      },

      setTotalChangeCount: (count) => {
        set({ totalChangeCount: count });
      },

      clearPendingScroll: () => {
        set({ pendingScrollToChange: null });
      },

      reset: () => set({
        files: [],
        selectedFileIndex: PR_DESCRIPTION_INDEX,
        isLoading: false,
        error: null,
        currentChangeIndex: -1,
        totalChangeCount: 0,
        visitedFileIndices: new Set<number>(),
        pendingScrollToChange: null,
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
