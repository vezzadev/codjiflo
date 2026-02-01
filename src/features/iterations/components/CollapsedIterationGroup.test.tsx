import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollapsedIterationGroup } from './CollapsedIterationGroup';
import type { CollapsedIterationGroup as CollapsedIterationGroupType, StatelessIteration } from '../types';

// Helper to create a mock stateless iteration
function createMockStatelessIteration(revision: number, options?: Partial<StatelessIteration>): StatelessIteration {
  return {
    revision,
    commitSha: `sha-${revision}`,
    baseSha: `base-${revision}`,
    author: 'testuser',
    message: `Commit message ${revision}`,
    createdAt: new Date('2024-01-15'),
    lineage: 'discarded',
    collapsedGroupId: 'group-1',
    ...options,
  };
}

// Helper to create a mock collapsed group
function createMockCollapsedGroup(options?: Partial<CollapsedIterationGroupType>): CollapsedIterationGroupType {
  return {
    id: 'group-1',
    beforeSha: 'before-sha',
    afterSha: 'after-sha',
    iterations: [
      createMockStatelessIteration(1),
      createMockStatelessIteration(2),
    ],
    visibility: 'collapsed',
    ...options,
  };
}

describe('CollapsedIterationGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('collapsed state', () => {
    it('renders collapsed state with eraser icon and count', () => {
      const group = createMockCollapsedGroup();
      const onToggleExpand = vi.fn();

      render(
        <CollapsedIterationGroup
          group={group}
          onToggleExpand={onToggleExpand}
          onMouseDown={vi.fn()}
          onMouseEnter={vi.fn()}
        />
      );

      // Should show collapsed tab
      const collapsedTab = screen.getByTestId('collapsed-group-group-1');
      expect(collapsedTab).toBeInTheDocument();

      // Should have eraser icon (aria-label check)
      expect(collapsedTab.querySelector('[aria-label="Discarded iterations"]')).toBeInTheDocument();

      // Should show count of discarded iterations
      expect(screen.getByText('2')).toBeInTheDocument();

      // Should have collapsed styling class
      expect(collapsedTab).toHaveClass('collapsed-iteration-group');
      expect(collapsedTab).toHaveClass('collapsed');
    });

    it('calls onToggleExpand when collapsed tab is clicked', () => {
      const group = createMockCollapsedGroup();
      const onToggleExpand = vi.fn();

      render(
        <CollapsedIterationGroup
          group={group}
          onToggleExpand={onToggleExpand}
          onMouseDown={vi.fn()}
          onMouseEnter={vi.fn()}
        />
      );

      const collapsedTab = screen.getByTestId('collapsed-group-group-1');
      fireEvent.click(collapsedTab);

      expect(onToggleExpand).toHaveBeenCalledWith('group-1');
    });

    it('shows unavailable tooltip when commits are GCd', () => {
      const group = createMockCollapsedGroup({
        unavailableReason: 'Commits no longer available (garbage collected)',
      });

      render(
        <CollapsedIterationGroup
          group={group}
          onToggleExpand={vi.fn()}
          onMouseDown={vi.fn()}
          onMouseEnter={vi.fn()}
        />
      );

      const collapsedTab = screen.getByTestId('collapsed-group-group-1');

      // Should have title attribute with unavailable reason
      expect(collapsedTab).toHaveAttribute(
        'title',
        'Commits no longer available (garbage collected)'
      );

      // Should have unavailable class
      expect(collapsedTab).toHaveClass('unavailable');
    });
  });

  describe('expanded state', () => {
    it('renders expanded state with all discarded iterations', () => {
      const group = createMockCollapsedGroup({ visibility: 'expanded' });
      const onMouseDown = vi.fn();
      const onMouseEnter = vi.fn();

      render(
        <CollapsedIterationGroup
          group={group}
          onToggleExpand={vi.fn()}
          onMouseDown={onMouseDown}
          onMouseEnter={onMouseEnter}
        />
      );

      // Should show expanded container
      const expandedContainer = screen.getByTestId('collapsed-group-group-1');
      expect(expandedContainer).toBeInTheDocument();
      expect(expandedContainer).toHaveClass('expanded');

      // Should show iteration tabs for each discarded iteration
      expect(screen.getByTestId('discarded-iteration-tab-1')).toBeInTheDocument();
      expect(screen.getByTestId('discarded-iteration-tab-2')).toBeInTheDocument();
    });

    it('discarded iteration tabs have proper strikethrough styling', () => {
      const group = createMockCollapsedGroup({ visibility: 'expanded' });

      render(
        <CollapsedIterationGroup
          group={group}
          onToggleExpand={vi.fn()}
          onMouseDown={vi.fn()}
          onMouseEnter={vi.fn()}
        />
      );

      const tab1 = screen.getByTestId('discarded-iteration-tab-1');
      const tab2 = screen.getByTestId('discarded-iteration-tab-2');

      expect(tab1).toHaveClass('discarded-iteration-tab');
      expect(tab2).toHaveClass('discarded-iteration-tab');
    });

    it('calls onToggleExpand to collapse when header clicked in expanded state', () => {
      const group = createMockCollapsedGroup({ visibility: 'expanded' });
      const onToggleExpand = vi.fn();

      render(
        <CollapsedIterationGroup
          group={group}
          onToggleExpand={onToggleExpand}
          onMouseDown={vi.fn()}
          onMouseEnter={vi.fn()}
        />
      );

      // Click the collapse toggle button
      const collapseButton = screen.getByRole('button', { name: /collapse/i });
      fireEvent.click(collapseButton);

      expect(onToggleExpand).toHaveBeenCalledWith('group-1');
    });
  });

  describe('drag selection interaction', () => {
    it('calls onMouseDown when mousedown on expanded iteration tab', () => {
      const group = createMockCollapsedGroup({ visibility: 'expanded' });
      const onMouseDown = vi.fn();

      render(
        <CollapsedIterationGroup
          group={group}
          onToggleExpand={vi.fn()}
          onMouseDown={onMouseDown}
          onMouseEnter={vi.fn()}
        />
      );

      const tab1 = screen.getByTestId('discarded-iteration-tab-1');
      fireEvent.mouseDown(tab1);

      expect(onMouseDown).toHaveBeenCalledWith(1);
    });

    it('calls onMouseEnter when mouse enters expanded iteration tab', () => {
      const group = createMockCollapsedGroup({ visibility: 'expanded' });
      const onMouseEnter = vi.fn();

      render(
        <CollapsedIterationGroup
          group={group}
          onToggleExpand={vi.fn()}
          onMouseDown={vi.fn()}
          onMouseEnter={onMouseEnter}
        />
      );

      const tab2 = screen.getByTestId('discarded-iteration-tab-2');
      fireEvent.mouseEnter(tab2);

      expect(onMouseEnter).toHaveBeenCalledWith(2);
    });
  });

  describe('keyboard interaction', () => {
    it('expands on Enter key press when collapsed', () => {
      const group = createMockCollapsedGroup();
      const onToggleExpand = vi.fn();

      render(
        <CollapsedIterationGroup
          group={group}
          onToggleExpand={onToggleExpand}
          onMouseDown={vi.fn()}
          onMouseEnter={vi.fn()}
        />
      );

      const collapsedTab = screen.getByTestId('collapsed-group-group-1');
      fireEvent.keyDown(collapsedTab, { key: 'Enter' });

      expect(onToggleExpand).toHaveBeenCalledWith('group-1');
    });

    it('expands on Space key press when collapsed', () => {
      const group = createMockCollapsedGroup();
      const onToggleExpand = vi.fn();

      render(
        <CollapsedIterationGroup
          group={group}
          onToggleExpand={onToggleExpand}
          onMouseDown={vi.fn()}
          onMouseEnter={vi.fn()}
        />
      );

      const collapsedTab = screen.getByTestId('collapsed-group-group-1');
      fireEvent.keyDown(collapsedTab, { key: ' ' });

      expect(onToggleExpand).toHaveBeenCalledWith('group-1');
    });
  });

  describe('accessibility', () => {
    it('collapsed tab has appropriate aria attributes', () => {
      const group = createMockCollapsedGroup();

      render(
        <CollapsedIterationGroup
          group={group}
          onToggleExpand={vi.fn()}
          onMouseDown={vi.fn()}
          onMouseEnter={vi.fn()}
        />
      );

      const collapsedTab = screen.getByTestId('collapsed-group-group-1');

      expect(collapsedTab).toHaveAttribute('role', 'button');
      expect(collapsedTab).toHaveAttribute('aria-expanded', 'false');
      expect(collapsedTab).toHaveAttribute('tabIndex', '0');
    });

    it('expanded container has appropriate aria attributes', () => {
      const group = createMockCollapsedGroup({ visibility: 'expanded' });

      render(
        <CollapsedIterationGroup
          group={group}
          onToggleExpand={vi.fn()}
          onMouseDown={vi.fn()}
          onMouseEnter={vi.fn()}
        />
      );

      const container = screen.getByTestId('collapsed-group-group-1');
      expect(container).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
