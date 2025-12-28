/**
 * Whitespace filtering utility (S-3.5)
 * Re-exports from diff-engine for main thread usage
 */

import { filterWhitespaceChanges } from '../workers/diff-engine';
import type { ParsedDiffLine, AlignedDiffLine } from '../types';

export { filterWhitespaceChanges };

/**
 * Filter whitespace changes from aligned diff lines
 * For use with side-by-side view
 */
export function filterAlignedWhitespace(
  alignedLines: AlignedDiffLine[]
): AlignedDiffLine[] {
  return alignedLines.filter((pair) => {
    const left = pair.left;
    const right = pair.right;

    // Keep headers and context
    if (left?.type === 'header' || right?.type === 'header') {
      return true;
    }
    if (left?.type === 'context' || right?.type === 'context') {
      return true;
    }

    // Check for whitespace-only modifications
    if (left && right) {
      // Both present = modification
      if (left.content.trim() === right.content.trim()) {
        // Only whitespace differs - treat as context
        return true; // Keep but will be shown as context
      }
    }

    // Check for whitespace-only additions/deletions
    if (left && !right && left.content.trim() === '') {
      return false; // Empty deletion
    }
    if (right && !left && right.content.trim() === '') {
      return false; // Empty addition
    }

    return true;
  }).map((pair): AlignedDiffLine => {
    // Don't convert headers or existing context lines
    if (pair.left?.type === 'header' || pair.right?.type === 'header') {
      return pair;
    }
    if (pair.left?.type === 'context' || pair.right?.type === 'context') {
      return pair;
    }

    // Convert whitespace-only changes to context
    if (pair.left && pair.right) {
      if (pair.left.content.trim() === pair.right.content.trim()) {
        const contextLine: ParsedDiffLine = {
          type: 'context',
          content: pair.right.content,
          oldLineNumber: pair.left.oldLineNumber,
          newLineNumber: pair.right.newLineNumber,
        };
        return {
          left: contextLine,
          right: contextLine,
          key: `ctx-ws-${pair.key}`,
        };
      }
    }
    return pair;
  });
}
