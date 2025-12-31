import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LayoutState {
  leftPaneWidth: number;
  bottomPaneHeight: number;
  setLeftPaneWidth: (width: number) => void;
  setBottomPaneHeight: (height: number) => void;
  resizeLeftPane: (delta: number) => void;
  resizeBottomPane: (delta: number) => void;
}

const MIN_LEFT_PANE_WIDTH = 200;
const MAX_LEFT_PANE_WIDTH = 600;
const DEFAULT_LEFT_PANE_WIDTH = 330;

const MIN_BOTTOM_PANE_HEIGHT = 100;
const MAX_BOTTOM_PANE_HEIGHT = 500;
const DEFAULT_BOTTOM_PANE_HEIGHT = 200;

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      leftPaneWidth: DEFAULT_LEFT_PANE_WIDTH,
      bottomPaneHeight: DEFAULT_BOTTOM_PANE_HEIGHT,

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
        set((state) => {
          const newWidth = state.leftPaneWidth + delta;
          const clampedWidth = Math.min(
            Math.max(newWidth, MIN_LEFT_PANE_WIDTH),
            MAX_LEFT_PANE_WIDTH
          );
          return { leftPaneWidth: clampedWidth };
        });
      },

      resizeBottomPane: (delta: number) => {
        set((state) => {
          // Negative delta = resize up (make bottom pane taller)
          const newHeight = state.bottomPaneHeight - delta;
          const clampedHeight = Math.min(
            Math.max(newHeight, MIN_BOTTOM_PANE_HEIGHT),
            MAX_BOTTOM_PANE_HEIGHT
          );
          return { bottomPaneHeight: clampedHeight };
        });
      },
    }),
    {
      name: 'codjiflo-layout',
    }
  )
);
