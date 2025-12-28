/**
 * Diff computation worker
 * S-3.0: Diff Engine Scaffolding (Web Worker)
 * AC-3.0.1, AC-3.0.2
 * 
 * Computes diffs in a background thread to keep UI responsive for large files.
 */

import DiffMatchPatch from 'diff-match-patch';

export interface DiffRequest {
  type: 'computeDiff' | 'computeWordDiff';
  textA: string;
  textB: string;
  id: string;
}

export interface DiffResult {
  type: 'diffResult' | 'wordDiffResult';
  diffs: Diff[];
  id: string;
}

export interface Diff {
  operation: 'delete' | 'insert' | 'equal';
  text: string;
}

const dmp = new DiffMatchPatch();

// AC-3.0.2: Async message passing interface
self.onmessage = (event: MessageEvent<DiffRequest>) => {
  const { type, textA, textB, id } = event.data;

  if (type === 'computeDiff') {
    // Line-level diff
    const diffs = dmp.diff_main(textA, textB);
    dmp.diff_cleanupSemantic(diffs);

    const result: DiffResult = {
      type: 'diffResult',
      diffs: diffs.map(([op, text]) => ({
        operation: op === -1 ? 'delete' : op === 1 ? 'insert' : 'equal',
        text,
      })),
      id,
    };

    self.postMessage(result);
    return;
  }

  // Word/character-level diff for S-3.6
  const diffs = dmp.diff_main(textA, textB);
  dmp.diff_cleanupEfficiency(diffs);

  const result: DiffResult = {
    type: 'wordDiffResult',
    diffs: diffs.map(([op, text]) => ({
      operation: op === -1 ? 'delete' : op === 1 ? 'insert' : 'equal',
      text,
    })),
    id,
  };

  self.postMessage(result);
};

// Handle errors
self.onerror = (error) => {
  console.error('Diff worker error:', error);
};

export {};
