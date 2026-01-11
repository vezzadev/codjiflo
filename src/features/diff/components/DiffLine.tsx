import { createElement } from 'react';
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
import { useSyntaxTheme } from '../hooks/useSyntaxTheme';

// Type for syntax highlighter renderer node (from @types/react-syntax-highlighter)
interface RendererNode {
  type: 'element' | 'text';
  value?: string | number;
  tagName?: keyof React.JSX.IntrinsicElements | React.ComponentType<unknown>;
  properties?: { className?: string[]; style?: React.CSSProperties; [key: string]: unknown };
  children?: RendererNode[];
}

interface RendererProps {
  rows: RendererNode[];
  stylesheet: Record<string, React.CSSProperties>;
  useInlineStyles: boolean;
}

// Custom renderer type to match react-syntax-highlighter's expectations
type CustomRenderer = (props: RendererProps) => React.ReactNode;

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
 * Create a React element from a renderer node, preserving inline styles.
 * This is the core rendering function used by createWhitespaceRenderer.
 */
function createElementFromNode(
  node: RendererNode,
  stylesheet: Record<string, React.CSSProperties>,
  useInlineStyles: boolean,
  key: string | number
): React.ReactNode {
  if (node.type === 'text') {
    return node.value;
  }

  const { tagName, properties, children } = node;
  if (!tagName) return null;

  // Build style from classNames if using inline styles (for syntax highlighting)
  let style = properties?.style ?? {};
  const classNames = properties?.className ?? [];

  // Check if this is a custom whitespace-visible element (not from syntax highlighter)
  const isWhitespaceElement = classNames.includes('whitespace-visible');

  if (useInlineStyles && classNames.length > 0 && !isWhitespaceElement) {
    // Only apply stylesheet mapping for syntax highlighter classes, not our custom classes
    const classStyles = classNames
      .map((className: string) => stylesheet[className])
      .filter((s): s is React.CSSProperties => Boolean(s));
    style = classStyles.reduce<React.CSSProperties>(
      (acc, classStyle) => ({ ...acc, ...classStyle }),
      { ...style }
    );
  }

  const elementProps: Record<string, unknown> = {
    key,
    style: useInlineStyles && !isWhitespaceElement ? style : undefined,
    // Always include className for whitespace elements; otherwise only when not using inline styles
    className: isWhitespaceElement || !useInlineStyles ? classNames.join(' ') || undefined : undefined,
  };

  const childElements = children?.map((child, i) =>
    createElementFromNode(child, stylesheet, useInlineStyles, `${String(key)}-${String(i)}`)
  );

  return createElement(tagName as string, elementProps, childElements);
}

/**
 * Transform a text node to include visible whitespace markers.
 * Returns an array of nodes: text nodes for regular content, element nodes for whitespace.
 */
function transformTextNodeForWhitespace(text: string): RendererNode[] {
  const result: RendererNode[] = [];
  let i = 0;
  let nonWsStart = 0;

  while (i < text.length) {
    const char = text[i];

    if (char === ' ' || char === '\t') {
      // Push any accumulated non-whitespace text
      if (i > nonWsStart) {
        result.push({
          type: 'text',
          value: text.slice(nonWsStart, i),
        });
      }

      // Add visible whitespace element
      result.push({
        type: 'element',
        tagName: 'span',
        properties: { className: ['whitespace-visible'] },
        children: [
          {
            type: 'text',
            value: char === ' ' ? '·' : '→   ',
          },
        ],
      });

      nonWsStart = i + 1;
    }
    i++;
  }

  // Push remaining non-whitespace text
  if (nonWsStart < text.length) {
    result.push({
      type: 'text',
      value: text.slice(nonWsStart),
    });
  }

  return result;
}

/**
 * Recursively transform a node tree to include visible whitespace.
 * Text nodes are transformed; element nodes recurse into children.
 */
function transformNodeForWhitespace(node: RendererNode): RendererNode[] {
  if (node.type === 'text') {
    const text = String(node.value ?? '');
    return transformTextNodeForWhitespace(text);
  }

  // Element node: recursively transform children
  if (node.children && node.children.length > 0) {
    const transformedChildren: RendererNode[] = [];
    for (const child of node.children) {
      transformedChildren.push(...transformNodeForWhitespace(child));
    }
    return [{
      ...node,
      children: transformedChildren,
    }];
  }

  return [node];
}

/**
 * Create a custom renderer that shows visible whitespace while preserving syntax highlighting.
 * This is used with react-syntax-highlighter's renderer prop.
 */
function createWhitespaceRenderer(showWhitespace: boolean): CustomRenderer {
  return ({ rows, stylesheet, useInlineStyles }: RendererProps) => {
    return rows.map((row, rowIndex) => {
      // If whitespace visibility is off, use standard rendering
      let transformedRow = row;
      if (showWhitespace) {
        // Transform the row to include visible whitespace
        const transformed = transformNodeForWhitespace(row);
        transformedRow = transformed[0] ?? row;
      }

      return createElementFromNode(
        transformedRow,
        stylesheet,
        useInlineStyles,
        `code-segment-${String(rowIndex)}`
      );
    });
  };
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
  const syntaxStyle = useSyntaxTheme();
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
        ) : (
          <SyntaxHighlighter
            language={language}
            style={syntaxStyle}
            useInlineStyles={true}
            customStyle={codeStyle}
            PreTag="span"
            CodeTag="span"
            renderer={createWhitespaceRenderer(showWhitespace) as never}
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
