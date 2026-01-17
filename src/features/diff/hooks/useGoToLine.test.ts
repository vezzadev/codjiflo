import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGoToLine, parseLineInput } from './useGoToLine';
import type { ParsedDiffLine, AlignedDiffLine } from '../types';

describe('parseLineInput', () => {
  describe('valid inputs', () => {
    it('parses "lN" format for left side', () => {
      expect(parseLineInput('l10')).toEqual({ lineNumber: 10, side: 'left' });
      expect(parseLineInput('l1')).toEqual({ lineNumber: 1, side: 'left' });
      expect(parseLineInput('l999')).toEqual({ lineNumber: 999, side: 'left' });
    });

    it('parses "rN" format for right side', () => {
      expect(parseLineInput('r15')).toEqual({ lineNumber: 15, side: 'right' });
      expect(parseLineInput('r1')).toEqual({ lineNumber: 1, side: 'right' });
      expect(parseLineInput('r999')).toEqual({ lineNumber: 999, side: 'right' });
    });

    it('parses "N" format as right side (default)', () => {
      expect(parseLineInput('20')).toEqual({ lineNumber: 20, side: 'right' });
      expect(parseLineInput('1')).toEqual({ lineNumber: 1, side: 'right' });
      expect(parseLineInput('999')).toEqual({ lineNumber: 999, side: 'right' });
    });

    it('handles uppercase input', () => {
      expect(parseLineInput('L10')).toEqual({ lineNumber: 10, side: 'left' });
      expect(parseLineInput('R15')).toEqual({ lineNumber: 15, side: 'right' });
    });

    it('trims whitespace', () => {
      expect(parseLineInput('  l10  ')).toEqual({ lineNumber: 10, side: 'left' });
      expect(parseLineInput('  20  ')).toEqual({ lineNumber: 20, side: 'right' });
    });
  });

  describe('invalid inputs', () => {
    it('returns null for empty string', () => {
      expect(parseLineInput('')).toBeNull();
      expect(parseLineInput('   ')).toBeNull();
    });

    it('returns null for line 0', () => {
      expect(parseLineInput('0')).toBeNull();
      expect(parseLineInput('l0')).toBeNull();
      expect(parseLineInput('r0')).toBeNull();
    });

    it('returns null for negative numbers', () => {
      expect(parseLineInput('-5')).toBeNull();
      expect(parseLineInput('l-5')).toBeNull();
    });

    it('returns null for non-numeric input', () => {
      expect(parseLineInput('abc')).toBeNull();
      expect(parseLineInput('labc')).toBeNull();
      expect(parseLineInput('l10abc')).toBeNull();
    });

    it('returns null for mixed formats', () => {
      expect(parseLineInput('lr10')).toBeNull();
      expect(parseLineInput('10l')).toBeNull();
    });
  });
});

describe('useGoToLine', () => {
  describe('modal state', () => {
    it('starts with modal closed', () => {
      const { result } = renderHook(() => useGoToLine());
      expect(result.current.isOpen).toBe(false);
    });

    it('opens modal', () => {
      const { result } = renderHook(() => useGoToLine());
      act(() => {
        result.current.open();
      });
      expect(result.current.isOpen).toBe(true);
    });

    it('closes modal', () => {
      const { result } = renderHook(() => useGoToLine());
      act(() => {
        result.current.open();
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.close();
      });
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('Ctrl+G keyboard shortcut', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('opens modal on Ctrl+G', () => {
      const { result } = renderHook(() => useGoToLine());
      expect(result.current.isOpen).toBe(false);

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'g', ctrlKey: true })
        );
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('opens modal on Cmd+G (Mac)', () => {
      const { result } = renderHook(() => useGoToLine());
      expect(result.current.isOpen).toBe(false);

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'g', metaKey: true })
        );
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('does not open modal when in input field', () => {
      const { result } = renderHook(() => useGoToLine());
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      act(() => {
        input.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'g',
            ctrlKey: true,
            bubbles: true,
          })
        );
      });

      expect(result.current.isOpen).toBe(false);
      document.body.removeChild(input);
    });

    it('does not open modal when in textarea', () => {
      const { result } = renderHook(() => useGoToLine());
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      act(() => {
        textarea.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'g',
            ctrlKey: true,
            bubbles: true,
          })
        );
      });

      expect(result.current.isOpen).toBe(false);
      document.body.removeChild(textarea);
    });
  });

  describe('findRowIndex - inline mode', () => {
    const createDiffLines = (): ParsedDiffLine[] => [
      { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'deletion', content: 'old line', oldLineNumber: 2, newLineNumber: null },
      { type: 'addition', content: 'new line', oldLineNumber: null, newLineNumber: 2 },
      { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 3 },
      { type: 'context', content: 'line 4', oldLineNumber: 4, newLineNumber: 4 },
    ];

    it('finds row index for right/new side by number only', () => {
      const { result } = renderHook(() => useGoToLine());
      const diffLines = createDiffLines();

      const index = result.current.findRowIndex('3', diffLines, [], 'inline');
      expect(index).toBe(3); // line 3 is at index 3
    });

    it('finds row index for right/new side with r prefix', () => {
      const { result } = renderHook(() => useGoToLine());
      const diffLines = createDiffLines();

      const index = result.current.findRowIndex('r4', diffLines, [], 'inline');
      expect(index).toBe(4); // line 4 is at index 4
    });

    it('finds row index for left/old side', () => {
      const { result } = renderHook(() => useGoToLine());
      const diffLines = createDiffLines();

      const index = result.current.findRowIndex('l2', diffLines, [], 'inline');
      expect(index).toBe(1); // old line 2 is at index 1 (the deletion)
    });

    it('returns -1 when line not found', () => {
      const { result } = renderHook(() => useGoToLine());
      const diffLines = createDiffLines();

      const index = result.current.findRowIndex('99', diffLines, [], 'inline');
      expect(index).toBe(-1);
    });

    it('returns -1 for invalid input', () => {
      const { result } = renderHook(() => useGoToLine());
      const diffLines = createDiffLines();

      const index = result.current.findRowIndex('invalid', diffLines, [], 'inline');
      expect(index).toBe(-1);
    });
  });

  describe('findRowIndex - split mode', () => {
    const createAlignedLines = (): AlignedDiffLine[] => [
      {
        key: '0',
        left: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
        right: { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
      },
      {
        key: '1',
        left: { type: 'deletion', content: 'old', oldLineNumber: 2, newLineNumber: null },
        right: null,
      },
      {
        key: '2',
        left: null,
        right: { type: 'addition', content: 'new', oldLineNumber: null, newLineNumber: 2 },
      },
      {
        key: '3',
        left: { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 3 },
        right: { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 3 },
      },
    ];

    it('finds row index for right side in split mode', () => {
      const { result } = renderHook(() => useGoToLine());
      const alignedLines = createAlignedLines();

      const index = result.current.findRowIndex('2', [], alignedLines, 'split');
      expect(index).toBe(2); // new line 2 is at index 2
    });

    it('finds row index for left side in split mode', () => {
      const { result } = renderHook(() => useGoToLine());
      const alignedLines = createAlignedLines();

      const index = result.current.findRowIndex('l2', [], alignedLines, 'split');
      expect(index).toBe(1); // old line 2 is at index 1
    });

    it('returns -1 when line not found in split mode', () => {
      const { result } = renderHook(() => useGoToLine());
      const alignedLines = createAlignedLines();

      const index = result.current.findRowIndex('l99', [], alignedLines, 'split');
      expect(index).toBe(-1);
    });
  });
});
