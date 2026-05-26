import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IterationSelector } from './IterationSelector';
import type { Iteration, IterationRange, ArtifactReference, CollapsedIterationGroup } from '../types';

// Store state that tests can configure
interface MockStoreState {
  iterations: Iteration[];
  collapsedGroups: CollapsedIterationGroup[];
  selectedRange: IterationRange | null;
  selectRange: ReturnType<typeof vi.fn>;
  isLoading: boolean;
  mode: 'stateful' | 'stateless';
  artifactReference: ArtifactReference | null;
}

let currentMockState: MockStoreState;

// Mock the store - useIterationStore can be called with or without selector
vi.mock('../stores', () => ({
  useIterationStore: vi.fn((selector?: (state: unknown) => unknown) => {
    if (typeof selector === 'function') {
      // Called with selector (selectSelectedRange) - return selected range
      return currentMockState.selectedRange;
    }
    // Called without selector - return full state
    return currentMockState;
  }),
  selectSelectedRange: vi.fn((state: { selectedRange: IterationRange | null }) => state.selectedRange),
}));

// Helper to create mock iterations
function createMockIteration(revision: number, options?: { status?: 'live' | 'collapsed'; collapsedGroupId?: string }): Iteration {
  const base: Iteration = {
    id: revision,
    revision,
    baseSha: `base-sha-${revision}`,
    headSha: `head-sha-${revision}`,
    beforeSha: null,
    author: 'testuser',
    createdAt: new Date('2024-01-15'),
    status: options?.status ?? 'live',
  };
  if (options?.collapsedGroupId) {
    base.collapsedGroupId = options.collapsedGroupId;
  }
  return base;
}

// Helper to setup mock state
function setupMockState(state: Partial<MockStoreState>) {
  const mockSelectRange = vi.fn();
  currentMockState = {
    iterations: [],
    collapsedGroups: [],
    selectedRange: null,
    selectRange: mockSelectRange,
    isLoading: false,
    mode: 'stateful',
    artifactReference: null,
    ...state,
  };
  return { mockSelectRange: currentMockState.selectRange };
}

