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

  // Visible whitespace tests (S-3.5)
  describe('visible whitespace', () => {
    it('renders spaces as visible dots when showWhitespace is true', () => {
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

      // Spaces should be replaced with visible dots
      expect(container.querySelector('.whitespace-visible')).toBeInTheDocument();
      expect(container.querySelector('.whitespace-visible')?.textContent).toBe('·');
    });

    it('renders tabs as visible arrows when showWhitespace is true', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: '\thello',
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

      // Tab should be replaced with visible arrow
      const whitespaceSpan = container.querySelector('.whitespace-visible');
      expect(whitespaceSpan).toBeInTheDocument();
      expect(whitespaceSpan?.textContent).toContain('→');
    });

    it('does not show visible whitespace when showWhitespace is false', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: 'hello world',
        oldLineNumber: 1,
        newLineNumber: 1,
      };

      const { container } = render(
        <table>
          <tbody>
            <DiffLine line={line} language="typescript" showWhitespace={false} />
          </tbody>
        </table>
      );

      expect(container.querySelector('.whitespace-visible')).not.toBeInTheDocument();
    });

    it('handles multiple spaces in content', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: 'foo  bar',
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

      const whitespaceSpans = container.querySelectorAll('.whitespace-visible');
      expect(whitespaceSpans).toHaveLength(2);
    });

    it('handles mixed spaces and tabs', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: '\t x',
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

      const whitespaceSpans = container.querySelectorAll('.whitespace-visible');
      expect(whitespaceSpans.length).toBeGreaterThan(0);
    });

    it('renders visible whitespace with word diff segments', () => {
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

      expect(container.querySelector('.whitespace-visible')).toBeInTheDocument();
    });

    it('preserves non-whitespace text correctly', () => {
      const line: ParsedDiffLine = {
        type: 'context',
        content: 'abc def',
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

      expect(container.textContent).toContain('abc');
      expect(container.textContent).toContain('def');
    });
  });

  // DiffLineSpacer tests
  describe('DiffLineSpacer', () => {
    it('renders a spacer row', async () => {
      const { DiffLineSpacer } = await import('./DiffLine');
      
      render(
        <table>
          <tbody>
            <DiffLineSpacer />
          </tbody>
        </table>
      );

      expect(screen.getByTestId('diff-line-spacer')).toBeInTheDocument();
    });

    it('has correct CSS classes', async () => {
      const { DiffLineSpacer } = await import('./DiffLine');
      
      render(
        <table>
          <tbody>
            <DiffLineSpacer />
          </tbody>
        </table>
      );

      const spacer = screen.getByTestId('diff-line-spacer');
      expect(spacer).toHaveClass('diff-line');
      expect(spacer).toHaveClass('diff-line-spacer');
    });
  });
});
