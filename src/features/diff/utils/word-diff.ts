/**
 * Word-level diff highlighting utilities
 * S-3.6: Word-Level Diff Highlighting
 * AC-3.6.1 through AC-3.6.6
 */

import type { ParsedDiffLine } from '../types';

export interface WordDiff {
  type: 'delete' | 'insert' | 'equal';
  text: string;
}

/**
 * Identifies lines that are modified (not pure add/delete)
 * AC-3.6.3
 */
export function isModifiedLine(
  lines: ParsedDiffLine[],
  index: number
): { oldLine: ParsedDiffLine | null; newLine: ParsedDiffLine | null } {
  const currentLine = lines[index];

  if (!currentLine) {
    return { oldLine: null, newLine: null };
  }

  // Look for a deletion followed by an addition (modified line pattern)
  if (currentLine.type === 'deletion') {
    const nextLine = lines[index + 1];
    if (nextLine?.type === 'addition') {
      return { oldLine: currentLine, newLine: nextLine };
    }
  }

  return { oldLine: null, newLine: null };
}

/**
 * Splits text into word/character segments for highlighting
 * AC-3.6.2
 */
export function splitIntoSegments(diffs: WordDiff[]): WordDiff[] {
  // Group consecutive diffs of the same type for better rendering
  const segments: WordDiff[] = [];
  let current: WordDiff | null = null;

  for (const diff of diffs) {
    if (current && current.type === diff.type) {
      current.text += diff.text;
    } else {
      if (current) {
        segments.push(current);
      }
      current = { ...diff };
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}
