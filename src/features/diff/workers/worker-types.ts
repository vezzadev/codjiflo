/**
 * Type-safe Web Worker message protocol for diff computation
 * Used by both the worker and the client for type safety
 */

import type { ParsedDiffLine, WordDiffSegment } from '../types';

// ============================================================================
// Request Messages (Main Thread → Worker)
// ============================================================================

export type DiffWorkerRequest =
  | ComputeLineDiffRequest
  | ComputeWordDiffRequest
  | ComputeAlignmentRequest;

/**
 * Compute line-by-line diff between two file contents
 * Returns ParsedDiffLine[] suitable for rendering
 */
export interface ComputeLineDiffRequest {
  type: 'COMPUTE_LINE_DIFF';
  id: string;
  payload: {
    oldContent: string;
    newContent: string;
    ignoreWhitespace: boolean;
  };
}

/**
 * Compute word-level diff within a pair of lines
 * Used for highlighting specific changes within modified lines
 */
export interface ComputeWordDiffRequest {
  type: 'COMPUTE_WORD_DIFF';
  id: string;
  payload: {
    oldLine: string;
    newLine: string;
  };
}

/**
 * Compute alignment for side-by-side view
 * Inserts spacers to keep corresponding lines aligned
 */
export interface ComputeAlignmentRequest {
  type: 'COMPUTE_ALIGNMENT';
  id: string;
  payload: {
    diffLines: ParsedDiffLine[];
  };
}

// ============================================================================
// Response Messages (Worker → Main Thread)
// ============================================================================

export type DiffWorkerResponse =
  | LineDiffResponse
  | WordDiffResponse
  | AlignmentResponse
  | ErrorResponse;

export interface LineDiffResponse {
  type: 'LINE_DIFF_RESULT';
  id: string;
  payload: {
    lines: ParsedDiffLine[];
  };
}

export interface WordDiffResponse {
  type: 'WORD_DIFF_RESULT';
  id: string;
  payload: {
    oldSegments: WordDiffSegment[];
    newSegments: WordDiffSegment[];
  };
}

/**
 * Aligned line pairs for side-by-side rendering
 */
export interface AlignedDiffPair {
  left: ParsedDiffLine | null; // null = spacer
  right: ParsedDiffLine | null; // null = spacer
  key: string; // Unique key for React rendering
}

export interface AlignmentResponse {
  type: 'ALIGNMENT_RESULT';
  id: string;
  payload: {
    pairs: AlignedDiffPair[];
  };
}

export interface ErrorResponse {
  type: 'ERROR';
  id: string;
  payload: {
    message: string;
  };
}
