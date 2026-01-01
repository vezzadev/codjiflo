import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import css from 'react-syntax-highlighter/dist/esm/languages/hljs/css';
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import markdown from 'react-syntax-highlighter/dist/esm/languages/hljs/markdown';
import type { ParsedDiffLine, WordDiffSegment } from '../types';
import { Button } from '@/components';

// Register languages for syntax highlighting
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('xml', xml);
SyntaxHighlighter.registerLanguage('html', xml);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('markdown', markdown);

interface DiffLineProps {
  line: ParsedDiffLine;
  language: string;
  onStartComment?: () => void;
  showCommentButton?: boolean;
  /** Side of the diff for side-by-side view */
  side?: 'left' | 'right';
  /** Show only one line number column (for side-by-side) */
  singleLineNumber?: boolean;
  /** When true, render whitespace characters visibly (· for spaces, → for tabs) */
  showWhitespace?: boolean;
  /** Line number display mode for unified view with content filter (AC-3.3.14-15) */
  lineNumberMode?: 'left' | 'both' | 'right';
}

const LINE_TYPE_CLASSES: Record<string, string> = {
  addition: 'diff-line-addition',
  deletion: 'diff-line-deletion',
  context: 'diff-line-context',
  header: 'diff-line-header',
};

const GUTTER_TYPE_CLASSES: Record<string, string> = {
  addition: 'diff-gutter-addition',
  deletion: 'diff-gutter-deletion',
  context: 'diff-gutter-context',
  header: 'diff-gutter-header',
};

const LINE_MARKERS = {
  addition: '+',
  deletion: '−',
  context: ' ',
  header: '',
};

// Word-level diff segment styles (S-3.4: AC-3.4.1, AC-3.4.2)
const WORD_DIFF_CLASSES: Record<WordDiffSegment['type'], string> = {
  added: 'word-diff-added',
  removed: 'word-diff-removed',
  unchanged: '',
};

/**
 * Render whitespace characters visibly (S-3.5)
 * Replaces spaces with · and tabs with → followed by spaces to maintain alignment
 */
function renderVisibleWhitespace(content: string): React.ReactNode {
  if (!content) return content;

  const parts: React.ReactNode[] = [];
  let i = 0;
  let nonWsStart = 0;

  while (i < content.length) {
    const char = content[i];

    if (char === ' ' || char === '\t') {
      // Push any accumulated non-whitespace text
      if (i > nonWsStart) {
        parts.push(content.slice(nonWsStart, i));
      }

      if (char === ' ') {
        parts.push(
          <span key={i} className="whitespace-visible">·</span>
        );
      } else {
        // char === '\t'
        parts.push(
          <span key={i} className="whitespace-visible">→{'   '}</span>
        );
      }

      nonWsStart = i + 1;
    }
    i++;
  }

  // Push remaining non-whitespace text
  if (nonWsStart < content.length) {
    parts.push(content.slice(nonWsStart));
  }

  return parts.length > 0 ? parts : content;
}

// Custom style to match diff view - minimal styling, let parent handle background
const codeStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  background: 'transparent',
  fontSize: '0.875rem',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  whiteSpace: 'pre',
  overflow: 'visible',
};

/**
 * Render content with word-level diff highlighting (S-3.4)
 * AC-3.4.1-2: Modified lines show lighter background with darker changed segments
 */
function WordDiffContent({
  segments,
  showWhitespace = false,
}: {
  segments: WordDiffSegment[];
  showWhitespace?: boolean;
}) {
  return (
    <span className="diff-code">
      {segments.map((segment, index) => (
        <span
          key={index}
          className={WORD_DIFF_CLASSES[segment.type]}
        >
          {showWhitespace ? renderVisibleWhitespace(segment.text) : segment.text}
        </span>
      ))}
    </span>
  );
}

/**
 * Single line in the diff view
 * S-1.4: AC-1.4.1 through AC-1.4.10
 * S-3.4: AC-3.4.1-6 (word-level diff highlighting)
 */
