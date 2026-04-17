/**
 * SpanTracker Domain: Text Span Value Object
 *
 * Represents a range of text (character or line level).
 * Immutable value object with no infrastructure dependencies.
 */

/**
 * A span of text defined by start position and length.
 * Can represent character-level or line-level positions.
 */
export interface TextSpan {
  /** Start position (0-based for characters, 1-based for lines) */
  readonly start: number;
  /** Length of the span */
  readonly length: number;
}

/**
 * Create a TextSpan
 */
export function createSpan(start: number, length: number): TextSpan {
  if (length < 0) {
    throw new Error('TextSpan length cannot be negative');
  }
  return { start, length };
}

/**
 * Get the end position of a span (exclusive)
 */
export function spanEnd(span: TextSpan): number {
  return span.start + span.length;
}

/**
 * Check if two spans overlap
 */
export function spansOverlap(a: TextSpan, b: TextSpan): boolean {
  return a.start < spanEnd(b) && b.start < spanEnd(a);
}

/**
 * Check if span A contains span B entirely
 */
export function spanContains(container: TextSpan, contained: TextSpan): boolean {
  return container.start <= contained.start && spanEnd(contained) <= spanEnd(container);
}

/**
 * Create a span from start and end positions (end is exclusive)
 */
export function spanFromRange(start: number, end: number): TextSpan {
  return createSpan(start, end - start);
}

/**
 * Shift a span by an offset
 */
export function shiftSpan(span: TextSpan, offset: number): TextSpan {
  return createSpan(span.start + offset, span.length);
}

/**
 * Empty span at a specific position
 */
export function emptySpan(position: number): TextSpan {
  return createSpan(position, 0);
}

/**
 * Check if a span is empty (zero length)
 */
export function isEmptySpan(span: TextSpan): boolean {
  return span.length === 0;
}

/**
 * Line-based span for tracking comment positions
 */
export interface LineSpan {
  /** Start line (1-based) */
  readonly startLine: number;
  /** End line (1-based, inclusive) */
  readonly endLine: number;
}

/**
 * Create a LineSpan
 */
export function createLineSpan(startLine: number, endLine: number): LineSpan {
  if (startLine < 1 || endLine < 1) {
    throw new Error('Line numbers must be >= 1');
  }
  if (endLine < startLine) {
    throw new Error('End line must be >= start line');
  }
  return { startLine, endLine };
}

/**
 * Single line span
 */
export function singleLine(lineNumber: number): LineSpan {
  return createLineSpan(lineNumber, lineNumber);
}

/**
 * Number of lines in a span
 */
export function lineCount(span: LineSpan): number {
  return span.endLine - span.startLine + 1;
}

/**
 * Check if two line spans overlap
 */
export function lineSpansOverlap(a: LineSpan, b: LineSpan): boolean {
  return a.startLine <= b.endLine && b.startLine <= a.endLine;
}
