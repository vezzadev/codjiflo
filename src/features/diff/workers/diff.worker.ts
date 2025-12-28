/**
 * Web Worker for diff computation
 * Offloads CPU-intensive diff operations from the main thread
 * S-3.0: AC-3.0.1, AC-3.0.2
 */

import {
  computeLineDiff,
  computeWordDiff,
  computeAlignment,
  enhanceWithWordDiffs,
} from './diff-engine';
import type { DiffWorkerRequest, DiffWorkerResponse } from './worker-types';

/**
 * Handle incoming messages from the main thread
 */
self.onmessage = (event: MessageEvent<DiffWorkerRequest>) => {
  const request = event.data;

  try {
    let response: DiffWorkerResponse;

    switch (request.type) {
      case 'COMPUTE_LINE_DIFF': {
        const { oldContent, newContent, ignoreWhitespace } = request.payload;
        let lines = computeLineDiff(oldContent, newContent, ignoreWhitespace);
        // Enhance with word-level diffs for modified line pairs
        lines = enhanceWithWordDiffs(lines);
        response = {
          type: 'LINE_DIFF_RESULT',
          id: request.id,
          payload: { lines },
        };
        break;
      }

      case 'COMPUTE_WORD_DIFF': {
        const { oldLine, newLine } = request.payload;
        const { oldSegments, newSegments } = computeWordDiff(oldLine, newLine);
        response = {
          type: 'WORD_DIFF_RESULT',
          id: request.id,
          payload: { oldSegments, newSegments },
        };
        break;
      }

      case 'COMPUTE_ALIGNMENT': {
        const { diffLines } = request.payload;
        const pairs = computeAlignment(diffLines);
        response = {
          type: 'ALIGNMENT_RESULT',
          id: request.id,
          payload: { pairs },
        };
        break;
      }

      default: {
        // Exhaustive check
        const _exhaustive: never = request;
        throw new Error(`Unknown request type: ${JSON.stringify(_exhaustive)}`);
      }
    }

    self.postMessage(response);
  } catch (error) {
    const errorResponse: DiffWorkerResponse = {
      type: 'ERROR',
      id: request.id,
      payload: {
        message: error instanceof Error ? error.message : 'Unknown error in diff worker',
      },
    };
    self.postMessage(errorResponse);
  }
};

// Signal that the worker is ready
self.postMessage({ type: 'READY' });
