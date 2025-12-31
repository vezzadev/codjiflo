/**
 * Core diff computation algorithms using diff-match-patch
 * Pure functions for computing line-level and word-level diffs
 * These run in the Web Worker for performance
 */

import DiffMatchPatch from 'diff-match-patch';
import type { ParsedDiffLine, WordDiffSegment, AlignedDiffLine } from '../types';

const dmp = new DiffMatchPatch();

// ============================================================================
// Line-Level Diff Computation (S-3.0, S-3.1)
// ============================================================================

/**
 * Compute line-by-line diff between two file contents
 * Returns ParsedDiffLine[] suitable for rendering
 */
export function computeLineDiff(
  oldContent: string,
  newContent: string,
  ignoreWhitespace: boolean
): ParsedDiffLine[] {
  // Normalize line endings and optionally strip whitespace
  const normalizeContent = (content: string): string => {
    let normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (ignoreWhitespace) {
      // Normalize whitespace but preserve line structure
      normalized = normalized
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .join('\n');
    }
    return normalized;
  };

  const oldNormalized = normalizeContent(oldContent);
  const newNormalized = normalizeContent(newContent);

  // Use diff-match-patch's line-level diff
  const lineArray = dmp.diff_linesToChars_(oldNormalized, newNormalized);
  const diffs = dmp.diff_main(lineArray.chars1, lineArray.chars2, false);
  dmp.diff_charsToLines_(diffs, lineArray.lineArray);
  // Note: We intentionally skip diff_cleanupSemantic for line-level diffs
  // to match GitHub's line counting behavior. Semantic cleanup regroups
  // changes in ways that inflate addition/deletion counts.

  const result: ParsedDiffLine[] = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const [op, text] of diffs) {
    // Handle trailing newline case
    const effectiveLines = text.endsWith('\n')
      ? text.slice(0, -1).split('\n')
      : text.split('\n');

    for (const lineContent of effectiveLines) {
      if (op === DiffMatchPatch.DIFF_DELETE) {
        result.push({
          type: 'deletion',
          content: lineContent,
          oldLineNumber: oldLineNum++,
          newLineNumber: null,
        });
      } else if (op === DiffMatchPatch.DIFF_INSERT) {
        result.push({
          type: 'addition',
          content: lineContent,
          oldLineNumber: null,
          newLineNumber: newLineNum++,
        });
      } else {
        // DIFF_EQUAL - context line
        result.push({
          type: 'context',
          content: lineContent,
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        });
      }
    }
  }

  return result;
}

// ============================================================================
// Word-Level Diff Computation (S-3.4)
// ============================================================================

/**
 * Compute word-level diff within a pair of lines
 * Used for highlighting specific changes within modified lines
 */
export function computeWordDiff(
  oldLine: string,
  newLine: string
): { oldSegments: WordDiffSegment[]; newSegments: WordDiffSegment[] } {
  const diffs = dmp.diff_main(oldLine, newLine);
  dmp.diff_cleanupSemantic(diffs);

  const oldSegments: WordDiffSegment[] = [];
  const newSegments: WordDiffSegment[] = [];

  for (const [op, text] of diffs) {
    if (op === DiffMatchPatch.DIFF_DELETE) {
      oldSegments.push({ text, type: 'removed' });
    } else if (op === DiffMatchPatch.DIFF_INSERT) {
      newSegments.push({ text, type: 'added' });
    } else {
      // DIFF_EQUAL - unchanged
      oldSegments.push({ text, type: 'unchanged' });
      newSegments.push({ text, type: 'unchanged' });
    }
  }

  return { oldSegments, newSegments };
}

/**
 * Detect modified line pairs (consecutive delete+add) and compute word diffs
 * Enhances ParsedDiffLine[] with wordDiff property
 */
