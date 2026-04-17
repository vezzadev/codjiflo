import { describe, it, expect } from 'vitest';
import {
  getParentPath,
  getBasename,
  groupFilesByFolder,
  flattenGroupedFiles,
} from './file-grouping';
import type { IterationAwareFile } from '../hooks/useIterationAwareFiles';
import { FileChangeStatus } from '@/api/types';

function createFile(filename: string, originalIndex: number): IterationAwareFile {
  return {
    filename,
    status: FileChangeStatus.Modified,
    additions: 1,
    deletions: 1,
    changes: 2,
    patch: '',
    originalIndex,
  };
}

describe('getParentPath', () => {
  it('returns "/" for root-level files', () => {
    expect(getParentPath('README.md')).toBe('/');
    expect(getParentPath('package.json')).toBe('/');
  });

  it('returns parent path with leading slash for nested files', () => {
    expect(getParentPath('src/index.ts')).toBe('/src');
    expect(getParentPath('src/utils/helper.ts')).toBe('/src/utils');
  });

  it('handles deeply nested paths', () => {
    expect(getParentPath('a/b/c/d/e/file.ts')).toBe('/a/b/c/d/e');
  });
});

describe('getBasename', () => {
  it('returns filename for root-level files', () => {
    expect(getBasename('README.md')).toBe('README.md');
    expect(getBasename('package.json')).toBe('package.json');
  });

  it('returns basename for nested files', () => {
    expect(getBasename('src/index.ts')).toBe('index.ts');
    expect(getBasename('src/utils/helper.ts')).toBe('helper.ts');
  });
});

describe('groupFilesByFolder', () => {
  it('groups files by parent directory', () => {
    const files = [
      createFile('src/a.ts', 0),
      createFile('src/b.ts', 1),
      createFile('test/a.test.ts', 2),
    ];

    const result = groupFilesByFolder(files);

    expect(result).toHaveLength(2);
    expect(result[0]?.folder).toBe('/src');
    expect(result[0]?.files).toHaveLength(2);
    expect(result[1]?.folder).toBe('/test');
    expect(result[1]?.files).toHaveLength(1);
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

  it('handles mixed root and nested files', () => {
    const files = [
      createFile('package.json', 0),
      createFile('src/index.ts', 1),
      createFile('README.md', 2),
      createFile('src/utils/helper.ts', 3),
    ];

    const result = groupFilesByFolder(files);

    expect(result.map((g) => g.folder)).toEqual(['/', '/src', '/src/utils']);
    expect(result[0]?.files.map((f) => f.filename)).toEqual(['package.json', 'README.md']);
    expect(result[1]?.files.map((f) => f.filename)).toEqual(['src/index.ts']);
    expect(result[2]?.files.map((f) => f.filename)).toEqual(['src/utils/helper.ts']);
  });
});

describe('flattenGroupedFiles', () => {
  it('flattens grouped files into single array', () => {
    const files = [
      createFile('README.md', 0),
      createFile('src/a.ts', 1),
      createFile('src/b.ts', 2),
      createFile('test/a.test.ts', 3),
    ];

    const grouped = groupFilesByFolder(files);
    const flattened = flattenGroupedFiles(grouped);

    expect(flattened).toHaveLength(4);
    expect(flattened.map((f) => f.filename)).toEqual([
      'README.md',
      'src/a.ts',
      'src/b.ts',
      'test/a.test.ts',
    ]);
  });

  it('returns empty array for empty groups', () => {
    const result = flattenGroupedFiles([]);
    expect(result).toEqual([]);
  });

  it('preserves originalIndex values', () => {
    const files = [
      createFile('src/z.ts', 5),
      createFile('README.md', 0),
      createFile('src/a.ts', 10),
    ];

    const grouped = groupFilesByFolder(files);
    const flattened = flattenGroupedFiles(grouped);

    expect(flattened.map((f) => f.originalIndex)).toEqual([0, 5, 10]);
  });
});
