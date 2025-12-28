/**
 * Hook for managing the diff Web Worker lifecycle and communication
 * Provides a Promise-based API for diff computations
 */

import { useCallback, useEffect } from 'react';
import type { ParsedDiffLine, WordDiffSegment } from '../types';
import type {
  DiffWorkerRequest,
  DiffWorkerResponse,
  AlignedDiffPair,
} from '../workers/worker-types';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface UseDiffWorkerReturn {
  /** Compute line-by-line diff between two file contents */
  computeLineDiff: (
    oldContent: string,
    newContent: string,
    ignoreWhitespace?: boolean
  ) => Promise<ParsedDiffLine[]>;

  /** Compute word-level diff within a pair of lines */
  computeWordDiff: (
    oldLine: string,
    newLine: string
  ) => Promise<{ oldSegments: WordDiffSegment[]; newSegments: WordDiffSegment[] }>;

  /** Compute alignment for side-by-side view */
  computeAlignment: (diffLines: ParsedDiffLine[]) => Promise<AlignedDiffPair[]>;
}

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 30000;

/** Generate unique request IDs */
let requestIdCounter = 0;
function generateRequestId(): string {
  return `req-${String(Date.now())}-${String(++requestIdCounter)}`;
}

/**
 * Singleton worker instance shared across all hook consumers
 */
let sharedWorker: Worker | null = null;
const sharedPendingRequests = new Map<string, PendingRequest>();
let sharedListenerCount = 0;

function getOrCreateWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(
      new URL('../workers/diff.worker.ts', import.meta.url),
      { type: 'module' }
    );

    sharedWorker.onmessage = (event: MessageEvent<DiffWorkerResponse | { type: 'READY' }>) => {
      const data = event.data;

      // Ignore READY message (used for initialization signaling)
      if ('type' in data && data.type === 'READY') {
        return;
      }

      const response = data;
      const pending = sharedPendingRequests.get(response.id);

      if (!pending) {
        console.warn(`Received response for unknown request: ${response.id}`);
        return;
      }

      sharedPendingRequests.delete(response.id);

      if (response.type === 'ERROR') {
        pending.reject(new Error(response.payload.message));
      } else {
        pending.resolve(response.payload);
      }
    };

    sharedWorker.onerror = (error) => {
      console.error('Diff worker error:', error);
      // Reject all pending requests
      sharedPendingRequests.forEach((pending) => {
        pending.reject(new Error('Worker error'));
      });
      sharedPendingRequests.clear();
    };
  }

  return sharedWorker;
}

function terminateWorkerIfUnused(): void {
  if (sharedListenerCount === 0 && sharedWorker) {
    sharedWorker.terminate();
    sharedWorker = null;
    sharedPendingRequests.clear();
  }
}

function sendRequest<T>(request: DiffWorkerRequest): Promise<T> {
  const worker = getOrCreateWorker();

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      sharedPendingRequests.delete(request.id);
      reject(new Error(`Request ${request.id} timed out after ${String(REQUEST_TIMEOUT_MS)}ms`));
    }, REQUEST_TIMEOUT_MS);

    sharedPendingRequests.set(request.id, {
      resolve: (value) => {
        clearTimeout(timeoutId);
        resolve(value as T);
      },
      reject: (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    });

    worker.postMessage(request);
  });
}

/**
 * Hook for interacting with the diff Web Worker
 * The worker is shared across all hook consumers and terminated when unused
 */
export function useDiffWorker(): UseDiffWorkerReturn {
  useEffect(() => {
    // Ensure worker is created
    getOrCreateWorker();
    sharedListenerCount++;

    return () => {
      sharedListenerCount--;
      // Delay termination to allow for quick remounts
      setTimeout(terminateWorkerIfUnused, 1000);
    };
  }, []);

  const computeLineDiff = useCallback(
    async (
      oldContent: string,
      newContent: string,
      ignoreWhitespaceFlag?: boolean
    ): Promise<ParsedDiffLine[]> => {
      const ignoreWhitespace = ignoreWhitespaceFlag ?? false;
      const request: DiffWorkerRequest = {
        type: 'COMPUTE_LINE_DIFF',
        id: generateRequestId(),
        payload: { oldContent, newContent, ignoreWhitespace },
      };

      const result = await sendRequest<{ lines: ParsedDiffLine[] }>(request);
      return result.lines;
    },
    []
  );

  const computeWordDiff = useCallback(
    async (
      oldLine: string,
      newLine: string
    ): Promise<{ oldSegments: WordDiffSegment[]; newSegments: WordDiffSegment[] }> => {
      const request: DiffWorkerRequest = {
        type: 'COMPUTE_WORD_DIFF',
        id: generateRequestId(),
        payload: { oldLine, newLine },
      };

      return sendRequest(request);
    },
    []
  );

  const computeAlignment = useCallback(
    async (diffLines: ParsedDiffLine[]): Promise<AlignedDiffPair[]> => {
      const request: DiffWorkerRequest = {
        type: 'COMPUTE_ALIGNMENT',
        id: generateRequestId(),
        payload: { diffLines },
      };

      const result = await sendRequest<{ pairs: AlignedDiffPair[] }>(request);
      return result.pairs;
    },
    []
  );

  return {
    computeLineDiff,
    computeWordDiff,
    computeAlignment,
  };
}
