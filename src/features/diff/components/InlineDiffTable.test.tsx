import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/tests/helpers';
import { InlineDiffTable } from './InlineDiffTable';
import type { ParsedDiffLine } from '../types';
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
      <div data-testid="virtualized-list">
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
}));

const createMockDiffLine = (overrides: Partial<ParsedDiffLine> = {}): ParsedDiffLine => ({
  type: 'context',
  content: 'const x = 1;',
  oldLineNumber: 1,
  newLineNumber: 1,
  ...overrides,
});

const defaultProps = {
  diffLines: [
    createMockDiffLine({ type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 }),
    createMockDiffLine({ type: 'addition', content: 'line 2', oldLineNumber: null, newLineNumber: 2 }),
    createMockDiffLine({ type: 'deletion', content: 'line 3', oldLineNumber: 2, newLineNumber: null }),
  ],
  language: 'typescript',
  containerHeight: 600,
  threadsByLineAndSide: new Map(),
  currentUserLogin: 'testuser',
  addReply: vi.fn(),
  editComment: vi.fn(),
  deleteComment: vi.fn(),
  toggleResolved: vi.fn(),
  draftLineIndex: null,
  draftBody: '',
  isSubmittingDraft: false,
  submitError: null,
  onStartComment: vi.fn(),
  onCancelDraft: vi.fn(),
  onChangeDraftBody: vi.fn(),
  onSubmitDraft: vi.fn(),
  showWhitespace: false,
  lineNumberMode: 'both' as const,
};

describe('InlineDiffTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useThemeStore.setState({ theme: 'dark' });
  });

  it('renders virtualized list container', () => {
    render(<InlineDiffTable {...defaultProps} />);

    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
  });

  it('renders diff lines', () => {
    render(<InlineDiffTable {...defaultProps} />);

    // Should render the diff lines
    const diffLines = screen.getAllByTestId('diff-line');
    expect(diffLines.length).toBeGreaterThan(0);
  });

  it('renders addition lines with correct type', () => {
    render(<InlineDiffTable {...defaultProps} />);

    const lines = screen.getAllByTestId('diff-line');
    const additionLine = lines.find(el => el.getAttribute('data-line-type') === 'addition');

    expect(additionLine).toBeDefined();
  });

  it('renders deletion lines with correct type', () => {
    render(<InlineDiffTable {...defaultProps} />);

    const lines = screen.getAllByTestId('diff-line');
    const deletionLine = lines.find(el => el.getAttribute('data-line-type') === 'deletion');

    expect(deletionLine).toBeDefined();
  });

  it('shows comment button on hover for non-header lines', () => {
    render(<InlineDiffTable {...defaultProps} />);

    // Comment buttons should exist for diff lines (not headers)
    const buttons = screen.getAllByRole('button', { name: /Add comment/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('calls onStartComment when comment button is clicked', () => {
    const onStartComment = vi.fn();
    render(<InlineDiffTable {...defaultProps} onStartComment={onStartComment} />);

    const buttons = screen.getAllByRole('button', { name: /Add comment/i });
    buttons[0]?.click();

    expect(onStartComment).toHaveBeenCalled();
  });

  it('renders with empty diff lines', () => {
    render(<InlineDiffTable {...defaultProps} diffLines={[]} />);

    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
  });

  it('applies syntax highlighting', () => {
    render(<InlineDiffTable {...defaultProps} />);

    // The syntax highlighter should be rendering content
    const lines = screen.getAllByTestId('diff-line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders with lineNumberMode left', () => {
    render(<InlineDiffTable {...defaultProps} lineNumberMode="left" />);

    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
  });

  it('renders with lineNumberMode right', () => {
    render(<InlineDiffTable {...defaultProps} lineNumberMode="right" />);

    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
  });

  it('renders with showWhitespace enabled', () => {
    render(<InlineDiffTable {...defaultProps} showWhitespace={true} />);

    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
  });
});
