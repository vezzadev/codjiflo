import { useMemo, useRef, useEffect } from 'react';
import { parsePatch, detectLanguage } from '../utils';
import { DiffLine } from './DiffLine';
import type { ParsedDiffLine } from '../types';

interface SideBySideViewProps {
  filename: string;
  patch: string;
}

/**
 * Side-by-side diff view component
 * Implements S-3.2: Side-by-Side Diff View
 * AC-3.2.1 through AC-3.2.9
 */
export function SideBySideView({ filename, patch }: SideBySideViewProps) {
  const { diffLines, language } = useMemo(() => {
    return {
      diffLines: parsePatch(patch),
      language: detectLanguage(filename),
    };
  }, [patch, filename]);

  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  // AC-3.2.4: Synchronized scrolling
  useEffect(() => {
    const leftPane = leftPaneRef.current;
    const rightPane = rightPaneRef.current;
    if (!leftPane || !rightPane) return;

    let isLeftScrolling = false;
    let isRightScrolling = false;

    const handleLeftScroll = () => {
      if (isRightScrolling) return;
      isLeftScrolling = true;
      rightPane.scrollTop = leftPane.scrollTop;
      requestAnimationFrame(() => {
        isLeftScrolling = false;
      });
    };

    const handleRightScroll = () => {
      if (isLeftScrolling) return;
      isRightScrolling = true;
      leftPane.scrollTop = rightPane.scrollTop;
      requestAnimationFrame(() => {
        isRightScrolling = false;
      });
    };

    leftPane.addEventListener('scroll', handleLeftScroll);
    rightPane.addEventListener('scroll', handleRightScroll);

    return () => {
      leftPane.removeEventListener('scroll', handleLeftScroll);
      rightPane.removeEventListener('scroll', handleRightScroll);
    };
  }, []);

  // Separate lines into left (deletions) and right (additions)
  // AC-3.2.2, AC-3.2.3
  const { leftLines, rightLines } = useMemo(() => {
    const left: (ParsedDiffLine | null)[] = [];
    const right: (ParsedDiffLine | null)[] = [];

    diffLines.forEach((line) => {
      if (line.type === 'header') {
        // Skip headers in side-by-side view
        return;
      }

      if (line.type === 'deletion') {
        // AC-3.2.6: Deleted lines in left pane
        left.push(line);
        // AC-3.2.5: Add spacer in right pane for alignment
        right.push(null);
      } else if (line.type === 'addition') {
        // AC-3.2.7: Added lines in right pane
        right.push(line);
        // AC-3.2.5: Add spacer in left pane for alignment
        left.push(null);
      } else {
        // Context lines appear in both panes
        left.push(line);
        right.push(line);
      }
    });

    return { leftLines: left, rightLines: right };
  }, [diffLines]);

  return (
    // AC-3.2.1: Two vertical panes of equal width
    <div className="flex h-full" role="region" aria-label="Side-by-side diff view">
      {/* Left Pane - Original content */}
      <div
        ref={leftPaneRef}
        className="flex-1 overflow-auto border-r"
        role="region"
        aria-label="Original version" // AC-3.2.9
        tabIndex={0} // AC-3.2.8: Keyboard accessible
      >
        <table className="w-full border-collapse text-sm">
          <tbody>
            {leftLines.map((line, index) => {
              if (!line) {
                // Spacer for alignment
                return (
                  <tr key={`left-spacer-${String(index)}`} className="bg-gray-50">
                    <td className="px-2 text-gray-400 select-none w-12"></td>
                    <td className="px-4 py-0.5 text-gray-400">&nbsp;</td>
                  </tr>
                );
              }

              const lineNumber = line.oldLineNumber ?? index;
              const lineKey = `left-${String(lineNumber)}-${line.type}`;
              return (
                <DiffLine
                  key={lineKey}
                  line={line}
                  language={language}
                  showCommentButton={false} // Comments handled separately in S-3.1
                  onStartComment={() => {
                    /* TODO: Implement for S-3.1 */
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Right Pane - Modified content */}
      <div
        ref={rightPaneRef}
        className="flex-1 overflow-auto"
        role="region"
        aria-label="Modified version" // AC-3.2.9
        tabIndex={0} // AC-3.2.8: Keyboard accessible
      >
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rightLines.map((line, index) => {
              if (!line) {
                // Spacer for alignment
                return (
                  <tr key={`right-spacer-${String(index)}`} className="bg-gray-50">
                    <td className="px-2 text-gray-400 select-none w-12"></td>
                    <td className="px-4 py-0.5 text-gray-400">&nbsp;</td>
                  </tr>
                );
              }

              const lineNumber = line.newLineNumber ?? index;
              const lineKey = `right-${String(lineNumber)}-${line.type}`;
              return (
                <DiffLine
                  key={lineKey}
                  line={line}
                  language={language}
                  showCommentButton={false} // Comments handled separately in S-3.1
                  onStartComment={() => {
                    /* TODO: Implement for S-3.1 */
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
