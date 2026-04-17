import type { ParsedDiffLine } from '../types';

/**
 * Parses a git inline diff patch into structured lines
 * @param patch - The patch string from GitHub API
 * @returns Array of parsed diff lines with line numbers and types
 */
export function parsePatch(patch: string): ParsedDiffLine[] {
  if (!patch) return [];

  const lines: ParsedDiffLine[] = [];
  const patchLines = patch.split('\n');

  let oldLineNumber = 0;
  let newLineNumber = 0;

  for (const line of patchLines) {
    // Skip empty lines at end
    if (line === '' && lines.length > 0) continue;

    // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    if (line.startsWith('@@')) {
      const regex = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
      const match = regex.exec(line);
      if (match?.[1] && match[2]) {
        oldLineNumber = parseInt(match[1], 10);
        newLineNumber = parseInt(match[2], 10);
      }
      lines.push({
        type: 'header',
        content: line,
        oldLineNumber: null,
        newLineNumber: null,
      });
      continue;
    }

    // Added line
    if (line.startsWith('+')) {
      lines.push({
        type: 'addition',
        content: line.slice(1),
        oldLineNumber: null,
        newLineNumber: newLineNumber++,
      });
      continue;
    }

    // Deleted line
    if (line.startsWith('-')) {
      lines.push({
        type: 'deletion',
        content: line.slice(1),
        oldLineNumber: oldLineNumber++,
        newLineNumber: null,
      });
      continue;
    }

    // Context line (starts with space)
    lines.push({
      type: 'context',
      content: line.startsWith(' ') ? line.slice(1) : line,
      oldLineNumber: oldLineNumber++,
      newLineNumber: newLineNumber++,
    });
  }

  return lines;
}

/**
 * Extracts file extension for syntax highlighting.
 * Returns the lowercased extension which Shiki resolves to the correct language
 * via its built-in alias system (e.g., 'ts' → 'typescript', 'py' → 'python').
 *
 * @param filename - The file name with extension
 * @returns File extension (lowercased) or 'txt' for unknown/missing extensions
 */
export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  // Return extension if present, 'txt' otherwise (Shiki treats 'txt' as plaintext)
  return ext && ext !== filename.toLowerCase() ? ext : 'txt';
}
