import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@/tests/helpers';
import { FileList } from './FileList';
import { useDiffStore } from '../stores';
import { useIterationStore } from '@/features/iterations';
import { FileChangeStatus } from '@/api/types';

vi.mock('../hooks', async () => {
  const actual = await vi.importActual('../hooks');
  return actual; // Use real implementation
});

describe('FileList filter integration', () => {
  afterEach(() => {
    act(() => {
      useDiffStore.setState({
        files: [],
        selectedFileIndex: 0,
        isLoading: false,
        error: null,
      });
      useIterationStore.setState({
        iterations: [],
        isLoading: false,
        error: null,
        isDegraded: false,
      });
    });
  });

  it('filters files and maintains selection when filtering', async () => {
    const user = userEvent.setup();

    act(() => {
      useDiffStore.setState({
        files: [
          { filename: 'src/api/client.ts', status: FileChangeStatus.Modified, additions: 5, deletions: 2, changes: 7, patch: '' },
          { filename: 'src/api/types.ts', status: FileChangeStatus.Added, additions: 10, deletions: 0, changes: 10, patch: '' },
          { filename: 'src/utils/helpers.ts', status: FileChangeStatus.Modified, additions: 1, deletions: 1, changes: 2, patch: '' },
        ],
        selectedFileIndex: 0,
        isLoading: false,
        error: null,
      });
    });

    render(<FileList />);

    // Select second file
    await user.click(screen.getByText('types.ts'));
    expect(useDiffStore.getState().selectedFileIndex).toBe(1);

    // Filter to show only api files
    const filterInput = screen.getByPlaceholderText('Filter...');
    await user.type(filterInput, 'api');

    // Selection should be preserved (file still visible)
    expect(screen.getByText('types.ts')).toBeInTheDocument();
    expect(screen.getByText('(2/3)')).toBeInTheDocument();
  });

  it('counts update in real-time as user types', async () => {
    const user = userEvent.setup();

    act(() => {
      useDiffStore.setState({
        files: [
          { filename: 'auth.ts', status: FileChangeStatus.Modified, additions: 1, deletions: 0, changes: 1, patch: '' },
          { filename: 'author.ts', status: FileChangeStatus.Modified, additions: 1, deletions: 0, changes: 1, patch: '' },
          { filename: 'authorization.ts', status: FileChangeStatus.Modified, additions: 1, deletions: 0, changes: 1, patch: '' },
          { filename: 'utils.ts', status: FileChangeStatus.Modified, additions: 1, deletions: 0, changes: 1, patch: '' },
        ],
        selectedFileIndex: 0,
        isLoading: false,
        error: null,
      });
    });

    render(<FileList />);

    const filterInput = screen.getByPlaceholderText('Filter...');

    // Type 'a' - should match all auth* files
    await user.type(filterInput, 'a');
    expect(screen.getByText('(3/4)')).toBeInTheDocument();

    // Type 'u' (now 'au') - still matches auth*, author*, authorization*
    await user.type(filterInput, 'u');
    expect(screen.getByText('(3/4)')).toBeInTheDocument();

    // Type 'tho' (now 'autho') - matches author*, authorization*
    await user.type(filterInput, 'tho');
    expect(screen.getByText('(2/4)')).toBeInTheDocument();

    // Type 'r.' (now 'author.') - matches only author.ts
    await user.type(filterInput, 'r.');
    expect(screen.getByText('(1/4)')).toBeInTheDocument();
  });
});
