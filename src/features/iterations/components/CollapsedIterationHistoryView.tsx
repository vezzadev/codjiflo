/**
 * Collapsed Iteration History View
 *
 * Shows details of discarded iterations from a collapsed group.
 * Displays commit list with author/date info and an "Include" button.
 */

import { Eraser } from 'lucide-react';
import type { CollapsedIterationGroup } from '../types';

interface CollapsedIterationHistoryViewProps {
  group: CollapsedIterationGroup;
  onInclude: () => void;
}

export function CollapsedIterationHistoryView({ group, onInclude }: CollapsedIterationHistoryViewProps) {
  return (
    <>
      <div className="collapsed-history-view" data-testid="collapsed-history-view">
        <div className="collapsed-history-header">
          <Eraser size={16} aria-hidden="true" />
          <span>Discarded Iterations</span>
        </div>

        {group.unknownCount === true ? (
          <p>Unknown iterations were discarded</p>
        ) : (
          <div className="collapsed-history-list">
            {group.commits.map((commit, index) => {
              const revision = group.discardedRevisions[index];
              const firstLine = commit.message.split('\n')[0] ?? commit.message;
              const isUnavailable = commit.status === 'unavailable';

              return (
                <div
                  key={commit.sha}
                  className={`collapsed-history-item${isUnavailable ? ' unavailable' : ''}`}
                  data-testid={`collapsed-history-commit-${commit.sha}`}
                >
                  {revision !== undefined && (
                    <span className="collapsed-history-revision">#{String(revision)}</span>
                  )}
                  {isUnavailable ? (
                    <span>(Commit data no longer available)</span>
                  ) : (
                    <>
                      <span className="collapsed-history-message">{firstLine}</span>
                      <span className="collapsed-history-author">{commit.author}</span>
                      <span className="collapsed-history-date">{commit.date}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="collapsed-history-actions">
        <button
          type="button"
          className="btn btn-colorful"
          data-testid="collapsed-history-include-btn"
          onClick={onInclude}
        >
          Include discarded iterations
        </button>
      </div>
    </>
  );
}
