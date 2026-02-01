/**
 * CollapsedIterationGroup Component
 *
 * Displays a group of iterations that were discarded by a force-push.
 * - Collapsed: Shows a single compact tab with eraser icon and count
 * - Expanded: Shows all discarded iterations as tabs with strikethrough styling
 */

import { Eraser, ChevronDown } from 'lucide-react';
import type { CollapsedIterationGroup as CollapsedIterationGroupType } from '../types';

// ============================================================================
// Types
// ============================================================================

interface CollapsedIterationGroupProps {
  /** The collapsed group data */
  group: CollapsedIterationGroupType;
  /** Callback when user toggles expand/collapse */
  onToggleExpand: (groupId: string) => void;
  /** Callback for drag selection - mousedown on iteration tab */
  onMouseDown: (revision: number) => void;
  /** Callback for drag selection - mouseenter on iteration tab */
  onMouseEnter: (revision: number) => void;
  /** Optional: whether each iteration is selected (for highlighting) */
  selectedRevisions?: Set<number>;
  /** Optional: whether each iteration is in the drag preview range */
  previewRange?: { start: number; end: number } | null;
}

// ============================================================================
// Discarded Iteration Tab (for expanded state)
// ============================================================================

interface DiscardedIterationTabProps {
  revision: number;
  message: string;
  onMouseDown: (revision: number) => void;
  onMouseEnter: (revision: number) => void;
  isSelected?: boolean;
  isInRange?: boolean;
}

function DiscardedIterationTab({
  revision,
  message,
  onMouseDown,
  onMouseEnter,
  isSelected,
  isInRange,
}: DiscardedIterationTabProps) {
  const classes = [
    'iteration-tab',
    'discarded-iteration-tab',
    isSelected && 'selected',
    isInRange && 'in-range',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      data-testid={`discarded-iteration-tab-${revision}`}
      onMouseDown={() => onMouseDown(revision)}
      onMouseEnter={() => onMouseEnter(revision)}
      title={`Discarded: ${message}`}
    >
      <span className="iteration-tab-number" aria-hidden="true">
        {revision}
      </span>
    </button>
  );
}

// ============================================================================
// Main CollapsedIterationGroup Component
// ============================================================================

export function CollapsedIterationGroup({
  group,
  onToggleExpand,
  onMouseDown,
  onMouseEnter,
  selectedRevisions,
  previewRange,
}: CollapsedIterationGroupProps) {
  const isExpanded = group.visibility === 'expanded';
  const iterationCount = group.iterations.length;
  const hasUnavailableReason = Boolean(group.unavailableReason);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleExpand(group.id);
    }
  };

  const handleClick = () => {
    onToggleExpand(group.id);
  };

  // Collapsed state: single compact tab
  if (!isExpanded) {
    const collapsedClasses = [
      'collapsed-iteration-group',
      'collapsed',
      hasUnavailableReason && 'unavailable',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        className={collapsedClasses}
        data-testid={`collapsed-group-${group.id}`}
        role="button"
        tabIndex={0}
        aria-expanded="false"
        aria-label={`${iterationCount} discarded iterations`}
        title={group.unavailableReason ?? `${iterationCount} iterations discarded by force-push`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <Eraser
          size={16}
          className="collapsed-group-icon"
          aria-label="Discarded iterations"
        />
        <span className="collapsed-group-count">{iterationCount}</span>
      </div>
    );
  }

  // Expanded state: show all discarded iterations
  return (
    <div
      className="collapsed-iteration-group expanded"
      data-testid={`collapsed-group-${group.id}`}
      aria-expanded="true"
    >
      <button
        type="button"
        className="collapsed-group-collapse-btn"
        onClick={handleClick}
        aria-label="Collapse discarded iterations"
        title="Collapse discarded iterations"
      >
        <ChevronDown size={14} />
      </button>
      <div className="collapsed-group-tabs">
        {group.iterations.map((iteration) => {
          const isSelected = selectedRevisions?.has(iteration.revision) ?? false;
          const isInRange =
            previewRange !== null &&
            previewRange !== undefined &&
            iteration.revision >= previewRange.start &&
            iteration.revision <= previewRange.end;

          return (
            <DiscardedIterationTab
              key={iteration.commitSha}
              revision={iteration.revision}
              message={iteration.message}
              onMouseDown={onMouseDown}
              onMouseEnter={onMouseEnter}
              isSelected={isSelected}
              isInRange={isInRange}
            />
          );
        })}
      </div>
    </div>
  );
}
