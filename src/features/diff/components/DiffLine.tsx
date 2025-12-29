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
import { cn } from '@/utils/cn';
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

const LINE_STYLES = {
  addition: 'bg-green-50',
  deletion: 'bg-red-50',
  context: 'bg-white',
  header: 'bg-gray-100 text-gray-600 font-semibold',
};

const GUTTER_STYLES = {
  addition: 'text-green-700 bg-green-100',
  deletion: 'text-red-700 bg-red-100',
  context: 'text-gray-500 bg-gray-50',
  header: 'text-gray-500 bg-gray-100',
};

const LINE_MARKERS = {
  addition: '+',
  deletion: '−',
  context: ' ',
  header: '',
};

// Word-level diff segment styles (S-3.4: AC-3.4.1, AC-3.4.2)
const WORD_DIFF_STYLES: Record<WordDiffSegment['type'], string> = {
  added: 'bg-green-300 dark:bg-green-700',
  removed: 'bg-red-300 dark:bg-red-700',
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
          <span key={i} className="text-gray-400 opacity-60">·</span>
        );
      } else {
        // char === '\t'
        parts.push(
          <span key={i} className="text-gray-400 opacity-60">→{'   '}</span>
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
    <span className="font-mono text-sm whitespace-pre">
      {segments.map((segment, index) => (
        <span
          key={index}
          className={cn(WORD_DIFF_STYLES[segment.type])}
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

  return (
    <tr className={cn('group hover:brightness-95', LINE_STYLES[line.type])} data-testid="diff-line">
      {/* Line numbers - show one or two columns based on mode */}
      {singleLineNumber ? (
        <td
          className={cn(
            'px-2 py-0.5 text-right text-xs select-none w-12 border-r border-gray-200',
            GUTTER_STYLES[line.type]
          )}
        >
          {displayLineNumber ?? ''}
        </td>
      ) : lineNumberMode === 'left' ? (
        /* AC-3.3.14: Left filter shows only old line numbers */
        <td
          className={cn(
            'px-2 py-0.5 text-right text-xs select-none w-12 border-r border-gray-200',
            GUTTER_STYLES[line.type]
          )}
        >
          {line.oldLineNumber ?? ''}
        </td>
      ) : lineNumberMode === 'right' ? (
        /* AC-3.3.15: Right filter shows only new line numbers */
        <td
          className={cn(
            'px-2 py-0.5 text-right text-xs select-none w-12 border-r border-gray-200',
            GUTTER_STYLES[line.type]
          )}
        >
          {line.newLineNumber ?? ''}
        </td>
      ) : (
        <>
          {/* AC-1.4.4: Line numbers - both mode shows old and new */}
          <td
            className={cn(
              'px-2 py-0.5 text-right text-xs select-none w-12 border-r border-gray-200',
              GUTTER_STYLES[line.type]
            )}
          >
            {line.oldLineNumber ?? ''}
          </td>
          <td
            className={cn(
              'px-2 py-0.5 text-right text-xs select-none w-12 border-r border-gray-200',
              GUTTER_STYLES[line.type]
            )}
          >
            {line.newLineNumber ?? ''}
          </td>
        </>
      )}

      {/* AC-1.4.10: +/- markers for accessibility */}
      <td className="relative px-1 py-0.5 text-center select-none w-8 text-xs font-mono">
        <span aria-hidden="true">{LINE_MARKERS[line.type]}</span>
        {showCommentButton && onStartComment && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100">
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
      <td className="py-0.5 overflow-hidden pl-2 pr-4">
        <span className="sr-only">
          {line.type === 'addition' && 'Added: '}
          {line.type === 'deletion' && 'Deleted: '}
          {hasWordDiff && 'Modified: '}
        </span>
        {/* AC-1.4.5: Syntax highlighting, AC-1.4.6: Preserve indentation */}
        {/* AC-3.4.1-2: Word-level diff highlighting */}
        {/* S-3.5: Show whitespace characters when enabled */}
        {line.type === 'header' ? (
          <pre className="font-mono text-sm whitespace-pre m-0">{line.content}</pre>
        ) : hasWordDiff && line.wordDiff ? (
          <WordDiffContent segments={line.wordDiff} showWhitespace={showWhitespace} />
        ) : showWhitespace ? (
          <span className="font-mono text-sm whitespace-pre">
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
    <tr className="bg-gray-100" data-testid="diff-line-spacer">
      <td className="px-2 py-0.5 text-right text-xs select-none w-12 border-r border-gray-200 bg-gray-100" />
      <td className="relative px-1 py-0.5 text-center select-none w-8 text-xs font-mono bg-gray-100" />
      <td className="py-0.5 overflow-hidden pl-2 pr-4 bg-gray-100">
        <span className="font-mono text-sm text-gray-400">&nbsp;</span>
      </td>
    </tr>
  );
}
