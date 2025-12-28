/**
 * Tests for SideBySideDiffView component (S-3.2)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/tests/helpers';
import userEvent from '@testing-library/user-event';
import { SideBySideDiffView } from './SideBySideDiffView';
import type { AlignedDiffLine, ParsedDiffLine } from '../types';
import type { ReviewThread } from '@/features/comments';

// Mock react-syntax-highlighter
vi.mock('react-syntax-highlighter', async () => {
  const React = await import('react');
  const MockComponent = ({ children }: { children: string }) =>
    React.createElement('span', { 'data-testid': 'syntax-highlighter' }, children);
  MockComponent.registerLanguage = vi.fn();
  return { Light: MockComponent };
});

// Mock language imports
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/typescript', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/javascript', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/python', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/json', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/css', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/xml', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/bash', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/markdown', () => ({ default: {} }));

// Mock CommentThread and CommentEditor
vi.mock('@/features/comments', () => ({
  CommentThread: ({ thread }: { thread: ReviewThread }) => (
    <div data-testid={`comment-thread-${thread.id}`}>Comment Thread</div>
  ),
  CommentEditor: ({
    onSubmit,
    onCancel,
    value,
    onChange,
  }: {
    onSubmit: () => void;
    onCancel: () => void;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div data-testid="comment-editor">
      <textarea data-testid="comment-textarea" value={value} onChange={(e) => onChange(e.target.value)} />
      <button onClick={onSubmit}>Submit</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

describe('SideBySideDiffView', () => {
  const defaultProps = {
    alignedLines: [] as AlignedDiffLine[],
    language: 'typescript',
    filename: 'test.ts',
    threadsByLineAndSide: new Map<string, ReviewThread[]>(),
    currentUserLogin: 'testuser',
    addComment: vi.fn(),
    addReply: vi.fn(),
    editComment: vi.fn(),
    deleteComment: vi.fn(),
    toggleResolved: vi.fn(),
    contentFilter: 'both' as const,
    draftLineIndex: null,
    draftSide: null,
    draftBody: '',
    isSubmittingDraft: false,
    submitError: null,
    onStartComment: vi.fn(),
    onCancelDraft: vi.fn(),
    onChangeDraftBody: vi.fn(),
    onSubmitDraft: vi.fn(),
  };

  const createContextLine = (old: number, newNum: number, content: string): ParsedDiffLine => ({
    type: 'context',
    content,
    oldLineNumber: old,
    newLineNumber: newNum,
  });

  const createDeletion = (lineNum: number, content: string): ParsedDiffLine => ({
    type: 'deletion',
    content,
    oldLineNumber: lineNum,
    newLineNumber: null,
  });

  const createAddition = (lineNum: number, content: string): ParsedDiffLine => ({
    type: 'addition',
    content,
    oldLineNumber: null,
    newLineNumber: lineNum,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('layout', () => {
    it('renders with correct role and aria-label', () => {
      render(<SideBySideDiffView {...defaultProps} />);
      expect(screen.getByRole('region', { name: 'Side-by-side diff view' })).toBeInTheDocument();
    });

    it('renders left pane with correct aria-label', () => {
      const alignedLines: AlignedDiffLine[] = [
        { left: createContextLine(1, 1, 'test'), right: createContextLine(1, 1, 'test'), key: 'ctx-1-1' },
      ];
      render(<SideBySideDiffView {...defaultProps} alignedLines={alignedLines} />);
      expect(screen.getByRole('region', { name: 'Original version' })).toBeInTheDocument();
    });

    it('renders right pane with correct aria-label', () => {
      const alignedLines: AlignedDiffLine[] = [
        { left: createContextLine(1, 1, 'test'), right: createContextLine(1, 1, 'test'), key: 'ctx-1-1' },
      ];
      render(<SideBySideDiffView {...defaultProps} alignedLines={alignedLines} />);
      expect(screen.getByRole('region', { name: 'Modified version' })).toBeInTheDocument();
    });
  });

  describe('content rendering', () => {
    it('renders context lines on both sides', () => {
      const contextLine = createContextLine(1, 1, 'unchanged content');
      const alignedLines: AlignedDiffLine[] = [
        { left: contextLine, right: contextLine, key: 'ctx-1-1' },
      ];

      render(<SideBySideDiffView {...defaultProps} alignedLines={alignedLines} />);

      // Should render content on both sides
      expect(screen.getAllByText('unchanged content')).toHaveLength(2);
    });

    it('renders deletion on left with spacer on right', () => {
      const deletion = createDeletion(1, 'removed line');
      const alignedLines: AlignedDiffLine[] = [
        { left: deletion, right: null, key: 'del-1' },
      ];

      render(<SideBySideDiffView {...defaultProps} alignedLines={alignedLines} />);

      expect(screen.getByText('removed line')).toBeInTheDocument();
      expect(screen.getByTestId('diff-line-spacer')).toBeInTheDocument();
    });

    it('renders addition on right with spacer on left', () => {
      const addition = createAddition(1, 'added line');
      const alignedLines: AlignedDiffLine[] = [
        { left: null, right: addition, key: 'add-1' },
      ];

      render(<SideBySideDiffView {...defaultProps} alignedLines={alignedLines} />);

      expect(screen.getByText('added line')).toBeInTheDocument();
      expect(screen.getByTestId('diff-line-spacer')).toBeInTheDocument();
    });

    it('renders modification with deletion on left and addition on right', () => {
      const deletion = createDeletion(1, 'old value');
      const addition = createAddition(1, 'new value');
      const alignedLines: AlignedDiffLine[] = [
        { left: deletion, right: addition, key: 'mod-1-1' },
      ];

      render(<SideBySideDiffView {...defaultProps} alignedLines={alignedLines} />);

      expect(screen.getByText('old value')).toBeInTheDocument();
      expect(screen.getByText('new value')).toBeInTheDocument();
    });
  });

  describe('content filter', () => {
    const createAlignedLinesWithAllTypes = (): AlignedDiffLine[] => {
      const context = createContextLine(1, 1, 'context');
      const deletion = createDeletion(2, 'deleted');
      const addition = createAddition(2, 'added');
      return [
        { left: context, right: context, key: 'ctx-1-1' },
        { left: deletion, right: null, key: 'del-2' },
        { left: null, right: addition, key: 'add-2' },
      ];
    };

    it('shows both panes when filter is "both"', () => {
      render(
        <SideBySideDiffView
          {...defaultProps}
          alignedLines={createAlignedLinesWithAllTypes()}
          contentFilter="both"
        />
      );

      expect(screen.getByRole('region', { name: 'Original version' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Modified version' })).toBeInTheDocument();
    });

    it('hides right pane when filter is "left"', () => {
      render(
        <SideBySideDiffView
          {...defaultProps}
          alignedLines={createAlignedLinesWithAllTypes()}
          contentFilter="left"
        />
      );

      expect(screen.getByRole('region', { name: 'Original version' })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Modified version' })).not.toBeInTheDocument();
    });

    it('hides left pane when filter is "right"', () => {
      render(
        <SideBySideDiffView
          {...defaultProps}
          alignedLines={createAlignedLinesWithAllTypes()}
          contentFilter="right"
        />
      );

      expect(screen.queryByRole('region', { name: 'Original version' })).not.toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Modified version' })).toBeInTheDocument();
    });

    it('filters out pure additions when filter is "left"', () => {
      render(
        <SideBySideDiffView
          {...defaultProps}
          alignedLines={createAlignedLinesWithAllTypes()}
          contentFilter="left"
        />
      );

      // The added line should not be visible
      expect(screen.queryByText('added')).not.toBeInTheDocument();
      // But deleted line should be visible
      expect(screen.getByText('deleted')).toBeInTheDocument();
    });

    it('filters out pure deletions when filter is "right"', () => {
      render(
        <SideBySideDiffView
          {...defaultProps}
          alignedLines={createAlignedLinesWithAllTypes()}
          contentFilter="right"
        />
      );

      // The deleted line should not be visible
      expect(screen.queryByText('deleted')).not.toBeInTheDocument();
      // But added line should be visible
      expect(screen.getByText('added')).toBeInTheDocument();
    });
  });

  describe('comments', () => {
    it('shows comment button on hover', () => {
      const contextLine = createContextLine(1, 1, 'test line');
      const alignedLines: AlignedDiffLine[] = [
        { left: contextLine, right: contextLine, key: 'ctx-1-1' },
      ];

      render(<SideBySideDiffView {...defaultProps} alignedLines={alignedLines} />);

      // Comment buttons exist but are hidden by CSS (opacity-0)
      const commentButtons = screen.getAllByRole('button', { name: 'Add comment' });
      expect(commentButtons.length).toBeGreaterThan(0);
    });

    it('calls onStartComment with correct index and side when clicking left pane comment button', async () => {
      const user = userEvent.setup();
      const contextLine = createContextLine(1, 1, 'test line');
      const alignedLines: AlignedDiffLine[] = [
        { left: contextLine, right: contextLine, key: 'ctx-1-1' },
      ];

      const onStartComment = vi.fn();
      render(
        <SideBySideDiffView
          {...defaultProps}
          alignedLines={alignedLines}
          onStartComment={onStartComment}
        />
      );

      // Get comment buttons (should have one per side per line)
      const commentButtons = screen.getAllByRole('button', { name: 'Add comment' });
      // Click the first one (left side)
      expect(commentButtons).toHaveLength(2);
      const [firstButton] = commentButtons;
      if (firstButton) await user.click(firstButton);

      expect(onStartComment).toHaveBeenCalledWith(0, 'LEFT');
    });

    it('calls onStartComment with correct index and side when clicking right pane comment button', async () => {
      const user = userEvent.setup();
      const contextLine = createContextLine(1, 1, 'test line');
      const alignedLines: AlignedDiffLine[] = [
        { left: contextLine, right: contextLine, key: 'ctx-1-1' },
      ];

      const onStartComment = vi.fn();
      render(
        <SideBySideDiffView
          {...defaultProps}
          alignedLines={alignedLines}
          onStartComment={onStartComment}
        />
      );

      const commentButtons = screen.getAllByRole('button', { name: 'Add comment' });
      // Click the second one (right side)
      expect(commentButtons).toHaveLength(2);
      const [, secondButton] = commentButtons;
      if (secondButton) await user.click(secondButton);

      expect(onStartComment).toHaveBeenCalledWith(0, 'RIGHT');
    });

    it('shows draft comment editor on left side', () => {
      const contextLine = createContextLine(1, 1, 'test line');
      const alignedLines: AlignedDiffLine[] = [
        { left: contextLine, right: contextLine, key: 'ctx-1-1' },
      ];

      render(
        <SideBySideDiffView
          {...defaultProps}
          alignedLines={alignedLines}
          draftLineIndex={0}
          draftSide="LEFT"
          draftBody="Test comment"
        />
      );

      expect(screen.getByTestId('comment-editor')).toBeInTheDocument();
    });

    it('shows draft comment editor on right side', () => {
      const contextLine = createContextLine(1, 1, 'test line');
      const alignedLines: AlignedDiffLine[] = [
        { left: contextLine, right: contextLine, key: 'ctx-1-1' },
      ];

      render(
        <SideBySideDiffView
          {...defaultProps}
          alignedLines={alignedLines}
          draftLineIndex={0}
          draftSide="RIGHT"
          draftBody="Test comment"
        />
      );

      expect(screen.getByTestId('comment-editor')).toBeInTheDocument();
    });

    it('renders existing comment threads on correct side', () => {
      const contextLine = createContextLine(1, 1, 'test line');
      const alignedLines: AlignedDiffLine[] = [
        { left: contextLine, right: contextLine, key: 'ctx-1-1' },
      ];

      const thread: ReviewThread = {
        id: 'thread-1',
        path: 'test.ts',
        line: 1,
        side: 'RIGHT',
        isResolved: false,
        comments: [
          {
            id: 'comment-1',
            body: 'Test comment',
            author: { id: 'user-1', login: 'user1', avatarUrl: '' },
            createdAt: new Date(),
            updatedAt: new Date(),
            path: 'test.ts',
            line: 1,
            side: 'RIGHT',
            position: 1,
          },
        ],
      };

      const threadsByLineAndSide = new Map<string, ReviewThread[]>();
      threadsByLineAndSide.set('1-RIGHT', [thread]);

      render(
        <SideBySideDiffView
          {...defaultProps}
          alignedLines={alignedLines}
          threadsByLineAndSide={threadsByLineAndSide}
        />
      );

      expect(screen.getByTestId('comment-thread-thread-1')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays submit error when present', () => {
      const contextLine = createContextLine(1, 1, 'test line');
      const alignedLines: AlignedDiffLine[] = [
        { left: contextLine, right: contextLine, key: 'ctx-1-1' },
      ];

      render(
        <SideBySideDiffView
          {...defaultProps}
          alignedLines={alignedLines}
          draftLineIndex={0}
          draftSide="LEFT"
          submitError="Failed to submit comment"
        />
      );

      expect(screen.getByText('Failed to submit comment')).toBeInTheDocument();
    });
  });
});
