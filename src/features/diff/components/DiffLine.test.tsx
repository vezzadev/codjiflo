import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/tests/helpers';
import { DiffLine } from './DiffLine';
import type { ParsedDiffLine } from '../types';

// Mock react-syntax-highlighter - factory must use inline function
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

describe('DiffLine', () => {
  it('renders header line', () => {
    const line: ParsedDiffLine = {
      type: 'header',
      content: '@@ -1,3 +1,4 @@',
      oldLineNumber: null,
      newLineNumber: null,
    };

    render(
      <table>
        <tbody>
          <DiffLine line={line} language="typescript" />
        </tbody>
      </table>
    );

    expect(screen.getByText('@@ -1,3 +1,4 @@')).toBeInTheDocument();
  });

  it('renders addition line with new line number', () => {
    const line: ParsedDiffLine = {
      type: 'addition',
      content: 'const foo = "bar";',
      oldLineNumber: null,
      newLineNumber: 5,
    };

    render(
      <table>
        <tbody>
          <DiffLine line={line} language="typescript" />
        </tbody>
      </table>
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('const foo = "bar";')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('renders deletion line with old line number', () => {
    const line: ParsedDiffLine = {
      type: 'deletion',
      content: 'const old = "removed";',
      oldLineNumber: 3,
      newLineNumber: null,
    };

    render(
      <table>
        <tbody>
          <DiffLine line={line} language="typescript" />
        </tbody>
      </table>
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('−')).toBeInTheDocument();
  });

  it('renders context line with both line numbers', () => {
    const line: ParsedDiffLine = {
      type: 'context',
      content: 'unchanged line',
      oldLineNumber: 10,
      newLineNumber: 12,
    };

    render(
      <table>
        <tbody>
          <DiffLine line={line} language="typescript" />
        </tbody>
      </table>
    );

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('unchanged line')).toBeInTheDocument();
  });

  it('has screen reader accessible text for addition', () => {
    const line: ParsedDiffLine = {
      type: 'addition',
      content: 'new line',
      oldLineNumber: null,
      newLineNumber: 1,
    };

    render(
      <table>
        <tbody>
          <DiffLine line={line} language="typescript" />
        </tbody>
      </table>
    );

    expect(screen.getByText('Added:')).toBeInTheDocument();
  });

  it('has screen reader accessible text for deletion', () => {
    const line: ParsedDiffLine = {
      type: 'deletion',
      content: 'old line',
      oldLineNumber: 1,
      newLineNumber: null,
    };

    render(
      <table>
        <tbody>
          <DiffLine line={line} language="typescript" />
        </tbody>
      </table>
    );

    expect(screen.getByText('Deleted:')).toBeInTheDocument();
  });

  it('uses SyntaxHighlighter for non-header lines', () => {
    const line: ParsedDiffLine = {
      type: 'addition',
      content: 'const x = 1;',
      oldLineNumber: null,
      newLineNumber: 1,
    };

    render(
      <table>
        <tbody>
          <DiffLine line={line} language="typescript" />
        </tbody>
      </table>
    );

    expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
  });

  // Word-level diff tests (S-3.4)
  describe('word-level diff', () => {
    it('renders word diff segments instead of syntax highlighting when wordDiff is present', () => {
      const line: ParsedDiffLine = {
        type: 'addition',
        content: 'new value',
        oldLineNumber: null,
        newLineNumber: 1,
        wordDiff: [
          { text: 'new', type: 'added' },
          { text: ' value', type: 'unchanged' },
        ],
      };

      render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" />
          </tbody>
        </table>
      );

      // Word diff content should be present
      expect(screen.getByText('new')).toBeInTheDocument();
      // SyntaxHighlighter should not be used for word diffs
      expect(screen.queryByTestId('syntax-highlighter')).not.toBeInTheDocument();
    });

    it('applies correct styling to added segments', () => {
      const line: ParsedDiffLine = {
        type: 'addition',
        content: 'new value',
        oldLineNumber: null,
        newLineNumber: 1,
        wordDiff: [
          { text: 'new', type: 'added' },
          { text: ' value', type: 'unchanged' },
        ],
      };

      render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" />
          </tbody>
        </table>
      );

      const addedSegment = screen.getByText('new');
      expect(addedSegment).toHaveClass('word-diff-added');
    });

    it('applies correct styling to removed segments', () => {
      const line: ParsedDiffLine = {
        type: 'deletion',
        content: 'old value',
        oldLineNumber: 1,
        newLineNumber: null,
        wordDiff: [
          { text: 'old', type: 'removed' },
          { text: ' value', type: 'unchanged' },
        ],
      };

      render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" />
          </tbody>
        </table>
      );

      const removedSegment = screen.getByText('old');
      expect(removedSegment).toHaveClass('word-diff-removed');
    });

    it('has screen reader accessible text for modified lines', () => {
      const line: ParsedDiffLine = {
        type: 'addition',
        content: 'new value',
        oldLineNumber: null,
        newLineNumber: 1,
        wordDiff: [
          { text: 'new', type: 'added' },
          { text: ' value', type: 'unchanged' },
        ],
      };

      const { container } = render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" />
          </tbody>
        </table>
      );

      // Check that the sr-only span contains "Modified:" text
      const srOnlySpan = container.querySelector('.sr-only');
      expect(srOnlySpan?.textContent).toContain('Modified:');
    });
  });

  // Side-by-side mode tests (S-3.2)
  describe('side-by-side mode', () => {
    it('renders single line number column when singleLineNumber is true', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: 'unchanged',
        oldLineNumber: 5,
        newLineNumber: 10,
      };

      render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" side="left" singleLineNumber />
          </tbody>
        </table>
      );

      // Should only show old line number when side is left
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.queryByText('10')).not.toBeInTheDocument();
    });

    it('shows new line number when side is right', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: 'unchanged',
        oldLineNumber: 5,
        newLineNumber: 10,
      };

      render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" side="right" singleLineNumber />
          </tbody>
        </table>
      );

      // Should only show new line number when side is right
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });

    it('shows both line numbers in unified mode (no side prop)', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: 'unchanged',
        oldLineNumber: 5,
        newLineNumber: 10,
      };

      render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" />
          </tbody>
        </table>
      );

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  // Line number mode tests (AC-3.3.14-15)
  describe('lineNumberMode', () => {
    it('shows only old line number when lineNumberMode is left', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: 'unchanged',
        oldLineNumber: 5,
        newLineNumber: 10,
      };

      render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" lineNumberMode="left" />
          </tbody>
        </table>
      );

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.queryByText('10')).not.toBeInTheDocument();
    });

    it('shows only new line number when lineNumberMode is right', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: 'unchanged',
        oldLineNumber: 5,
        newLineNumber: 10,
      };

      render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" lineNumberMode="right" />
          </tbody>
        </table>
      );

      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });

    it('shows both line numbers when lineNumberMode is both (default)', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: 'unchanged',
        oldLineNumber: 5,
        newLineNumber: 10,
      };

      render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" lineNumberMode="both" />
          </tbody>
        </table>
      );

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('singleLineNumber takes precedence over lineNumberMode', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: 'unchanged',
        oldLineNumber: 5,
        newLineNumber: 10,
      };

      render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" side="left" singleLineNumber lineNumberMode="both" />
          </tbody>
        </table>
      );

      // singleLineNumber with side="left" should show only old line number
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.queryByText('10')).not.toBeInTheDocument();
    });
  });

  // Comment button tests
  describe('comment button', () => {
    it('shows comment button when showCommentButton is true', () => {
      const line: ParsedDiffLine = {
        type: 'addition',
        content: 'new line',
        oldLineNumber: null,
        newLineNumber: 1,
      };

      render(
        <table>
          <tbody>
            <DiffLine
              line={line}
              language="typescript"
              showCommentButton
              onStartComment={vi.fn()}
            />
          </tbody>
        </table>
      );

      expect(screen.getByRole('button', { name: 'Add comment' })).toBeInTheDocument();
    });

    it('does not show comment button for header lines', () => {
      const line: ParsedDiffLine = {
        type: 'header',
        content: '@@ -1,3 +1,4 @@',
        oldLineNumber: null,
        newLineNumber: null,
      };

      render(
        <table>
          <tbody>
            <DiffLine
              line={line}
              language="typescript"
              showCommentButton={false}
              onStartComment={vi.fn()}
            />
          </tbody>
        </table>
      );

      expect(screen.queryByRole('button', { name: 'Add comment' })).not.toBeInTheDocument();
    });
  });

  // Whitespace visibility tests (S-3.5)
  describe('showWhitespace', () => {
    it('renders visible spaces when showWhitespace is true', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: 'hello world',
        oldLineNumber: 1,
        newLineNumber: 1,
      };

      const { container } = render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" showWhitespace />
          </tbody>
        </table>
      );

      // Space should be replaced with middle dot character
      const whitespaceMarkers = container.querySelectorAll('.whitespace-visible');
      expect(whitespaceMarkers.length).toBe(1);
      expect(whitespaceMarkers[0]).toHaveTextContent('·');

      // Content container should include the text parts
      const diffCode = container.querySelector('.diff-code');
      expect(diffCode?.textContent).toContain('hello');
      expect(diffCode?.textContent).toContain('world');
    });

    it('renders visible tabs when showWhitespace is true', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: 'hello\tworld',
        oldLineNumber: 1,
        newLineNumber: 1,
      };

      const { container } = render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" showWhitespace />
          </tbody>
        </table>
      );

      // Tab should be replaced with arrow character followed by spaces
      const tabMarkers = container.querySelectorAll('.whitespace-visible');
      expect(tabMarkers.length).toBeGreaterThan(0);
      expect(tabMarkers[0]).toHaveTextContent('→');
    });

    it('renders multiple whitespace characters correctly', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: '  indented',
        oldLineNumber: 1,
        newLineNumber: 1,
      };

      const { container } = render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" showWhitespace />
          </tbody>
        </table>
      );

      // Should have two middle dots for the two leading spaces
      const whitespaceMarkers = container.querySelectorAll('.whitespace-visible');
      expect(whitespaceMarkers.length).toBe(2);
    });

    it('applies showWhitespace to word diff segments', () => {
      const line: ParsedDiffLine = {
        type: 'addition',
        content: 'new value',
        oldLineNumber: null,
        newLineNumber: 1,
        wordDiff: [
          { text: 'new', type: 'added' },
          { text: ' value', type: 'unchanged' },
        ],
      };

      const { container } = render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" showWhitespace />
          </tbody>
        </table>
      );

      // The space in " value" should be rendered with middle dot
      const whitespaceMarkers = container.querySelectorAll('.whitespace-visible');
      expect(whitespaceMarkers.length).toBeGreaterThan(0);
    });

    it('handles empty content with showWhitespace', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: '',
        oldLineNumber: 1,
        newLineNumber: 1,
      };

      const { container } = render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" showWhitespace />
          </tbody>
        </table>
      );

      // Should render without crashing
      expect(container.querySelector('.diff-content')).toBeInTheDocument();
    });

    it('preserves non-whitespace text when showWhitespace is true', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: 'const x = 1;',
        oldLineNumber: 1,
        newLineNumber: 1,
      };

      const { container } = render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" showWhitespace />
          </tbody>
        </table>
      );

      // Content should contain all non-whitespace text
      const diffCode = container.querySelector('.diff-code');
      expect(diffCode?.textContent).toContain('const');
      expect(diffCode?.textContent).toContain('x');
      expect(diffCode?.textContent).toContain('=');
      expect(diffCode?.textContent).toContain('1;');

      // Whitespace markers should be present for the 3 spaces
      const whitespaceMarkers = container.querySelectorAll('.whitespace-visible');
      expect(whitespaceMarkers.length).toBe(3);
    });
  });
});
