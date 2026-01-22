/**
 * Search Engine
 *
 * Core search algorithm supporting match case, whole word, and regex modes.
 */

import type { SearchOptions, SearchMatch, SideFilter } from '../types';

export interface SearchResult {
  lineIndex: number;
  columnStart: number;
  columnEnd: number;
  lineContent: string;
}

/**
 * Create a search regex from the query and options
 */
export function createSearchRegex(
  query: string,
  options: SearchOptions
): RegExp | null {
  if (!query) return null;

  try {
    let pattern: string;

    if (options.useRegex) {
      pattern = query;
    } else {
      // Escape regex special characters for literal search
      pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    if (options.matchWholeWord) {
      pattern = `\\b${pattern}\\b`;
    }

    const flags = options.matchCase ? 'g' : 'gi';
    return new RegExp(pattern, flags);
  } catch {
    // Invalid regex pattern
    return null;
  }
}

/**
 * Execute search on content and return all matches
 */
export function executeSearch(
  query: string,
  content: string,
  options: SearchOptions
): SearchResult[] {
  const regex = createSearchRegex(query, options);
  if (!regex) return [];

  const results: SearchResult[] = [];
  const lines = content.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (line === undefined) continue;

    regex.lastIndex = 0;

    let match;
    while ((match = regex.exec(line)) !== null) {
      results.push({
        lineIndex: lineIdx,
        columnStart: match.index,
        columnEnd: match.index + match[0].length,
        lineContent: line,
      });

      // Prevent infinite loop on zero-length matches
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }
  }

  return results;
}

/**
 * Search in diff lines with side filtering
 */
export function searchInDiffLines(
  query: string,
  diffLines: { content: string; type: string }[],
  options: SearchOptions,
  sideFilter: SideFilter
): SearchMatch[] {
  const regex = createSearchRegex(query, options);
  if (!regex) return [];

  const matches: SearchMatch[] = [];

  for (let lineIdx = 0; lineIdx < diffLines.length; lineIdx++) {
    const diffLine = diffLines[lineIdx];
    if (!diffLine) continue;

    const lineContent = diffLine.content;

    // Determine the side based on line type
    let side: 'left' | 'right' | 'both';
    if (diffLine.type === 'delete') {
      side = 'left';
    } else if (diffLine.type === 'add') {
      side = 'right';
    } else {
      side = 'both';
    }

    // Apply side filter
    if (sideFilter === 'left' && side === 'right') continue;
    if (sideFilter === 'right' && side === 'left') continue;

    // Skip hunk headers
    if (diffLine.type === 'hunk') continue;

    regex.lastIndex = 0;

    let match;
    while ((match = regex.exec(lineContent)) !== null) {
      matches.push({
        lineIndex: lineIdx,
        columnStart: match.index,
        columnEnd: match.index + match[0].length,
        lineContent,
        side,
      });

      // Prevent infinite loop on zero-length matches
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }
  }

  return matches;
}

/**
 * Check if a file path matches a filter pattern
 */
export function matchesFileFilter(
  path: string,
  filter: string,
  useRegex: boolean
): boolean {
  if (!filter) return true;

  try {
    if (useRegex) {
      const regex = new RegExp(filter, 'i');
      return regex.test(path);
    }
    // Simple substring match (case-insensitive)
    return path.toLowerCase().includes(filter.toLowerCase());
  } catch {
    // Invalid regex
    return false;
  }
}
