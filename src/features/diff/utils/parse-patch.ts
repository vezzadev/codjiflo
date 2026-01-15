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
 * Detects programming language from filename extension
 * @param filename - The file name with extension
 * @returns Language identifier for syntax highlighting
 */
export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    'ts': 'typescript',
    'tsx': 'tsx',
    'js': 'javascript',
    'jsx': 'jsx',
    'mjs': 'javascript',
    'cjs': 'javascript',

    // Python
    'py': 'python',
    'pyw': 'python',

    // Web
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'css',
    'less': 'css',
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',

    // Other languages
    'java': 'java',
    'kt': 'kotlin',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'sql': 'sql',
    'md': 'markdown',
    'markdown': 'markdown',
  };

  return languageMap[ext ?? ''] ?? 'plaintext';
}
