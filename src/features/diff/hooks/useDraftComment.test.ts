/**
 * Unit tests for useDraftComment hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDraftComment } from './useDraftComment';
import { useDiffStore } from '../stores';
import { useCommentsStore } from '@/features/comments';
import type { ParsedDiffLine, AlignedDiffLine } from '../types';

vi.mock('../stores', () => ({
  useDiffStore: vi.fn(),
}));

vi.mock('@/features/comments', () => ({
  useCommentsStore: vi.fn(),
}));

vi.mock('../utils', () => ({
  getDiffLinePosition: vi.fn((_lines: unknown[], index: number) => index + 1),
}));

describe('useDraftComment', () => {
  const mockAddComment = vi.fn();

  const mockDiffLines: ParsedDiffLine[] = [
    { content: 'context', type: 'context', oldLineNumber: 1, newLineNumber: 1 },
    { content: '+added', type: 'addition', oldLineNumber: null, newLineNumber: 2 },
    { content: '-deleted', type: 'deletion', oldLineNumber: 2, newLineNumber: null },
  ];

  const mockAlignedLines: AlignedDiffLine[] = [
    {
      key: 'line-0',
      left: { content: 'old', type: 'deletion', oldLineNumber: 1, newLineNumber: null },
      right: { content: 'new', type: 'addition', oldLineNumber: null, newLineNumber: 1 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddComment.mockResolvedValue({});

    vi.mocked(useDiffStore).mockReturnValue({
      selectedFileIndex: 0,
    } as ReturnType<typeof useDiffStore>);

    vi.mocked(useCommentsStore).mockReturnValue({
      addComment: mockAddComment,
    } as ReturnType<typeof useCommentsStore>);
  });

  it('returns initial state with no draft', () => {
    const { result } = renderHook(() => useDraftComment());

    expect(result.current.draftLineIndex).toBeNull();
    expect(result.current.draftSide).toBeNull();
    expect(result.current.draftBody).toBe('');
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.submitError).toBeNull();
  });

  it('startComment sets draft state', () => {
    const { result } = renderHook(() => useDraftComment());

    act(() => {
      result.current.startComment(1, 'RIGHT');
    });

    expect(result.current.draftLineIndex).toBe(1);
    expect(result.current.draftSide).toBe('RIGHT');
    expect(result.current.draftBody).toBe('');
  });

  it('setDraftBody updates draft body', () => {
    const { result } = renderHook(() => useDraftComment());

    act(() => {
      result.current.startComment(1, 'RIGHT');
    });

    act(() => {
      result.current.setDraftBody('Test comment');
    });

    expect(result.current.draftBody).toBe('Test comment');
  });

  it('cancelDraft clears all draft state', () => {
    const { result } = renderHook(() => useDraftComment());

    act(() => {
      result.current.startComment(1, 'RIGHT');
      result.current.setDraftBody('Test comment');
    });

    act(() => {
      result.current.cancelDraft();
    });

    expect(result.current.draftLineIndex).toBeNull();
    expect(result.current.draftSide).toBeNull();
    expect(result.current.draftBody).toBe('');
  });

  it('submitComment posts comment for inline view', async () => {
    const { result } = renderHook(() => useDraftComment());

    act(() => {
      result.current.startComment(1, 'RIGHT');
      result.current.setDraftBody('Test comment body');
    });

    await act(async () => {
      await result.current.submitComment(mockDiffLines, mockAlignedLines, 'test.ts', 'inline');
    });

    expect(mockAddComment).toHaveBeenCalledWith({
      path: 'test.ts',
      line: 2,
      side: 'RIGHT',
      body: 'Test comment body',
      position: 2,
    });

    // Draft should be cleared after successful submission
    expect(result.current.draftLineIndex).toBeNull();
    expect(result.current.draftBody).toBe('');
  });

  it('submitComment posts comment for split view', async () => {
    const { result } = renderHook(() => useDraftComment());

    act(() => {
      result.current.startComment(0, 'LEFT');
      result.current.setDraftBody('Left side comment');
    });

    await act(async () => {
      await result.current.submitComment(mockDiffLines, mockAlignedLines, 'test.ts', 'split');
    });

    expect(mockAddComment).toHaveBeenCalledWith({
      path: 'test.ts',
      line: 1,
      side: 'LEFT',
      body: 'Left side comment',
      position: 1,
    });
  });

  it('submitComment does nothing when no draft is active', async () => {
    const { result } = renderHook(() => useDraftComment());

    await act(async () => {
      await result.current.submitComment(mockDiffLines, mockAlignedLines, 'test.ts', 'inline');
    });

    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it('submitComment handles errors', async () => {
    mockAddComment.mockRejectedValueOnce(new Error('API error'));

    const { result } = renderHook(() => useDraftComment());

    act(() => {
      result.current.startComment(1, 'RIGHT');
      result.current.setDraftBody('Test comment');
    });

    await act(async () => {
      await result.current.submitComment(mockDiffLines, mockAlignedLines, 'test.ts', 'inline');
    });

    expect(result.current.submitError).toBe('API error');
    // Draft should NOT be cleared on error
    expect(result.current.draftLineIndex).toBe(1);
  });

  it('clears draft when selectedFileIndex changes', () => {
    let selectedFileIndex = 0;
    vi.mocked(useDiffStore).mockImplementation(() => ({
      selectedFileIndex,
    }) as ReturnType<typeof useDiffStore>);

    const { result, rerender } = renderHook(() => useDraftComment());

    act(() => {
      result.current.startComment(1, 'RIGHT');
      result.current.setDraftBody('Test comment');
    });

    expect(result.current.draftLineIndex).toBe(1);

    // Change file index
    selectedFileIndex = 1;
    vi.mocked(useDiffStore).mockReturnValue({
      selectedFileIndex,
    } as ReturnType<typeof useDiffStore>);

    rerender();

    // Draft should be cleared
    expect(result.current.draftLineIndex).toBeNull();
    expect(result.current.draftBody).toBe('');
  });

  it('trims whitespace from comment body on submit', async () => {
    const { result } = renderHook(() => useDraftComment());

    act(() => {
      result.current.startComment(1, 'RIGHT');
      result.current.setDraftBody('  Comment with spaces  ');
    });

    await act(async () => {
      await result.current.submitComment(mockDiffLines, mockAlignedLines, 'test.ts', 'inline');
    });

    expect(mockAddComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Comment with spaces',
      })
    );
  });

  it('sets isSubmitting during submission', async () => {
    let resolvePromise: () => void;
    const pendingPromise: Promise<void> = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockAddComment.mockReturnValue(pendingPromise);

    const { result } = renderHook(() => useDraftComment());

    act(() => {
      result.current.startComment(1, 'RIGHT');
      result.current.setDraftBody('Test');
    });

    // Start submission (don't await)
    act(() => {
      void result.current.submitComment(mockDiffLines, mockAlignedLines, 'test.ts', 'inline');
    });

    expect(result.current.isSubmitting).toBe(true);

    // Complete submission
    await act(async () => {
      resolvePromise();
      await pendingPromise;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('does nothing when draftSide is null', async () => {
    const { result } = renderHook(() => useDraftComment());

    // Only set line index, not side (invalid state)
    act(() => {
      result.current.startComment(1, 'RIGHT');
    });

    // Manually clear side to simulate edge case
    act(() => {
      result.current.cancelDraft();
      result.current.setDraftBody('Test');
    });

    await act(async () => {
      await result.current.submitComment(mockDiffLines, mockAlignedLines, 'test.ts', 'inline');
    });

    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it('handles non-Error error during submission', async () => {
    // Mock rejection with a non-Error value
    mockAddComment.mockRejectedValueOnce('String error');

    const { result } = renderHook(() => useDraftComment());

    act(() => {
      result.current.startComment(1, 'RIGHT');
      result.current.setDraftBody('Test');
    });

    await act(async () => {
      await result.current.submitComment(mockDiffLines, mockAlignedLines, 'test.ts', 'inline');
    });

    // Should use default error message
    expect(result.current.submitError).toBe('Failed to post comment');
  });

  it('uses left side line number for LEFT side comments', async () => {
    const { result } = renderHook(() => useDraftComment());

    act(() => {
      result.current.startComment(0, 'LEFT');
      result.current.setDraftBody('Left side comment');
    });

    await act(async () => {
      await result.current.submitComment(mockDiffLines, mockAlignedLines, 'test.ts', 'inline');
    });

    expect(mockAddComment).toHaveBeenCalledWith(
      expect.objectContaining({
        side: 'LEFT',
        line: 1, // oldLineNumber from context line
      })
    );
  });

  it('does nothing when target line number is null', async () => {
    const { result } = renderHook(() => useDraftComment());

    // Start comment on an added line but request LEFT side (which has null oldLineNumber)
    act(() => {
      result.current.startComment(1, 'LEFT');
      result.current.setDraftBody('Test');
    });

    await act(async () => {
      await result.current.submitComment(mockDiffLines, mockAlignedLines, 'test.ts', 'inline');
    });

    // Should not call addComment because oldLineNumber is null for addition line
    expect(mockAddComment).not.toHaveBeenCalled();
  });
});
