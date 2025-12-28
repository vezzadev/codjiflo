/**
 * Hook to use diff worker for computing diffs
 * S-3.0: Diff Engine Scaffolding
 * S-3.6: Word-Level Diff Highlighting
 */

import { useEffect, useRef, useCallback } from 'react';
import type { DiffRequest, DiffResult } from './diff.worker';

interface UseDiffWorkerReturn {
  computeDiff: (textA: string, textB: string) => Promise<DiffResult>;
  computeWordDiff: (textA: string, textB: string) => Promise<DiffResult>;
}

/**
 * Hook to interact with the diff worker
 */
export function useDiffWorker(): UseDiffWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const pendingCallbacks = useRef<Map<string, (result: DiffResult) => void>>(new Map());
  const requestIdCounter = useRef(0);

  useEffect(() => {
    // Initialize worker
    workerRef.current = new Worker(new URL('./diff.worker.ts', import.meta.url), {
      type: 'module',
    });

    workerRef.current.onmessage = (event: MessageEvent<DiffResult>) => {
      const { id } = event.data;
      const callback = pendingCallbacks.current.get(id);
      if (callback) {
        callback(event.data);
        pendingCallbacks.current.delete(id);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const computeDiff = useCallback((textA: string, textB: string): Promise<DiffResult> => {
    return new Promise((resolve) => {
      if (!workerRef.current) {
        // Fallback: compute synchronously if worker not ready
        resolve({
          type: 'diffResult',
          diffs: [{ operation: 'equal', text: textA }],
          id: 'fallback',
        });
        return;
      }

      const id = `diff-${String(++requestIdCounter.current)}`;
      pendingCallbacks.current.set(id, resolve);

      const request: DiffRequest = {
        type: 'computeDiff',
        textA,
        textB,
        id,
      };

      workerRef.current.postMessage(request);
    });
  }, []);

  const computeWordDiff = useCallback((textA: string, textB: string): Promise<DiffResult> => {
    return new Promise((resolve) => {
      if (!workerRef.current) {
        // Fallback: compute synchronously if worker not ready
        resolve({
          type: 'wordDiffResult',
          diffs: [{ operation: 'equal', text: textA }],
          id: 'fallback',
        });
        return;
      }

      const id = `word-diff-${String(++requestIdCounter.current)}`;
      pendingCallbacks.current.set(id, resolve);

      const request: DiffRequest = {
        type: 'computeWordDiff',
        textA,
        textB,
        id,
      };

      workerRef.current.postMessage(request);
    });
  }, []);

  return {
    computeDiff,
    computeWordDiff,
  };
}
