/**
 * Unit tests for diff factory functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockFileChange,
  createMockDiffLine,
  createMockAddedLine,
  createMockDeletedLine,
  resetDiffFactoryCounters,
} from './diff';
import { FileChangeStatus } from '@/api/types';

describe('diff factories', () => {
  beforeEach(() => {
    resetDiffFactoryCounters();
  });

  describe('createMockFileChange', () => {
    it('creates a default file change', () => {
      const file = createMockFileChange();

      expect(file.filename).toMatch(/^src\/file\d+\.ts$/);
      expect(file.status).toBe(FileChangeStatus.Modified);
      expect(file.additions).toBe(10);
      expect(file.deletions).toBe(5);
      expect(file.changes).toBe(15);
      expect(file.patch).toContain('@@ -1,5 +1,7 @@');
    });

    it('increments file counter on each call', () => {
      const file1 = createMockFileChange();
      const file2 = createMockFileChange();

      expect(file1.filename).toBe('src/file1.ts');
      expect(file2.filename).toBe('src/file2.ts');
    });

    it('accepts overrides', () => {
      const file = createMockFileChange({
        filename: 'custom.js',
        status: FileChangeStatus.Added,
        additions: 100,
      });

      expect(file.filename).toBe('custom.js');
      expect(file.status).toBe(FileChangeStatus.Added);
      expect(file.additions).toBe(100);
      // Non-overridden properties retain defaults
      expect(file.deletions).toBe(5);
    });
  });

  describe('createMockDiffLine', () => {
    it('creates a default context line', () => {
      const line = createMockDiffLine();

      expect(line.type).toBe('context');
      expect(line.content).toBe('const example = true;');
      expect(line.oldLineNumber).toBe(1);
      expect(line.newLineNumber).toBe(1);
    });

    it('accepts overrides', () => {
      const line = createMockDiffLine({
        type: 'addition',
        content: 'new line',
        newLineNumber: 42,
      });

      expect(line.type).toBe('addition');
      expect(line.content).toBe('new line');
      expect(line.newLineNumber).toBe(42);
    });
  });

  describe('createMockAddedLine', () => {
    it('creates an addition line with correct properties', () => {
      const line = createMockAddedLine(5, '+const newVar = true;');

      expect(line.type).toBe('addition');
      expect(line.content).toBe('+const newVar = true;');
      expect(line.oldLineNumber).toBeNull();
      expect(line.newLineNumber).toBe(5);
    });
  });

  describe('createMockDeletedLine', () => {
    it('creates a deletion line with correct properties', () => {
      const line = createMockDeletedLine(10, '-const oldVar = false;');

      expect(line.type).toBe('deletion');
      expect(line.content).toBe('-const oldVar = false;');
      expect(line.oldLineNumber).toBe(10);
      expect(line.newLineNumber).toBeNull();
    });
  });

  describe('resetDiffFactoryCounters', () => {
    it('resets the file counter', () => {
      createMockFileChange(); // file1
      createMockFileChange(); // file2
      resetDiffFactoryCounters();
      const file = createMockFileChange();

      expect(file.filename).toBe('src/file1.ts');
    });
  });
});
