import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/tests/helpers';
import userEvent from '@testing-library/user-event';
import { FileList } from './FileList';
import { useDiffStore } from '../stores';
import { FileChangeStatus } from '@/api/types';

vi.mock('../stores', () => ({
  useDiffStore: vi.fn(),
  PR_DESCRIPTION_INDEX: -1,
}));

describe('FileList', () => {
  const mockSelectFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      files: [],
      selectedFileIndex: 0,
      selectFile: mockSelectFile,
      isLoading: true,
      error: null,
    });

    render(<FileList />);

    expect(screen.getByRole('status', { name: /Loading files/i })).toBeInTheDocument();
  });

  it('shows error state', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      files: [],
      selectedFileIndex: 0,
      selectFile: mockSelectFile,
      isLoading: false,
      error: 'Failed to load files',
    });

    render(<FileList />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to load files')).toBeInTheDocument();
  });

  it('shows PR description entry even when no files', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      files: [],
      selectedFileIndex: -1,
      selectFile: mockSelectFile,
      isLoading: false,
      error: null,
    });

    render(<FileList />);

    // PR description entry should always be visible
    expect(screen.getByText('Pull Request Description')).toBeInTheDocument();
  });

  it('renders file list', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      files: [
        { filename: 'file1.ts', status: FileChangeStatus.Added, additions: 10, deletions: 0, changes: 10, patch: '' },
        { filename: 'file2.ts', status: FileChangeStatus.Modified, additions: 5, deletions: 3, changes: 8, patch: '' },
      ],
      selectedFileIndex: 0,
      selectFile: mockSelectFile,
      isLoading: false,
      error: null,
    });

    render(<FileList />);

    expect(screen.getByRole('navigation', { name: /Changed files/i })).toBeInTheDocument();
    expect(screen.getByText('file1.ts')).toBeInTheDocument();
    expect(screen.getByText('file2.ts')).toBeInTheDocument();
  });

  it('calls selectFile when file is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useDiffStore).mockReturnValue({
      files: [
        { filename: 'file1.ts', status: FileChangeStatus.Added, additions: 10, deletions: 0, changes: 10, patch: '' },
        { filename: 'file2.ts', status: FileChangeStatus.Modified, additions: 5, deletions: 3, changes: 8, patch: '' },
      ],
      selectedFileIndex: 0,
      selectFile: mockSelectFile,
      isLoading: false,
      error: null,
    });

    render(<FileList />);

    await user.click(screen.getByText('file2.ts'));

    expect(mockSelectFile).toHaveBeenCalledWith(1);
  });

  it('calls selectFile with PR_DESCRIPTION_INDEX when PR description is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useDiffStore).mockReturnValue({
      files: [
        { filename: 'file1.ts', status: FileChangeStatus.Added, additions: 10, deletions: 0, changes: 10, patch: '' },
      ],
      selectedFileIndex: 0,
      selectFile: mockSelectFile,
      isLoading: false,
      error: null,
    });

    render(<FileList />);

    await user.click(screen.getByText('Pull Request Description'));

    expect(mockSelectFile).toHaveBeenCalledWith(-1); // PR_DESCRIPTION_INDEX
  });
});
