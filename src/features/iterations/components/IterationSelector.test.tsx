import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IterationSelector } from './IterationSelector';
import { useIterationStore } from '../stores';
import type { Iteration, IterationRange } from '../types';

// Mock the store
vi.mock('../stores', () => ({
  useIterationStore: vi.fn(),
}));

const mockUseIterationStore = vi.mocked(useIterationStore);

// Helper to create mock iterations
function createMockIteration(revision: number): Iteration {
  return {
    id: `iteration-${revision}`,
    revision,
    baseSha: `base-sha-${revision}`,
    headSha: `head-sha-${revision}`,
    author: 'testuser',
    createdAt: new Date('2024-01-15'),
  };
}

describe('IterationSelector', () => {
  const mockSelectRange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering conditions', () => {
    it('returns null when isDegraded is true', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: true,
      } as ReturnType<typeof useIterationStore>);

      const { container } = render(<IterationSelector />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null when iterations array is empty', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [],
        selectedRange: null,
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      const { container } = render(<IterationSelector />);
      expect(container.firstChild).toBeNull();
    });

    it('renders iteration tabs when iterations exist', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 },
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      expect(screen.getByTestId('iteration-selector')).toBeInTheDocument();
      expect(screen.getByTestId('iteration-tab-1')).toBeInTheDocument();
      expect(screen.getByTestId('iteration-tab-2')).toBeInTheDocument();
      expect(screen.getByTestId('iteration-tab-3')).toBeInTheDocument();
    });

    it('shows loading indicator when isLoading is true', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        selectRange: mockSelectRange,
        isLoading: true,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      expect(screen.getByTestId('iteration-selector')).toBeInTheDocument();
      // Loading spinner should be present
      expect(document.querySelector('.iteration-loading')).toBeInTheDocument();
    });
  });

  describe('tab display', () => {
    it('displays iteration numbers correctly', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 },
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('applies selected class to range end tab', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 }, // toSnapshot 5 = iteration 3
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      const tab3 = screen.getByTestId('iteration-tab-3');
      expect(tab3).toHaveClass('selected');
    });

    it('applies in-range class to iterations within range', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 }, // Base to iteration 3
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      // All iterations should be in range (from base to iteration 3)
      expect(screen.getByTestId('iteration-tab-1')).toHaveClass('in-range');
      expect(screen.getByTestId('iteration-tab-2')).toHaveClass('in-range');
      expect(screen.getByTestId('iteration-tab-3')).toHaveClass('in-range');
    });

    it('applies custom className when provided', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector className="custom-class" />);

      expect(screen.getByTestId('iteration-selector')).toHaveClass('custom-class');
    });
  });

  describe('click interactions', () => {
    it('selects single iteration on click (base to iteration)', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 },
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      const tab2 = screen.getByTestId('iteration-tab-2');

      // Simulate click (mousedown + mouseup)
      fireEvent.mouseDown(tab2);
      fireEvent.mouseUp(screen.getByTestId('iteration-selector'));

      // Should select from base (0) to iteration 2's right snapshot (3)
      expect(mockSelectRange).toHaveBeenCalledWith(0, 3);
    });

    it('handles mouseUp when not dragging', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      // Fire mouseUp without mouseDown first
      fireEvent.mouseUp(screen.getByTestId('iteration-selector'));

      // Should not call selectRange
      expect(mockSelectRange).not.toHaveBeenCalled();
    });
  });

  describe('drag interactions', () => {
    it('selects range when dragging across tabs', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 },
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      const tab1 = screen.getByTestId('iteration-tab-1');
      const tab3 = screen.getByTestId('iteration-tab-3');
      const container = screen.getByTestId('iteration-selector');

      // Simulate drag from tab 1 to tab 3
      fireEvent.mouseDown(tab1);
      fireEvent.mouseEnter(tab3);
      fireEvent.mouseUp(container);

      // Should select from iteration 1's right snapshot (1) to iteration 3's right snapshot (5)
      expect(mockSelectRange).toHaveBeenCalledWith(1, 5);
    });

    it('handles reverse drag (right to left)', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 },
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      const tab1 = screen.getByTestId('iteration-tab-1');
      const tab3 = screen.getByTestId('iteration-tab-3');
      const container = screen.getByTestId('iteration-selector');

      // Simulate drag from tab 3 to tab 1 (reverse)
      fireEvent.mouseDown(tab3);
      fireEvent.mouseEnter(tab1);
      fireEvent.mouseUp(container);

      // Should still select from min to max (1 to 5)
      expect(mockSelectRange).toHaveBeenCalledWith(1, 5);
    });

    it('ignores mouseEnter when not dragging', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1), createMockIteration(2)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 3 },
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      const tab2 = screen.getByTestId('iteration-tab-2');

      // Fire mouseEnter without starting drag
      fireEvent.mouseEnter(tab2);

      // Nothing should happen
      expect(mockSelectRange).not.toHaveBeenCalled();
    });

    it('handles mouseLeave during drag', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1), createMockIteration(2)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 3 },
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      const tab1 = screen.getByTestId('iteration-tab-1');
      const container = screen.getByTestId('iteration-selector');

      // Start drag
      fireEvent.mouseDown(tab1);

      // Leave container
      fireEvent.mouseLeave(container);

      // Drag state should be preserved (no selection made yet)
      expect(mockSelectRange).not.toHaveBeenCalled();
    });
  });

  describe('range highlighting', () => {
    it('highlights range start and end for iteration-to-iteration range', () => {
      // Range from iteration 1 to iteration 3 (snapshot 1 to snapshot 5)
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 1, toSnapshot: 5 } as IterationRange,
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      const tab1 = screen.getByTestId('iteration-tab-1');
      const tab2 = screen.getByTestId('iteration-tab-2');
      const tab3 = screen.getByTestId('iteration-tab-3');

      // Tab 1 should be range start (selected)
      expect(tab1).toHaveClass('selected');
      expect(tab1).toHaveClass('range-start');

      // Tab 2 should be in range but not selected
      expect(tab2).toHaveClass('in-range');

      // Tab 3 should be range end (selected)
      expect(tab3).toHaveClass('selected');
      expect(tab3).toHaveClass('range-end');
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      const container = screen.getByTestId('iteration-selector');
      expect(container).toHaveAttribute('role', 'toolbar');
      expect(container).toHaveAttribute('aria-label', 'Iteration range selector');

      const tablist = container.querySelector('[role="tablist"]');
      expect(tablist).toBeInTheDocument();
    });

    it('tabs have aria-pressed attribute', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1), createMockIteration(2)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 3 },
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      const tab1 = screen.getByTestId('iteration-tab-1');
      const tab2 = screen.getByTestId('iteration-tab-2');

      // Both should be in range, so aria-pressed should be true
      expect(tab1).toHaveAttribute('aria-pressed', 'true');
      expect(tab2).toHaveAttribute('aria-pressed', 'true');
    });

    it('tabs have title with date information', () => {
      mockUseIterationStore.mockReturnValue({
        iterations: [createMockIteration(1)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        selectRange: mockSelectRange,
        isLoading: false,
        isDegraded: false,
      } as ReturnType<typeof useIterationStore>);

      render(<IterationSelector />);

      const tab = screen.getByTestId('iteration-tab-1');
      expect(tab).toHaveAttribute('title', expect.stringContaining('Iteration 1'));
      expect(tab).toHaveAttribute('title', expect.stringContaining('Jan'));
    });
  });
});
