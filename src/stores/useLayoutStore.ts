import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LayoutState {
  leftPaneWidth: number;
  bottomPaneHeight: number;
  isLeftPaneCollapsed: boolean;
  isBottomPaneCollapsed: boolean;
  lastLeftPaneWidth: number;
  lastBottomPaneHeight: number;
  setLeftPaneWidth: (width: number) => void;
  setBottomPaneHeight: (height: number) => void;
  resizeLeftPane: (delta: number) => void;
  resizeBottomPane: (delta: number) => void;
  collapseLeftPane: () => void;
  expandLeftPane: () => void;
  collapseBottomPane: () => void;
  expandBottomPane: () => void;
}

const MIN_LEFT_PANE_WIDTH = 200;
const MAX_LEFT_PANE_WIDTH = 2000;
const DEFAULT_LEFT_PANE_WIDTH = 330;
const COLLAPSE_THRESHOLD_LEFT = 50;

const MIN_BOTTOM_PANE_HEIGHT = 100;
const MAX_BOTTOM_PANE_HEIGHT = 2000;
const DEFAULT_BOTTOM_PANE_HEIGHT = 200;
const COLLAPSE_THRESHOLD_BOTTOM = 50;

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      leftPaneWidth: DEFAULT_LEFT_PANE_WIDTH,
      bottomPaneHeight: DEFAULT_BOTTOM_PANE_HEIGHT,
      isLeftPaneCollapsed: false,
      isBottomPaneCollapsed: false,
      lastLeftPaneWidth: DEFAULT_LEFT_PANE_WIDTH,
      lastBottomPaneHeight: DEFAULT_BOTTOM_PANE_HEIGHT,

      setLeftPaneWidth: (width: number) => {
        const clampedWidth = Math.min(
          Math.max(width, MIN_LEFT_PANE_WIDTH),
          MAX_LEFT_PANE_WIDTH
        );
        set({ leftPaneWidth: clampedWidth });
      },

      setBottomPaneHeight: (height: number) => {
        const clampedHeight = Math.min(
          Math.max(height, MIN_BOTTOM_PANE_HEIGHT),
          MAX_BOTTOM_PANE_HEIGHT
        );
        set({ bottomPaneHeight: clampedHeight });
      },

      resizeLeftPane: (delta: number) => {
        const state = get();
        const newWidth = state.leftPaneWidth + delta;

        // Auto-collapse when resized below threshold
        if (newWidth < COLLAPSE_THRESHOLD_LEFT) {
          set({
            lastLeftPaneWidth: state.leftPaneWidth,
            leftPaneWidth: 0,
            isLeftPaneCollapsed: true,
          });
          return;
        }

        const clampedWidth = Math.min(
          Math.max(newWidth, MIN_LEFT_PANE_WIDTH),
          MAX_LEFT_PANE_WIDTH
        );
        set({ leftPaneWidth: clampedWidth });
      },

      resizeBottomPane: (delta: number) => {
        const state = get();
        // Negative delta = resize up (make bottom pane taller)
        const newHeight = state.bottomPaneHeight - delta;

        // Auto-collapse when resized below threshold
        if (newHeight < COLLAPSE_THRESHOLD_BOTTOM) {
          set({
            lastBottomPaneHeight: state.bottomPaneHeight,
            bottomPaneHeight: 0,
            isBottomPaneCollapsed: true,
          });
          return;
        }

        const clampedHeight = Math.min(
          Math.max(newHeight, MIN_BOTTOM_PANE_HEIGHT),
          MAX_BOTTOM_PANE_HEIGHT
        );
        set({ bottomPaneHeight: clampedHeight });
      },

      collapseLeftPane: () => {
        const state = get();
        if (state.isLeftPaneCollapsed) return;
        set({
          lastLeftPaneWidth: state.leftPaneWidth,
          leftPaneWidth: 0,
          isLeftPaneCollapsed: true,
        });
      },

      expandLeftPane: () => {
        const state = get();
        if (!state.isLeftPaneCollapsed) return;
        set({
          leftPaneWidth: state.lastLeftPaneWidth,
          isLeftPaneCollapsed: false,
        });
      },

      collapseBottomPane: () => {
        const state = get();
        if (state.isBottomPaneCollapsed) return;
        set({
          lastBottomPaneHeight: state.bottomPaneHeight,
          bottomPaneHeight: 0,
          isBottomPaneCollapsed: true,
        });
      },

      expandBottomPane: () => {
        const state = get();
        if (!state.isBottomPaneCollapsed) return;
        set({
          bottomPaneHeight: state.lastBottomPaneHeight,
          isBottomPaneCollapsed: false,
        });
      },
    }),
    {
      name: 'codjiflo-layout',
    }
  )
);
