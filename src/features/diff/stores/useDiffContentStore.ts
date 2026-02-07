/**
 * Store for caching file content and computed diffs (S-3.1)
 * Designed for M4 compatibility - can be extended to read from SQLite artifacts
 */

import { create } from 'zustand';
import { githubBackends, GitHubAPIError } from '@/api';
import type { DiffContentState, FileContent, FullFileDiff, ParsedDiffLine, AlignedDiffLine } from '../types';
import { detectLanguage } from '../utils';

// Import diff functions (will be used when worker is not available)
import { computeLineDiff, enhanceWithWordDiffs, computeAlignment } from '../workers/diff-engine';

/**
 * Generate cache key for file content
 */
function contentCacheKey(owner: string, repo: string, path: string, ref: string): string {
  return `${owner}/${repo}/${path}@${ref}`;
}

/**
 * Generate cache key for full file diff
 */
function diffCacheKey(owner: string, repo: string, path: string, baseSHA: string, headSHA: string): string {
  return `${owner}/${repo}/${path}@${baseSHA}:${headSHA}`;
}

export const useDiffContentStore = create<DiffContentState>((set, get) => ({
  contentCache: new Map(),
  fullFileDiffs: new Map(),
  isLoadingContent: false,

  /**
   * Fetch file content at a specific ref (AC-3.1.1)
   * Caches the result for future use (AC-3.1.2)
   */
  fetchFileContent: async (owner, repo, path, ref): Promise<FileContent> => {
    const cacheKey = contentCacheKey(owner, repo, path, ref);
    const cached = get().contentCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    set({ isLoadingContent: true });

    try {
      const rawContent = await githubBackends.file.getFileContent(owner, repo, path, ref);

      const fileContent: FileContent = {
        path: rawContent.path,
        ref,
        content: rawContent.content,
        lines: rawContent.content.split('\n'),
        language: detectLanguage(path),
      };

      // Update cache
      set((state) => {
        const newCache = new Map(state.contentCache);
        newCache.set(cacheKey, fileContent);
        return {
          contentCache: newCache,
          isLoadingContent: false,
        };
      });

      return fileContent;
    } catch (err) {
      let message = 'Failed to load file content';

      if (err instanceof GitHubAPIError) {
        if (err.status === 404) {
          message = 'File not found at this version';
        } else if (err.status === 413) {
          message = 'File too large to display full content';
        } else {
          message = err.message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }

      set({ isLoadingContent: false });
      throw new Error(message);
    }
  },

  /**
   * Compute full file diff between base and head versions (S-3.1)
   * Uses Web Worker for heavy computation
   */
  computeFullFileDiff: async (owner, repo, path, baseSHA, headSHA, basePath?): Promise<FullFileDiff> => {
    const cacheKey = diffCacheKey(owner, repo, path, baseSHA, headSHA);
    const cached = get().fullFileDiffs.get(cacheKey);

    if (cached) {
      return cached;
    }

    set({ isLoadingContent: true });

    try {
      // Fetch both versions in parallel
      // For renamed files, basePath differs from path (the file was at a different location before)
      const [baseContent, headContent] = await Promise.all([
        get().fetchFileContent(owner, repo, basePath ?? path, baseSHA).catch(() => null),
        get().fetchFileContent(owner, repo, path, headSHA).catch(() => null),
      ]);

      // Compute diff
      let diffLines: ParsedDiffLine[] = [];
      let alignedLines: AlignedDiffLine[] = [];

      if (baseContent && headContent) {
        // Both versions exist - compute diff
        diffLines = computeLineDiff(
          baseContent.content,
          headContent.content,
          false // ignoreWhitespace is applied later
        );
        diffLines = enhanceWithWordDiffs(diffLines);
        alignedLines = computeAlignment(diffLines);
      } else if (headContent) {
        // New file - all lines are additions
        diffLines = headContent.lines.map((line, index): ParsedDiffLine => ({
          type: 'addition',
          content: line,
          oldLineNumber: null,
          newLineNumber: index + 1,
        }));
        alignedLines = diffLines.map((line, index) => ({
          left: null,
          right: line,
          key: `add-${index}`,
        }));
      } else if (baseContent) {
        // Deleted file - all lines are deletions
        diffLines = baseContent.lines.map((line, index): ParsedDiffLine => ({
          type: 'deletion',
          content: line,
          oldLineNumber: index + 1,
          newLineNumber: null,
        }));
        alignedLines = diffLines.map((line, index) => ({
          left: line,
          right: null,
          key: `del-${index}`,
        }));
      }

      const fullFileDiff: FullFileDiff = {
        base: baseContent,
        head: headContent,
        diffLines,
        alignedLines,
      };

      // Update cache
      set((state) => {
        const newCache = new Map(state.fullFileDiffs);
        newCache.set(cacheKey, fullFileDiff);
        return {
          fullFileDiffs: newCache,
          isLoadingContent: false,
        };
      });

      return fullFileDiff;
    } catch (err) {
      set({ isLoadingContent: false });
      throw err;
    }
  },

  /**
   * Clear all caches - called when switching PRs
   */
  clearCache: () => {
    set({
      contentCache: new Map(),
      fullFileDiffs: new Map(),
    });
  },
}));
