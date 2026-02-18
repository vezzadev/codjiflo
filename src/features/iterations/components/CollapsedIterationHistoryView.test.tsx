import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CollapsedIterationHistoryView } from './CollapsedIterationHistoryView';
import type { CollapsedIterationGroup } from '../types';

function createGroup(overrides?: Partial<CollapsedIterationGroup>): CollapsedIterationGroup {
  return {
    forcePushEventId: '100',
    discardedRevisions: [1, 2],
    commits: [
      { sha: 'abc123', message: 'First commit', author: 'alice', date: '2024-01-01T10:00:00Z', status: 'available' },
      { sha: 'def456', message: 'Second commit', author: 'bob', date: '2024-01-02T10:00:00Z', status: 'available' },
    ],
    reason: 'force_push',
    visibility: 'collapsed',
    ...overrides,
  };
}

describe('CollapsedIterationHistoryView', () => {
  it('renders commit list with details', () => {
    const group = createGroup();
    render(<CollapsedIterationHistoryView group={group} onInclude={vi.fn()} />);

    expect(screen.getByTestId('collapsed-history-view')).toBeInTheDocument();
    expect(screen.getByText('Discarded Iterations')).toBeInTheDocument();

    const commit1 = screen.getByTestId('collapsed-history-commit-abc123');
    expect(commit1).toBeInTheDocument();
    expect(commit1).toHaveTextContent('First commit');
    expect(commit1).toHaveTextContent('alice');

    const commit2 = screen.getByTestId('collapsed-history-commit-def456');
    expect(commit2).toBeInTheDocument();
    expect(commit2).toHaveTextContent('Second commit');
    expect(commit2).toHaveTextContent('bob');
  });

  it('calls onInclude when include button is clicked', () => {
    const onInclude = vi.fn();
    const group = createGroup();
    render(<CollapsedIterationHistoryView group={group} onInclude={onInclude} />);

    fireEvent.click(screen.getByTestId('collapsed-history-include-btn'));
    expect(onInclude).toHaveBeenCalledOnce();
  });

  it('shows only first line of multi-line commit messages', () => {
    const group = createGroup({
      commits: [
        {
          sha: 'multi123',
          message: 'Fix parser bug\n\nThis is a detailed description\nwith multiple lines',
          author: 'charlie',
          date: '2024-01-01',
          status: 'available',
        },
      ],
      discardedRevisions: [1],
    });

    render(<CollapsedIterationHistoryView group={group} onInclude={vi.fn()} />);

    const commitItem = screen.getByTestId('collapsed-history-commit-multi123');
    expect(commitItem).toHaveTextContent('Fix parser bug');
    expect(commitItem).not.toHaveTextContent('This is a detailed description');
  });

  it('renders unavailable commits with grayed-out style', () => {
    const group = createGroup({
      commits: [
        { sha: 'unavail1', message: '', author: '', date: '', status: 'unavailable' },
      ],
      discardedRevisions: [1],
    });

    render(<CollapsedIterationHistoryView group={group} onInclude={vi.fn()} />);

    const commitItem = screen.getByTestId('collapsed-history-commit-unavail1');
    expect(commitItem).toHaveClass('unavailable');
    expect(commitItem).toHaveTextContent('Commit data no longer available');
  });

  it('shows unknownCount message instead of commit list', () => {
    const group = createGroup({
      unknownCount: true,
      commits: [],
      discardedRevisions: [],
    });

    render(<CollapsedIterationHistoryView group={group} onInclude={vi.fn()} />);

    expect(screen.getByText('Unknown iterations were discarded')).toBeInTheDocument();
    expect(screen.queryByTestId(/collapsed-history-commit-/)).not.toBeInTheDocument();
  });

  it('renders revision numbers from discardedRevisions', () => {
    const group = createGroup({
      discardedRevisions: [3, 4],
      commits: [
        { sha: 'rev3', message: 'Commit 3', author: 'alice', date: '2024-01-01', status: 'available' },
        { sha: 'rev4', message: 'Commit 4', author: 'alice', date: '2024-01-02', status: 'available' },
      ],
    });

    render(<CollapsedIterationHistoryView group={group} onInclude={vi.fn()} />);

    const commit1 = screen.getByTestId('collapsed-history-commit-rev3');
    expect(commit1).toHaveTextContent('#3');

    const commit2 = screen.getByTestId('collapsed-history-commit-rev4');
    expect(commit2).toHaveTextContent('#4');
  });
});