describe('IterationSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering conditions', () => {
    it('renders iteration tabs in stateless mode when iterations exist', () => {
      setupMockState({
        iterations: [createMockIteration(1), createMockIteration(2)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 3 },
        mode: 'stateless',
      });

      render(<IterationSelector />);
      expect(screen.getByTestId('iteration-selector')).toBeInTheDocument();
      expect(screen.getByTestId('iteration-tab-1')).toBeInTheDocument();
      expect(screen.getByTestId('iteration-tab-2')).toBeInTheDocument();
    });

    it('returns null in stateless mode when no iterations', () => {
      setupMockState({
        iterations: [],
        selectedRange: null,
        mode: 'stateless',
      });

      const { container } = render(<IterationSelector />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null when iterations array is empty and not loading', () => {
      setupMockState({
        iterations: [],
        selectedRange: null,
        mode: 'stateful',
        isLoading: false,
      });

      const { container } = render(<IterationSelector />);
      expect(container.firstChild).toBeNull();
    });

    it('shows skeleton tabs when loading with no iterations (default count)', () => {
      setupMockState({
        iterations: [],
        selectedRange: null,
        mode: 'stateful',
        isLoading: true,
        artifactReference: null,
      });

      render(<IterationSelector />);

      // Should show the container with skeleton loading state
      const selector = screen.getByTestId('iteration-selector');
      expect(selector).toBeInTheDocument();
      expect(selector).toHaveAttribute('aria-label', 'Iteration range selector loading');

      // Should show default 3 skeleton tabs when artifactReference is null
      const skeletons = selector.querySelectorAll('.iteration-tab-skeleton');
      expect(skeletons).toHaveLength(3);

      // Last skeleton should have active class to indicate selection position
      expect(skeletons[2]).toHaveClass('active');
      expect(skeletons[0]).not.toHaveClass('active');
      expect(skeletons[1]).not.toHaveClass('active');

      // Group should indicate loading
      const group = selector.querySelector('[role="group"]');
      expect(group).toHaveAttribute('aria-busy', 'true');
    });

    it('shows skeleton tabs matching artifactReference.iterationCount', () => {
      setupMockState({
        iterations: [],
        selectedRange: null,
        mode: 'stateful',
        isLoading: true,
        artifactReference: {
          iterationCount: 5,
          timestamp: '2024-01-15T10:00:00Z',
          artifactId: 12345,
          runId: 67890,
        },
      });

      render(<IterationSelector />);

      const selector = screen.getByTestId('iteration-selector');
      const skeletons = selector.querySelectorAll('.iteration-tab-skeleton');

      // Should show 5 skeleton tabs matching iterationCount
      expect(skeletons).toHaveLength(5);

      // Last skeleton (5th) should have active class
      expect(skeletons[4]).toHaveClass('active');
      expect(skeletons[0]).not.toHaveClass('active');
    });

    it('renders iteration tabs when iterations exist', () => {
      setupMockState({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 },
        mode: 'stateful',
      });

      render(<IterationSelector />);

      expect(screen.getByTestId('iteration-selector')).toBeInTheDocument();
      expect(screen.getByTestId('iteration-tab-1')).toBeInTheDocument();
      expect(screen.getByTestId('iteration-tab-2')).toBeInTheDocument();
      expect(screen.getByTestId('iteration-tab-3')).toBeInTheDocument();
    });

    it('shows loading indicator when isLoading is true', () => {
      setupMockState({
        iterations: [createMockIteration(1)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        isLoading: true,
        mode: 'stateful',
      });

      render(<IterationSelector />);

      expect(screen.getByTestId('iteration-selector')).toBeInTheDocument();
      // Loading indicator should be present with text
      const loadingIndicator = document.querySelector('.iteration-loading');
      expect(loadingIndicator).toBeInTheDocument();
      expect(loadingIndicator).toHaveTextContent('Loading...');
    });
  });

  describe('tab display', () => {
    it('displays iteration numbers correctly', () => {
      setupMockState({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 },
        mode: 'stateful',
      });

      render(<IterationSelector />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('applies selected class to range end tab', () => {
      setupMockState({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 }, // toSnapshot 5 = iteration 3
        mode: 'stateful',
      });

      render(<IterationSelector />);

      const tab3 = screen.getByTestId('iteration-tab-3');
      expect(tab3).toHaveClass('selected');
    });

    it('applies in-range class to iterations within range', () => {
      setupMockState({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 }, // Base to iteration 3
        mode: 'stateful',
      });

      render(<IterationSelector />);

      // All iterations should be in range (from base to iteration 3)
      expect(screen.getByTestId('iteration-tab-1')).toHaveClass('in-range');
      expect(screen.getByTestId('iteration-tab-2')).toHaveClass('in-range');
      expect(screen.getByTestId('iteration-tab-3')).toHaveClass('in-range');
    });

    it('applies custom className when provided', () => {
      setupMockState({
        iterations: [createMockIteration(1)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        mode: 'stateful',
      });

      render(<IterationSelector className="custom-class" />);

      expect(screen.getByTestId('iteration-selector')).toHaveClass('custom-class');
    });
  });

  describe('click interactions', () => {
    it('selects single iteration on click (base to iteration)', () => {
      const { mockSelectRange } = setupMockState({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 },
        mode: 'stateful',
      });

      render(<IterationSelector />);

      const tab2 = screen.getByTestId('iteration-tab-2');

      // Simulate click (mousedown + mouseup)
      fireEvent.mouseDown(tab2);
      fireEvent.mouseUp(screen.getByTestId('iteration-selector'));

      // Should select from base (0) to iteration 2's right snapshot (3)
      expect(mockSelectRange).toHaveBeenCalledWith(0, 3);
    });

    it('handles mouseUp when not dragging', () => {
      const { mockSelectRange } = setupMockState({
        iterations: [createMockIteration(1)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        mode: 'stateful',
      });

      render(<IterationSelector />);

      // Fire mouseUp without mouseDown first
      fireEvent.mouseUp(screen.getByTestId('iteration-selector'));

      // Should not call selectRange
      expect(mockSelectRange).not.toHaveBeenCalled();
    });
  });

  describe('drag interactions', () => {
    it('selects range when dragging across tabs', () => {
      const { mockSelectRange } = setupMockState({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 },
        mode: 'stateful',
      });

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
      const { mockSelectRange } = setupMockState({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 },
        mode: 'stateful',
      });

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
      const { mockSelectRange } = setupMockState({
        iterations: [createMockIteration(1), createMockIteration(2)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 3 },
        mode: 'stateful',
      });

      render(<IterationSelector />);

      const tab2 = screen.getByTestId('iteration-tab-2');

      // Fire mouseEnter without starting drag
      fireEvent.mouseEnter(tab2);

      // Nothing should happen
      expect(mockSelectRange).not.toHaveBeenCalled();
    });

  });

  describe('keyboard interactions', () => {
    it('selects iteration on Enter key', () => {
      const { mockSelectRange } = setupMockState({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 },
        mode: 'stateful',
      });

      render(<IterationSelector />);

      const tab2 = screen.getByTestId('iteration-tab-2');
      // react-aria ToggleButton activates Enter via keyDown+keyUp
      fireEvent.keyDown(tab2, { key: 'Enter' });
      fireEvent.keyUp(tab2, { key: 'Enter' });

      // Should select from base (0) to iteration 2's right snapshot (3)
      expect(mockSelectRange).toHaveBeenCalledWith(0, 3);
    });

    it('selects iteration on Space key', () => {
      const { mockSelectRange } = setupMockState({
        iterations: [createMockIteration(1), createMockIteration(2)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 3 },
        mode: 'stateful',
      });

      render(<IterationSelector />);

      const tab1 = screen.getByTestId('iteration-tab-1');
      // react-aria ToggleButton activates Space via keyDown+keyUp
      fireEvent.keyDown(tab1, { key: ' ' });
      fireEvent.keyUp(tab1, { key: ' ' });

      // Should select from base (0) to iteration 1's right snapshot (1)
      expect(mockSelectRange).toHaveBeenCalledWith(0, 1);
    });

    it('ignores other keys', () => {
      const { mockSelectRange } = setupMockState({
        iterations: [createMockIteration(1)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        mode: 'stateful',
      });

      render(<IterationSelector />);

      const tab1 = screen.getByTestId('iteration-tab-1');
      fireEvent.keyDown(tab1, { key: 'Tab' });
      fireEvent.keyUp(tab1, { key: 'Tab' });
      fireEvent.keyDown(tab1, { key: 'a' });
      fireEvent.keyUp(tab1, { key: 'a' });

      expect(mockSelectRange).not.toHaveBeenCalled();
    });
  });

  describe('range highlighting', () => {
    it('highlights range start and end for iteration-to-iteration range', () => {
      // Range from iteration 1 to iteration 3 (snapshot 1 to snapshot 5)
      setupMockState({
        iterations: [createMockIteration(1), createMockIteration(2), createMockIteration(3)],
        selectedRange: { fromSnapshot: 1, toSnapshot: 5 },
        mode: 'stateful',
      });

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

  describe('collapsed iteration groups', () => {
    it('renders collapsed group as a single tab with eraser icon', () => {
      setupMockState({
        iterations: [
          createMockIteration(1, { status: 'collapsed', collapsedGroupId: '100' }),
          createMockIteration(2, { status: 'collapsed', collapsedGroupId: '100' }),
          createMockIteration(3),
        ],
        collapsedGroups: [{
          forcePushEventId: '100',
          discardedRevisions: [1, 2],
          commits: [],
          reason: 'force_push',
          visibility: 'collapsed',
        }],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 },
        mode: 'stateless',
      });

      render(<IterationSelector />);

      // Should render collapsed group as single tab
      const collapsedTab = screen.getByTestId('collapsed-group-100');
      expect(collapsedTab).toBeInTheDocument();
      expect(collapsedTab).toHaveClass('collapsed');

      // Should have eraser icon (svg inside the element)
      const icon = collapsedTab.querySelector('svg');
      expect(icon).toBeInTheDocument();

      // Should show live iteration tab normally
      expect(screen.getByTestId('iteration-tab-3')).toBeInTheDocument();

      // Individual collapsed iteration tabs should NOT be rendered
      expect(screen.queryByTestId('iteration-tab-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('iteration-tab-2')).not.toBeInTheDocument();
    });

    it('shows tooltip with discarded count on collapsed group tab', () => {
      setupMockState({
        iterations: [
          createMockIteration(1, { status: 'collapsed', collapsedGroupId: '100' }),
          createMockIteration(2, { status: 'collapsed', collapsedGroupId: '100' }),
          createMockIteration(3),
        ],
        collapsedGroups: [{
          forcePushEventId: '100',
          discardedRevisions: [1, 2],
          commits: [],
          reason: 'force_push',
          visibility: 'collapsed',
        }],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 },
        mode: 'stateless',
      });

      render(<IterationSelector />);

      const collapsedTab = screen.getByTestId('collapsed-group-100');
      expect(collapsedTab).toHaveAttribute('title', '2 iterations discarded');
    });

    it('collapsed group tab is non-interactive (no mouse/keyboard handlers)', () => {
      const { mockSelectRange } = setupMockState({
        iterations: [
          createMockIteration(1, { status: 'collapsed', collapsedGroupId: '100' }),
          createMockIteration(2),
        ],
        collapsedGroups: [{
          forcePushEventId: '100',
          discardedRevisions: [1],
          commits: [],
          reason: 'force_push',
          visibility: 'collapsed',
        }],
        selectedRange: { fromSnapshot: 0, toSnapshot: 3 },
        mode: 'stateless',
      });

      render(<IterationSelector />);

      const collapsedTab = screen.getByTestId('collapsed-group-100');
      fireEvent.mouseDown(collapsedTab);
      fireEvent.mouseUp(screen.getByTestId('iteration-selector'));

      expect(mockSelectRange).not.toHaveBeenCalled();
    });

    it('renders unknown count group tab', () => {
      setupMockState({
        iterations: [createMockIteration(1)],
        collapsedGroups: [{
          forcePushEventId: '200',
          discardedRevisions: [],
          commits: [],
          reason: 'force_push',
          visibility: 'collapsed',
          unknownCount: true,
        }],
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        mode: 'stateless',
      });

      render(<IterationSelector />);

      const collapsedTab = screen.getByTestId('collapsed-group-200');
      expect(collapsedTab).toHaveAttribute('title', 'Unknown iterations discarded');
    });

    it('renders multiple collapsed groups as separate tabs', () => {
      setupMockState({
        iterations: [
          createMockIteration(1, { status: 'collapsed', collapsedGroupId: '100' }),
          createMockIteration(2, { status: 'collapsed', collapsedGroupId: '100' }),
          createMockIteration(3), // live between groups
          createMockIteration(4, { status: 'collapsed', collapsedGroupId: '200' }),
          createMockIteration(5),
        ],
        collapsedGroups: [
          {
            forcePushEventId: '100',
            discardedRevisions: [1, 2],
            commits: [],
            reason: 'force_push',
            visibility: 'collapsed',
          },
          {
            forcePushEventId: '200',
            discardedRevisions: [4],
            commits: [],
            reason: 'force_push',
            visibility: 'collapsed',
          },
        ],
        selectedRange: { fromSnapshot: 0, toSnapshot: 9 },
        mode: 'stateless',
      });

      render(<IterationSelector />);

      // Both collapsed groups should render as separate tabs
      expect(screen.getByTestId('collapsed-group-100')).toBeInTheDocument();
      expect(screen.getByTestId('collapsed-group-200')).toBeInTheDocument();

      // Live iteration tabs render normally
      expect(screen.getByTestId('iteration-tab-3')).toBeInTheDocument();
      expect(screen.getByTestId('iteration-tab-5')).toBeInTheDocument();

      // Collapsed individual iteration tabs do NOT render
      expect(screen.queryByTestId('iteration-tab-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('iteration-tab-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('iteration-tab-4')).not.toBeInTheDocument();

      // Tooltips are correct for each group
      expect(screen.getByTestId('collapsed-group-100')).toHaveAttribute('title', '2 iterations discarded');
      expect(screen.getByTestId('collapsed-group-200')).toHaveAttribute('title', '1 iteration discarded');
    });

    it('singular tooltip for single discarded iteration', () => {
      setupMockState({
        iterations: [
          createMockIteration(1, { status: 'collapsed', collapsedGroupId: '100' }),
          createMockIteration(2),
        ],
        collapsedGroups: [{
          forcePushEventId: '100',
          discardedRevisions: [1],
          commits: [],
          reason: 'force_push',
          visibility: 'collapsed',
        }],
        selectedRange: { fromSnapshot: 0, toSnapshot: 3 },
        mode: 'stateless',
      });

      render(<IterationSelector />);

      // Should use singular "iteration" not "iterations"
      expect(screen.getByTestId('collapsed-group-100')).toHaveAttribute('title', '1 iteration discarded');
    });

    it('collapsed group tab has role="img" for accessibility', () => {
      setupMockState({
        iterations: [
          createMockIteration(1, { status: 'collapsed', collapsedGroupId: '100' }),
          createMockIteration(2),
        ],
        collapsedGroups: [{
          forcePushEventId: '100',
          discardedRevisions: [1],
          commits: [],
          reason: 'force_push',
          visibility: 'collapsed',
        }],
        selectedRange: { fromSnapshot: 0, toSnapshot: 3 },
        mode: 'stateless',
      });

      render(<IterationSelector />);

      const collapsedTab = screen.getByTestId('collapsed-group-100');
      expect(collapsedTab).toHaveAttribute('role', 'img');
      expect(collapsedTab).toHaveAttribute('aria-label');
      // Should NOT be a button element (non-interactive)
      expect(collapsedTab.tagName).toBe('DIV');
    });

    it('drag across live tabs skips collapsed group (no range includes collapsed)', () => {
      const { mockSelectRange } = setupMockState({
        iterations: [
          createMockIteration(1, { status: 'collapsed', collapsedGroupId: '100' }),
          createMockIteration(2),
          createMockIteration(3),
        ],
        collapsedGroups: [{
          forcePushEventId: '100',
          discardedRevisions: [1],
          commits: [],
          reason: 'force_push',
          visibility: 'collapsed',
        }],
        selectedRange: { fromSnapshot: 0, toSnapshot: 5 },
        mode: 'stateless',
      });

      render(<IterationSelector />);

      // Drag from tab 2 to tab 3 (skipping collapsed group)
      const tab2 = screen.getByTestId('iteration-tab-2');
      const tab3 = screen.getByTestId('iteration-tab-3');
      const container = screen.getByTestId('iteration-selector');

      fireEvent.mouseDown(tab2);
      fireEvent.mouseEnter(tab3);
      fireEvent.mouseUp(container);

      // Range should be between the two live iterations
      expect(mockSelectRange).toHaveBeenCalledWith(3, 5);
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      setupMockState({
        iterations: [createMockIteration(1)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        mode: 'stateful',
      });

      render(<IterationSelector />);

      const container = screen.getByTestId('iteration-selector');
      expect(container).toHaveAttribute('role', 'toolbar');
      expect(container).toHaveAttribute('aria-label', 'Iteration range selector');

      const group = container.querySelector('[role="group"]');
      expect(group).toBeInTheDocument();
    });

    it('tabs have aria-pressed attribute', () => {
      setupMockState({
        iterations: [createMockIteration(1), createMockIteration(2)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 3 },
        mode: 'stateful',
      });

      render(<IterationSelector />);

      const tab1 = screen.getByTestId('iteration-tab-1');
      const tab2 = screen.getByTestId('iteration-tab-2');

      // Both should be in range, so aria-pressed should be true
      expect(tab1).toHaveAttribute('aria-pressed', 'true');
      expect(tab2).toHaveAttribute('aria-pressed', 'true');
    });

    it('tabs have aria-label with iteration number and date information', () => {
      setupMockState({
        iterations: [createMockIteration(1)],
        selectedRange: { fromSnapshot: 0, toSnapshot: 1 },
        mode: 'stateful',
      });

      render(<IterationSelector />);

      const tab = screen.getByTestId('iteration-tab-1');
      expect(tab).toHaveAttribute('aria-label', expect.stringContaining('Iteration 1'));
      expect(tab).toHaveAttribute('aria-label', expect.stringContaining('Jan'));
    });
  });
});
