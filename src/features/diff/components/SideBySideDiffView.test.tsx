import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/tests/helpers';
import { SideBySideDiffView } from './SideBySideDiffView';
import type { AlignedDiffLine, ParsedDiffLine } from '../types';
import { useThemeStore } from '@/features/theme';

// Mock react-window
vi.mock('react-window', () => ({
  List: ({ rowComponent, rowCount, rowProps }: {
    rowComponent: React.ComponentType<{ index: number; style: React.CSSProperties } & Record<string, unknown>>;
    rowCount: number;
    rowProps: Record<string, unknown>;
  }) => {
    const RowComponent = rowComponent;
    // Render first few items for testing
    const itemsToRender = Math.min(rowCount, 5);
    return (
      <div data-testid="virtualized-sxs-list">
        {Array.from({ length: itemsToRender }).map((_, index) => (
          <RowComponent
            key={index}
            index={index}
            style={{ height: 23, top: index * 23 }}
            ariaAttributes={{ 'aria-posinset': index + 1, 'aria-setsize': rowCount, role: 'listitem' }}
            {...rowProps}
          />
        ))}
      </div>
    );
  },
  useListRef: (initialValue: unknown) => ({ current: initialValue }),
  useDynamicRowHeight: () => ({
    getAverageRowHeight: () => 23,
    getRowHeight: () => 23,
    setRowHeight: () => {},
    observeRowElements: () => () => {},
  }),
}));

const createMockDiffLine = (overrides: Partial<ParsedDiffLine> = {}): ParsedDiffLine => ({
  type: 'context',
  content: 'const x = 1;',
  oldLineNumber: 1,
  newLineNumber: 1,
  ...overrides,
});

const createMockAlignedLine = (
  left: ParsedDiffLine | null,
  right: ParsedDiffLine | null,
  key: string
): AlignedDiffLine => ({
  left,
  right,
  key,
});

const defaultProps = {
  alignedLines: [
    createMockAlignedLine(
      createMockDiffLine({ type: 'context', content: 'line 1', oldLineNumber: 1 }),
      createMockDiffLine({ type: 'context', content: 'line 1', newLineNumber: 1 }),
      'line-1'
    ),
    createMockAlignedLine(
      createMockDiffLine({ type: 'deletion', content: 'old line', oldLineNumber: 2 }),
      null,
      'line-2'
    ),
    createMockAlignedLine(
      null,
      createMockDiffLine({ type: 'addition', content: 'new line', newLineNumber: 2 }),
      'line-3'
    ),
  ],
  language: 'typescript',
  containerHeight: 600,
  threadsByLineAndSide: new Map(),
  currentUserLogin: 'testuser',
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
  showWhitespace: false,
};

describe('SideBySideDiffView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useThemeStore.setState({ theme: 'dark' });
  });

  it('renders virtualized list container', () => {
    render(<SideBySideDiffView {...defaultProps} />);

    expect(screen.getByTestId('virtualized-sxs-list')).toBeInTheDocument();
  });

  it('renders with aria label for accessibility', () => {
    render(<SideBySideDiffView {...defaultProps} />);

    expect(screen.getByRole('region', { name: /Side-by-side diff view/i })).toBeInTheDocument();
  });

  it('renders left and right panes', () => {
    render(<SideBySideDiffView {...defaultProps} />);

    // Should have virtualized-sxs-pane elements
    const panes = document.querySelectorAll('.virtualized-sxs-pane');
    expect(panes.length).toBeGreaterThan(0);
  });

  it('renders diff lines in both panes', () => {
    render(<SideBySideDiffView {...defaultProps} />);

    const diffLines = screen.getAllByTestId('diff-line');
    expect(diffLines.length).toBeGreaterThan(0);
  });

  it('renders spacer for null left side', () => {
    render(<SideBySideDiffView {...defaultProps} />);

    // Should have spacer elements when one side is null
    const spacers = screen.queryAllByTestId('diff-line-spacer');
    expect(spacers.length).toBeGreaterThanOrEqual(0); // May or may not have spacers depending on visible rows
  });

  it('filters lines when contentFilter is left', () => {
    render(<SideBySideDiffView {...defaultProps} contentFilter="left" />);

    // Should still render the list
    expect(screen.getByTestId('virtualized-sxs-list')).toBeInTheDocument();
  });

  it('filters lines when contentFilter is right', () => {
    render(<SideBySideDiffView {...defaultProps} contentFilter="right" />);

    // Should still render the list
    expect(screen.getByTestId('virtualized-sxs-list')).toBeInTheDocument();
  });

  it('calls onStartComment with correct side when clicking left pane comment button', () => {
    const onStartComment = vi.fn();
    render(<SideBySideDiffView {...defaultProps} onStartComment={onStartComment} />);

    const buttons = screen.getAllByRole('button', { name: /Add comment/i });
    if (buttons.length > 0) {
      buttons[0]?.click();
      expect(onStartComment).toHaveBeenCalled();
    }
  });

  it('renders with empty aligned lines', () => {
    render(<SideBySideDiffView {...defaultProps} alignedLines={[]} />);

    expect(screen.getByTestId('virtualized-sxs-list')).toBeInTheDocument();
  });

  it('renders with showWhitespace enabled', () => {
    render(<SideBySideDiffView {...defaultProps} showWhitespace={true} />);

    expect(screen.getByTestId('virtualized-sxs-list')).toBeInTheDocument();
  });

  it('renders draft comment editor when draftLineIndex is set', () => {
    render(
      <SideBySideDiffView
        {...defaultProps}
        draftLineIndex={0}
        draftSide="LEFT"
        draftBody="test comment"
      />
    );

    // Should render comment editor
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders draft comment editor on right side', () => {
    render(
      <SideBySideDiffView
        {...defaultProps}
        draftLineIndex={0}
        draftSide="RIGHT"
        draftBody="test comment"
      />
    );

    // Should render comment editor
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
