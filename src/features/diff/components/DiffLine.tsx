import type { ParsedDiffLine, WordDiffSegment } from '../types';
import { ShikiHighlighter } from './ShikiHighlighter';
import type { TokenSide } from './ShikiTokensContext';

interface DiffLineProps {
  line: ParsedDiffLine;
  language: string;
  /** Side of the diff for side-by-side view */
  side?: 'left' | 'right';
  /** Show only one line number column (for side-by-side) */
  singleLineNumber?: boolean;
  /** When true, render whitespace characters visibly (· for spaces, → for tabs) */
  showWhitespace?: boolean;
  /** Line number display mode for inline view with content filter (AC-3.3.14-15) */
  lineNumberMode?: 'left' | 'both' | 'right';
  /**
   * Line index for context-aware syntax highlighting (fallback mode).
   * Only used when hasFullContent is false.
   */
  lineIndex?: number;
  /**
   * Whether full file content is available for accurate token lookup.
   * When true, tokens are looked up by actual line number instead of array index.
   */
  hasFullContent?: boolean;
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
    <span className="diff-code" role="presentation">
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
  side,
  singleLineNumber = false,
  showWhitespace = false,
  lineNumberMode = 'both',
  lineIndex,
  hasFullContent = false,
}: DiffLineProps) {
  const hasWordDiff = line.wordDiff && line.wordDiff.length > 0;

  // Determine token lookup parameters based on line type
  // For deletions: use old line number and 'old' side
  // For additions/context: use new line number and 'new' side
  let tokenLineNumber: number | undefined;
  let tokenSide: TokenSide | undefined;

  if (hasFullContent) {
    if (line.type === 'deletion') {
      tokenLineNumber = line.oldLineNumber ?? undefined;
      tokenSide = 'old';
    } else {
      // additions and context use new side
      tokenLineNumber = line.newLineNumber ?? undefined;
      tokenSide = 'new';
    }
  }

  // For side-by-side, show the appropriate line number
  const displayLineNumber = side === 'left'
    ? line.oldLineNumber
    : side === 'right'
      ? line.newLineNumber
      : null;

  const rowClasses = ['diff-line', LINE_TYPE_CLASSES[line.type]].filter(Boolean).join(' ');
  const gutterClasses = ['diff-gutter', GUTTER_TYPE_CLASSES[line.type]].filter(Boolean).join(' ');

  return (
    <tr className={rowClasses} data-testid="diff-line" data-line-type={line.type} role="presentation">
      {/* Gutter columns - always two: annotation + line number */}
      <td className={`diff-gutter diff-gutter-annotation ${GUTTER_TYPE_CLASSES[line.type]}`} role="presentation" aria-hidden="true">
        {/* Annotation placeholder for future use (code coverage, lint markers) */}
      </td>
      <td className={gutterClasses} role="presentation" aria-hidden="true">
        {singleLineNumber ? (
          displayLineNumber ?? ''
        ) : lineNumberMode === 'left' ? (
          /* AC-3.3.14: Left filter shows only old line numbers */
          line.oldLineNumber ?? ''
        ) : (
          /* AC-3.3.15: Right filter and 'both' mode show new line numbers */
          line.newLineNumber ?? ''
        )}
      </td>

      {/* AC-1.4.9: Screen reader accessible */}
      {/* AC-3.4.6: Screen reader announces modifications */}
      <td className="diff-content" role="presentation">
        <span className="sr-only">
          {line.type === 'addition' && 'Added: '}
          {line.type === 'deletion' && 'Deleted: '}
          {hasWordDiff && 'Modified: '}
        </span>
        {/* AC-1.4.5: Syntax highlighting, AC-1.4.6: Preserve indentation */}
        {/* AC-3.4.1-2: Word-level diff highlighting */}
        {/* S-3.5: Show whitespace characters when enabled */}
        <span aria-hidden="true">
          {line.type === 'header' ? (
            <pre className="diff-code">{line.content}</pre>
          ) : hasWordDiff && line.wordDiff ? (
            <WordDiffContent segments={line.wordDiff} showWhitespace={showWhitespace} />
          ) : (
            <ShikiHighlighter
              code={line.content}
              language={language}
              showWhitespace={showWhitespace}
              {...(tokenLineNumber !== undefined && tokenSide !== undefined && {
                lineNumber: tokenLineNumber,
                side: tokenSide,
              })}
              {...(lineIndex !== undefined && { lineIndex })}
            />
          )}
        </span>
      </td>
    </tr>
  );
}

/**
 * Spacer row for side-by-side alignment (S-3.2: AC-3.2.5)
 */
export function DiffLineSpacer() {
  return (
    <tr className="diff-line diff-line-spacer" data-testid="diff-line-spacer" aria-hidden="true">
      <td className="diff-gutter diff-gutter-annotation diff-gutter-spacer" />
      <td className="diff-gutter diff-gutter-spacer" />
      <td className="diff-content">
        <span className="diff-code">&nbsp;</span>
      </td>
    </tr>
  );
}