export function DiffLine({
  line,
  language,
  onStartComment,
  showCommentButton = false,
  side,
  singleLineNumber = false,
  showWhitespace = false,
  lineNumberMode = 'both',
}: DiffLineProps) {
  const hasWordDiff = line.wordDiff && line.wordDiff.length > 0;

  // For side-by-side, show the appropriate line number
  const displayLineNumber = side === 'left'
    ? line.oldLineNumber
    : side === 'right'
      ? line.newLineNumber
      : null;

  const rowClasses = ['diff-line', LINE_TYPE_CLASSES[line.type]].filter(Boolean).join(' ');
  const gutterClasses = ['diff-gutter', GUTTER_TYPE_CLASSES[line.type]].filter(Boolean).join(' ');

  return (
    <tr className={rowClasses} data-testid="diff-line" data-line-type={line.type}>
      {/* Line numbers - show one or two columns based on mode */}
      {singleLineNumber ? (
        <td className={gutterClasses}>
          {displayLineNumber ?? ''}
        </td>
      ) : lineNumberMode === 'left' ? (
        /* AC-3.3.14: Left filter shows only old line numbers */
        <td className={gutterClasses}>
          {line.oldLineNumber ?? ''}
        </td>
      ) : lineNumberMode === 'right' ? (
        /* AC-3.3.15: Right filter shows only new line numbers */
        <td className={gutterClasses}>
          {line.newLineNumber ?? ''}
        </td>
      ) : (
        <>
          {/* AC-1.4.4: Line numbers - both mode shows old and new */}
          <td className={gutterClasses}>
            {line.oldLineNumber ?? ''}
          </td>
          <td className={gutterClasses}>
            {line.newLineNumber ?? ''}
          </td>
        </>
      )}

      {/* AC-1.4.10: +/- markers for accessibility */}
      <td className="diff-marker">
        <span aria-hidden="true">{LINE_MARKERS[line.type]}</span>
        {showCommentButton && onStartComment && (
          <div className="diff-comment-btn">
            <Button
              label="+"
              variant="secondary"
              size="icon"
              ariaLabel="Add comment"
              onClick={onStartComment}
            />
          </div>
        )}
      </td>

      {/* AC-1.4.9: Screen reader accessible */}
      {/* AC-3.4.6: Screen reader announces modifications */}
      <td className="diff-content">
        <span className="sr-only">
          {line.type === 'addition' && 'Added: '}
          {line.type === 'deletion' && 'Deleted: '}
          {hasWordDiff && 'Modified: '}
        </span>
        {/* AC-1.4.5: Syntax highlighting, AC-1.4.6: Preserve indentation */}
        {/* AC-3.4.1-2: Word-level diff highlighting */}
        {/* S-3.5: Show whitespace characters when enabled */}
        {line.type === 'header' ? (
          <pre className="diff-code">{line.content}</pre>
        ) : hasWordDiff && line.wordDiff ? (
          <WordDiffContent segments={line.wordDiff} showWhitespace={showWhitespace} />
        ) : showWhitespace ? (
          <span className="diff-code">
            {renderVisibleWhitespace(line.content)}
          </span>
        ) : (
          <SyntaxHighlighter
            language={language}
            useInlineStyles={true}
            customStyle={codeStyle}
            PreTag="span"
            CodeTag="span"
          >
            {line.content}
          </SyntaxHighlighter>
        )}
      </td>
    </tr>
  );
}

/**
 * Spacer row for side-by-side alignment (S-3.2: AC-3.2.5)
 */
export function DiffLineSpacer() {
  return (
    <tr className="diff-line diff-line-spacer" data-testid="diff-line-spacer">
      <td className="diff-gutter diff-gutter-spacer" />
      <td className="diff-marker" />
      <td className="diff-content">
        <span className="diff-code">&nbsp;</span>
      </td>
    </tr>
  );
}