export function enhanceWithWordDiffs(lines: ParsedDiffLine[]): ParsedDiffLine[] {
  const result: ParsedDiffLine[] = [];
  let i = 0;

  while (i < lines.length) {
    const current = lines[i];
    if (!current) {
      i++;
      continue;
    }

    // Look for consecutive deletion followed by addition (modified line pattern)
    const nextLine = lines[i + 1];
    if (
      current.type === 'deletion' &&
      i + 1 < lines.length &&
      nextLine?.type === 'addition'
    ) {
      const deletion = current;
      const addition = nextLine;

      // Compute word-level diff
      const { oldSegments, newSegments } = computeWordDiff(
        deletion.content,
        addition.content
      );

      result.push({
        ...deletion,
        wordDiff: oldSegments,
      });
      result.push({
        ...addition,
        wordDiff: newSegments,
      });
      i += 2;
    } else {
      result.push(current);
      i++;
    }
  }

  return result;
}

// ============================================================================
// Side-by-Side Alignment (S-3.2)
// ============================================================================

/**
 * Compute alignment for side-by-side view
 * Inserts spacers to keep corresponding lines aligned
 */
export function computeAlignment(diffLines: ParsedDiffLine[]): AlignedDiffLine[] {
  const result: AlignedDiffLine[] = [];
  let i = 0;
  let pairIndex = 0;

  while (i < diffLines.length) {
    const line = diffLines[i];
    if (!line) {
      i++;
      continue;
    }

    switch (line.type) {
      case 'header':
        // Headers span both sides
        result.push({
          left: line,
          right: line,
          key: `header-${pairIndex++}`,
        });
        i++;
        break;

      case 'context':
        // Context lines appear on both sides
        result.push({
          left: line,
          right: line,
          key: `ctx-${line.oldLineNumber}-${line.newLineNumber}`,
        });
        i++;
        break;

      case 'deletion': {
        // Check for consecutive deletion-addition pairs (modifications)
        const nextLine = diffLines[i + 1];
        if (i + 1 < diffLines.length && nextLine?.type === 'addition') {
          // Modified line - show deletion on left, addition on right
          result.push({
            left: line,
            right: nextLine,
            key: `mod-${line.oldLineNumber}-${nextLine.newLineNumber}`,
          });
          i += 2;
        } else {
          // Pure deletion - show on left, spacer on right
          result.push({
            left: line,
            right: null,
            key: `del-${line.oldLineNumber}`,
          });
          i++;
        }
        break;
      }

      case 'addition':
        // Pure addition - spacer on left, addition on right
        result.push({
          left: null,
          right: line,
          key: `add-${line.newLineNumber}`,
        });
        i++;
        break;

      default:
        i++;
    }
  }

  return result;
}

// ============================================================================
// Whitespace Filtering (S-3.5)
// ============================================================================

/**
 * Filter out whitespace-only changes from diff lines
 * Keeps structure (headers) but removes lines where only whitespace changed
 */
export function filterWhitespaceChanges(lines: ParsedDiffLine[]): ParsedDiffLine[] {
  const result: ParsedDiffLine[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }

    // Always keep headers and context
    if (line.type === 'header' || line.type === 'context') {
      result.push(line);
      i++;
      continue;
    }

    // Check for whitespace-only deletions
    if (line.type === 'deletion') {
      // Look ahead for matching addition
      const nextLine = lines[i + 1];
      if (i + 1 < lines.length && nextLine?.type === 'addition') {
        const deletion = line;
        const addition = nextLine;

        // If only whitespace differs, convert both to context
        if (deletion.content.trim() === addition.content.trim()) {
          result.push({
            type: 'context',
            content: addition.content,
            oldLineNumber: deletion.oldLineNumber,
            newLineNumber: addition.newLineNumber,
          });
          i += 2;
          continue;
        }
      }
      // Check if deletion is only whitespace
      if (line.content.trim() === '') {
        i++;
        continue;
      }
    }

    // Check for whitespace-only additions
    if (line.type === 'addition' && line.content.trim() === '') {
      i++;
      continue;
    }

    result.push(line);
    i++;
  }

  return result;
}
