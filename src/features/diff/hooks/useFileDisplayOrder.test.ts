/**
 * Unit tests for useFileDisplayOrder hook
 *
 * This hook returns files in the same order as displayed in the FileList component,
 * ensuring keyboard navigation follows visual display order.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFileDisplayOrder } from './useFileDisplayOrder';
import { useIterationAwareFiles, type IterationAwareFile } from './useIterationAwareFiles';
import { FileChangeStatus } from '@/api/types';

vi.mock('./useIterationAwareFiles', () => ({
  useIterationAwareFiles: vi.fn(),
}));

describe('useFileDisplayOrder', () => {
  const createFile = (filename: string, originalIndex: number): IterationAwareFile => ({
    filename,
    originalIndex,
    status: FileChangeStatus.Modified,
    additions: 1,
    deletions: 0,
    changes: 1,
    patch: '',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns files in folder-grouped order', () => {
    const files = [
      createFile('src/utils/helper.ts', 0),
      createFile('src/utils/format.ts', 1),
      createFile('README.md', 2),
      createFile('src/components/Button.tsx', 3),
    ];

    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files,
      isIterationMode: false,
      totalFilesInPR: 4,
    });

    const { result } = renderHook(() => useFileDisplayOrder());

    // Root files (/) come first, then sorted folders
    const filenames = result.current.files.map((f) => f.filename);

    // README.md is in root, should come first
    expect(filenames[0]).toBe('README.md');
    // src/components comes before src/utils alphabetically
    expect(filenames[1]).toBe('src/components/Button.tsx');
    // Then src/utils files, maintaining their input order
    expect(filenames[2]).toBe('src/utils/helper.ts');
    expect(filenames[3]).toBe('src/utils/format.ts');
  });

  it('returns empty array when no files', () => {
    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files: [],
      isIterationMode: false,
      totalFilesInPR: 0,
    });

    const { result } = renderHook(() => useFileDisplayOrder());

    expect(result.current.files).toEqual([]);
    expect(result.current.isIterationMode).toBe(false);
    expect(result.current.totalFilesInPR).toBe(0);
  });

  it('passes through isIterationMode flag', () => {
    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files: [createFile('test.ts', 0)],
      isIterationMode: true,
      totalFilesInPR: 3,
    });

    const { result } = renderHook(() => useFileDisplayOrder());

    expect(result.current.isIterationMode).toBe(true);
    expect(result.current.totalFilesInPR).toBe(3);
  });

  it('keeps root-level files at the beginning', () => {
    const files = [
      createFile('deep/nested/file.ts', 0),
      createFile('package.json', 1),
      createFile('tsconfig.json', 2),
    ];

    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files,
      isIterationMode: false,
      totalFilesInPR: 3,
    });

    const { result } = renderHook(() => useFileDisplayOrder());
    const filenames = result.current.files.map((f) => f.filename);

    // Root files should come first
    expect(filenames.indexOf('package.json')).toBeLessThan(filenames.indexOf('deep/nested/file.ts'));
    expect(filenames.indexOf('tsconfig.json')).toBeLessThan(filenames.indexOf('deep/nested/file.ts'));
  });

  it('sorts folders alphabetically', () => {
    const files = [
      createFile('zebra/file.ts', 0),
      createFile('alpha/file.ts', 1),
      createFile('beta/file.ts', 2),
    ];

    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files,
      isIterationMode: false,
      totalFilesInPR: 3,
    });

    const { result } = renderHook(() => useFileDisplayOrder());
    const filenames = result.current.files.map((f) => f.filename);

    expect(filenames).toEqual([
      'alpha/file.ts',
      'beta/file.ts',
      'zebra/file.ts',
    ]);
  });

  it('preserves files within the same folder in original order', () => {
    const files = [
      createFile('src/utils.ts', 0),
      createFile('src/helpers.ts', 1),
      createFile('src/index.ts', 2),
    ];

    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files,
      isIterationMode: false,
      totalFilesInPR: 3,
    });

    const { result } = renderHook(() => useFileDisplayOrder());
    const filenames = result.current.files.map((f) => f.filename);

    // Files in same folder maintain their input order
    expect(filenames).toEqual([
      'src/utils.ts',
      'src/helpers.ts',
      'src/index.ts',
    ]);
  });

  it('handles deeply nested folder paths', () => {
    const files = [
      createFile('a/b/c/d/deep.ts', 0),
      createFile('a/b/shallow.ts', 1),
      createFile('a/b/c/medium.ts', 2),
    ];

    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files,
      isIterationMode: false,
      totalFilesInPR: 3,
    });

    const { result } = renderHook(() => useFileDisplayOrder());
    const filenames = result.current.files.map((f) => f.filename);

    // Each distinct folder path creates its own group
    // a/b comes before a/b/c which comes before a/b/c/d
    expect(filenames.indexOf('a/b/shallow.ts')).toBeLessThan(filenames.indexOf('a/b/c/medium.ts'));
    expect(filenames.indexOf('a/b/c/medium.ts')).toBeLessThan(filenames.indexOf('a/b/c/d/deep.ts'));
  });

  it('memoizes result when files do not change', () => {
    const files = [createFile('test.ts', 0)];
    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files,
      isIterationMode: false,
      totalFilesInPR: 1,
    });

    const { result, rerender } = renderHook(() => useFileDisplayOrder());
    const firstResult = result.current.files;

    rerender();
    const secondResult = result.current.files;

    // Same reference if input hasn't changed
    expect(firstResult).toBe(secondResult);
  });

  it('updates result when files change', () => {
    const initialFiles = [createFile('test.ts', 0)];
    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files: initialFiles,
      isIterationMode: false,
      totalFilesInPR: 1,
    });

    const { result, rerender } = renderHook(() => useFileDisplayOrder());
    const firstResult = result.current.files;

    // Update files
    const newFiles = [createFile('new.ts', 0), createFile('test.ts', 1)];
    vi.mocked(useIterationAwareFiles).mockReturnValue({
      files: newFiles,
      isIterationMode: false,
      totalFilesInPR: 2,
    });

    rerender();
    const secondResult = result.current.files;

    // Different reference since input changed
    expect(firstResult).not.toBe(secondResult);
    expect(secondResult).toHaveLength(2);
  });
});
