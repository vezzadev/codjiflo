/**
 * Word-level diff component
 * S-3.6: Word-Level Diff Highlighting
 * Shows character/word-level changes within modified lines
 */

import { useEffect, useState } from 'react';
import { useDiffWorker } from '@/workers/useDiffWorker';
import type { WordDiff } from '../utils/word-diff';

interface WordLevelDiffProps {
  oldText: string;
  newText: string;
  type: 'old' | 'new';
}

/**
 * Component that highlights word-level changes
 * AC-3.6.1, AC-3.6.2
 */
export function WordLevelDiff({ oldText, newText, type }: WordLevelDiffProps) {
  const { computeWordDiff } = useDiffWorker();
  const [segments, setSegments] = useState<WordDiff[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function computeDiff() {
      setIsLoading(true);
      try {
        // AC-3.6.5: Runs in Web Worker
        const result = await computeWordDiff(oldText, newText);
        
        if (isMounted) {
          // Map worker result to WordDiff format
          const wordDiffs: WordDiff[] = result.diffs.map((d) => ({
            type: d.operation === 'delete' ? 'delete' : d.operation === 'insert' ? 'insert' : 'equal',
            text: d.text,
          }));
          setSegments(wordDiffs);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Word diff computation failed:', error);
        if (isMounted) {
          // Fallback: show entire text as equal
          setSegments([{ type: 'equal', text: type === 'old' ? oldText : newText }]);
          setIsLoading(false);
        }
      }
    }

    void computeDiff();

    return () => {
      isMounted = false;
    };
  }, [oldText, newText, type, computeWordDiff]);

  if (isLoading) {
    return <span>{type === 'old' ? oldText : newText}</span>;
  }

  // AC-3.6.2: Darker/saturated background for changed words
  return (
    <span>
      {segments.map((segment, i) => {
        const key = `${String(i)}-${segment.type}`;

        // Show deletions in old text, insertions in new text
        if (type === 'old' && segment.type === 'delete') {
          return (
            <span key={key} className="bg-red-300 font-semibold">
              {segment.text}
            </span>
          );
        }

        if (type === 'new' && segment.type === 'insert') {
          return (
            <span key={key} className="bg-green-300 font-semibold">
              {segment.text}
            </span>
          );
        }

        // Equal segments or segments not shown in this side
        if (segment.type === 'equal' || (type === 'old' && segment.type === 'insert') || (type === 'new' && segment.type === 'delete')) {
          return <span key={key}>{segment.text}</span>;
        }

        return null;
      })}
    </span>
  );
}
