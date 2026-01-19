import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/tests/helpers';
import userEvent from '@testing-library/user-event';
import { FileList } from './FileList';
import { groupFilesByFolder } from '../utils';
import { useDiffStore } from '../stores';
import { FileChangeStatus } from '@/api/types';
import type { IterationAwareFile } from '../hooks';

vi.mock('../stores', () => ({
  useDiffStore: vi.fn(),
  PR_DESCRIPTION_INDEX: -1,
}));

vi.mock('../hooks', () => ({
  useIterationAwareFiles: vi.fn(),
}));

import { useIterationAwareFiles } from '../hooks';

const mockIterationFiles = (files: IterationAwareFile[]) => ({
  files,
  isIterationMode: false,
  totalFilesInPR: files.length,
});

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
    vi.mocked(useIterationAwareFiles).mockReturnValue(mockIterationFiles([]));

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
    vi.mocked(useIterationAwareFiles).mockReturnValue(mockIterationFiles([]));

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
    vi.mocked(useIterationAwareFiles).mockReturnValue(mockIterationFiles([]));

    render(<FileList />);

    // PR description entry should always be visible
    expect(screen.getByText('Pull Request Description')).toBeInTheDocument();
  });

  it('renders file list grouped by folder', () => {
    vi.mocked(useDiffStore).mockReturnValue({
      files: [],
      selectedFileIndex: 0,
      selectFile: mockSelectFile,
      isLoading: false,
      error: null,
    });
    vi.mocked(useIterationAwareFiles).mockReturnValue(mockIterationFiles([
      { filename: 'file1.ts', status: FileChangeStatus.Added, additions: 10, deletions: 0, changes: 10, patch: '', originalIndex: 0 },
      { filename: 'file2.ts', status: FileChangeStatus.Modified, additions: 5, deletions: 3, changes: 8, patch: '', originalIndex: 1 },
    ]));

    render(<FileList />);

    expect(screen.getByRole('navigation', { name: /Changed files/i })).toBeInTheDocument();
    // Root folder header should show
    expect(screen.getByText('/')).toBeInTheDocument();
    // Files should show with basenames
    expect(screen.getByText('file1.ts')).toBeInTheDocument();
    expect(screen.getByText('file2.ts')).toBeInTheDocument();
  });

  it('calls selectFile when file is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useDiffStore).mockReturnValue({
      files: [],
      selectedFileIndex: 0,
      selectFile: mockSelectFile,
      isLoading: false,
      error: null,
    });
    vi.mocked(useIterationAwareFiles).mockReturnValue(mockIterationFiles([
      { filename: 'file1.ts', status: FileChangeStatus.Added, additions: 10, deletions: 0, changes: 10, patch: '', originalIndex: 0 },
      { filename: 'file2.ts', status: FileChangeStatus.Modified, additions: 5, deletions: 3, changes: 8, patch: '', originalIndex: 1 },
    ]));

    render(<FileList />);

    await user.click(screen.getByText('file2.ts'));

    expect(mockSelectFile).toHaveBeenCalledWith(1);
  });

  it('calls selectFile with PR_DESCRIPTION_INDEX when PR description is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useDiffStore).mockReturnValue({
      files: [],
      selectedFileIndex: 0,
      selectFile: mockSelectFile,
      isLoading: false,
      error: null,
    });
    vi.mocked(useIterationAwareFiles).mockReturnValue(mockIterationFiles([
      { filename: 'file1.ts', status: FileChangeStatus.Added, additions: 10, deletions: 0, changes: 10, patch: '', originalIndex: 0 },
    ]));

    render(<FileList />);

    await user.click(screen.getByText('Pull Request Description'));

    expect(mockSelectFile).toHaveBeenCalledWith(-1); // PR_DESCRIPTION_INDEX
  });

  it('collapses and expands folders on click', async () => {
    const user = userEvent.setup();
    vi.mocked(useDiffStore).mockReturnValue({
      files: [],
      selectedFileIndex: 0,
      selectFile: mockSelectFile,
      isLoading: false,
      error: null,
    });
    vi.mocked(useIterationAwareFiles).mockReturnValue(mockIterationFiles([
      { filename: 'src/file1.ts', status: FileChangeStatus.Added, additions: 10, deletions: 0, changes: 10, patch: '', originalIndex: 0 },
    ]));

    render(<FileList />);

    // File should be visible initially
    expect(screen.getByText('file1.ts')).toBeInTheDocument();

    // Click folder to collapse
    await user.click(screen.getByText('/src'));

    // File should be hidden
    expect(screen.queryByText('file1.ts')).not.toBeInTheDocument();

    // Click again to expand
    await user.click(screen.getByText('/src'));

    // File should be visible again
    expect(screen.getByText('file1.ts')).toBeInTheDocument();
  });
});

describe('groupFilesByFolder', () => {
  const createFile = (filename: string, originalIndex: number): IterationAwareFile => ({
    filename,
    status: FileChangeStatus.Modified,
    additions: 1,
    deletions: 0,
    changes: 1,
    patch: '',
    originalIndex,
  });

  it('groups files by parent directory', () => {
    const files = [
      createFile('src/components/Button.tsx', 0),
      createFile('src/components/Input.tsx', 1),
      createFile('src/utils/helpers.ts', 2),
    ];

    const result = groupFilesByFolder(files);

    expect(result).toHaveLength(2);
    const [componentsGroup, utilsGroup] = result;
    expect(componentsGroup?.folder).toBe('/src/components');
    expect(componentsGroup?.files).toHaveLength(2);
    expect(utilsGroup?.folder).toBe('/src/utils');
    expect(utilsGroup?.files).toHaveLength(1);
  });

  it('places root files under "/" folder', () => {
    const files = [
      createFile('README.md', 0),
      createFile('package.json', 1),
    ];

    const result = groupFilesByFolder(files);

    expect(result).toHaveLength(1);
    const [rootGroup] = result;
    expect(rootGroup?.folder).toBe('/');
    expect(rootGroup?.files).toHaveLength(2);
  });

  it('sorts folders alphabetically with root first', () => {
    const files = [
      createFile('src/b/file.ts', 0),
      createFile('README.md', 1),
      createFile('src/a/file.ts', 2),
    ];

    const result = groupFilesByFolder(files);

    expect(result.map((g) => g.folder)).toEqual(['/', '/src/a', '/src/b']);
  });

  it('returns empty array for empty input', () => {
    const result = groupFilesByFolder([]);
    expect(result).toEqual([]);
  });

  it('preserves file order within each group', () => {
    const files = [
      createFile('src/a.ts', 0),
      createFile('src/c.ts', 1),
      createFile('src/b.ts', 2),
    ];

    const result = groupFilesByFolder(files);

    expect(result).toHaveLength(1);
    const [srcGroup] = result;
    expect(srcGroup?.files.map((f) => f.filename)).toEqual([
      'src/a.ts',
      'src/c.ts',
      'src/b.ts',
    ]);
  });
});
