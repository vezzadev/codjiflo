/**
 * Iteration Selector Component (S-4.7)
 *
 * Tab-based iteration selector with drag-to-select range functionality.
 * - Click single tab: diff from base to that iteration
 * - Click and drag from tab A to B: diff between iterations A and B
 */

import { useCallback, useMemo, useState } from 'react';
import { Eraser } from 'lucide-react';
import { useIterationStore, selectSelectedRange } from '../stores';
import type { Iteration, CollapsedIterationGroup } from '../types';
import { iterationToRightSnapshot } from '../types';

// Default number of skeleton tabs when iteration count is unknown
const DEFAULT_SKELETON_TAB_COUNT = 3;

// ============================================================================
// Types
// ============================================================================

interface DragState {
  isDragging: boolean;
  startRevision: number | null;
  currentRevision: number | null;
}

// ============================================================================
// Iteration Tab Component
// ============================================================================

interface IterationTabProps {
  iteration: Iteration;
  isSelected: boolean;
  isInRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  onMouseDown: (revision: number) => void;
  onMouseEnter: (revision: number) => void;
  onSelect: (revision: number) => void;
}

function IterationTab({
  iteration,
  isSelected,
  isInRange,
  isRangeStart,
  isRangeEnd,
  onMouseDown,
  onMouseEnter,
  onSelect,
}: IterationTabProps) {
  const classes = [
    'iteration-tab',
    isSelected && 'selected',
    isInRange && 'in-range',
    isRangeStart && 'range-start',
    isRangeEnd && 'range-end',
  ]
    .filter(Boolean)
    .join(' ');

  const date = iteration.createdAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(iteration.revision);
    }
  };

  return (
    <button
      type="button"
      className={classes}
      onMouseDown={() => onMouseDown(iteration.revision)}
      onMouseEnter={() => onMouseEnter(iteration.revision)}
      onKeyDown={handleKeyDown}
      title={`Iteration ${iteration.revision} (${date})`}
      aria-pressed={isSelected || isInRange}
      data-testid={`iteration-tab-${iteration.revision}`}
    >
      <span className="iteration-tab-number" aria-hidden="true">{iteration.revision}</span>
    </button>
  );
}

// ============================================================================
// Collapsed Group Tab Component
// ============================================================================

interface CollapsedGroupTabProps {
  group: CollapsedIterationGroup;
}

function CollapsedGroupTab({ group }: CollapsedGroupTabProps) {
  const count = group.discardedRevisions.length;
  const tooltip = group.unknownCount
    ? 'Unknown iterations discarded'
    : `${String(count)} iteration${count === 1 ? '' : 's'} discarded`;

  return (
    <div
      className="iteration-tab collapsed"
      title={tooltip}
      data-testid={`collapsed-group-${group.forcePushEventId}`}
      aria-label={tooltip}
      role="img"
    >
      <Eraser size={14} aria-hidden="true" />
    </div>
  );
}

// ============================================================================
// Main IterationSelector Component
// ============================================================================

interface IterationSelectorProps {
  className?: string;
}

export function IterationSelector({ className }: IterationSelectorProps) {
  const { iterations, collapsedGroups, selectRange, isLoading, artifactReference } = useIterationStore();
  const selectedRange = useIterationStore(selectSelectedRange);

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startRevision: null,
    currentRevision: null,
  });

  // Calculate which iterations are currently selected based on selectedRange
  const { selectedRevisions, rangeStart, rangeEnd } = useMemo(() => {
    if (!selectedRange || iterations.length === 0) {
      return { selectedRevisions: new Set<number>(), rangeStart: null, rangeEnd: null };
    }

    const revisions: Set<number> = new Set();
    let start: number | null = null;
    let end: number | null = null;

    // Find which iterations correspond to the selected snapshot range
    for (const iteration of iterations) {
      const rightSnapshot = iterationToRightSnapshot(iteration.revision);

      // If fromSnapshot is 0 (base), the range starts before iteration 1
      // If fromSnapshot matches this iteration's right snapshot, this is the start
      if (selectedRange.fromSnapshot === rightSnapshot) {
        start = iteration.revision;
      }

      // If toSnapshot matches this iteration's right snapshot, this is the end
      if (selectedRange.toSnapshot === rightSnapshot) {
        end = iteration.revision;
      }

      // Check if this iteration is within the selected range
      if (rightSnapshot > selectedRange.fromSnapshot && rightSnapshot <= selectedRange.toSnapshot) {
        revisions.add(iteration.revision);
      }
    }

    // INTENTIONAL: When fromSnapshot is 0 (base), no iteration tab is the "start"
    // because the range starts before iteration 1 (at the base commit).
    // In this case, only the end iteration is highlighted as "selected".
    // This is correct UX: clicking iteration N shows "base → N" diff, so only
    // iteration N should be highlighted, not iteration 1.
    if (selectedRange.fromSnapshot === 0) {
      start = null;
    }

    return { selectedRevisions: revisions, rangeStart: start, rangeEnd: end };
  }, [selectedRange, iterations]);

  // Handle mouse down on a tab - start potential drag
  const handleMouseDown = useCallback((revision: number) => {
    setDragState({
      isDragging: true,
      startRevision: revision,
      currentRevision: revision,
    });
  }, []);

  // Handle mouse enter on a tab during drag
  const handleMouseEnter = useCallback(
    (revision: number) => {
      if (dragState.isDragging) {
        setDragState((prev) => ({
          ...prev,
          currentRevision: revision,
        }));
      }
    },
    [dragState.isDragging]
  );

  // Handle mouse up - finalize selection
  const handleMouseUp = useCallback(() => {
    if (!dragState.isDragging || dragState.startRevision === null) {
      setDragState({ isDragging: false, startRevision: null, currentRevision: null });
      return;
    }

    const startRev = dragState.startRevision;
    const endRev = dragState.currentRevision ?? startRev;

    // Determine the range (ensure start <= end)
    const minRev = Math.min(startRev, endRev);
    const maxRev = Math.max(startRev, endRev);

    if (minRev === maxRev) {
      // Single iteration clicked: diff from base to this iteration
      const toSnapshot = iterationToRightSnapshot(maxRev);
      selectRange(0, toSnapshot);
    } else {
      // Range selected: diff between iterations
      const fromSnapshot = iterationToRightSnapshot(minRev);
      const toSnapshot = iterationToRightSnapshot(maxRev);
      selectRange(fromSnapshot, toSnapshot);
    }

    setDragState({ isDragging: false, startRevision: null, currentRevision: null });
  }, [dragState, selectRange]);

  // Handle keyboard selection (Enter/Space on a tab)
  const handleKeyboardSelect = useCallback(
    (revision: number) => {
      // Keyboard selection always selects from base to iteration
      const toSnapshot = iterationToRightSnapshot(revision);
      selectRange(0, toSnapshot);
    },
    [selectRange]
  );

  // Calculate preview range during drag
  const previewRange = useMemo(() => {
    if (!dragState.isDragging || dragState.startRevision === null) {
      return null;
    }

    const startRev = dragState.startRevision;
    const endRev = dragState.currentRevision ?? startRev;
    const minRev = Math.min(startRev, endRev);
    const maxRev = Math.max(startRev, endRev);

    return { start: minRev, end: maxRev };
  }, [dragState]);

  // Build display items: live iterations as tabs, collapsed groups as single tabs
  const displayItems = useMemo(() => {
    const items: (| { type: 'iteration'; iteration: Iteration }
      | { type: 'collapsed-group'; group: CollapsedIterationGroup })[] = [];

    const processedGroups: Set<string> = new Set();
    const collapsedGroupById = new Map(
      collapsedGroups.map(group => [group.forcePushEventId, group] as const)
    );

    for (const iteration of iterations) {
      if (iteration.status === 'collapsed' && iteration.collapsedGroupId) {
        // Render collapsed group tab (once per group)
        if (!processedGroups.has(iteration.collapsedGroupId)) {
          processedGroups.add(iteration.collapsedGroupId);
          const group = collapsedGroupById.get(iteration.collapsedGroupId);
          if (group) {
            items.push({ type: 'collapsed-group', group });
          }
        }
        continue;
      }

      items.push({ type: 'iteration', iteration });
    }

    // Also add unknown-count groups that have no iterations
    for (const group of collapsedGroups) {
      if (group.unknownCount && !processedGroups.has(group.forcePushEventId)) {
        items.unshift({ type: 'collapsed-group', group });
      }
    }

    return items;
  }, [iterations, collapsedGroups]);

  // Show skeleton while loading with no iterations yet
  if (isLoading && iterations.length === 0) {
    const skeletonCount = artifactReference?.iterationCount ?? DEFAULT_SKELETON_TAB_COUNT;
    const classes = ['iteration-tabs-container', className].filter(Boolean).join(' ');
    return (
      <div
        data-testid="iteration-selector"
        className={classes}
        role="toolbar"
        aria-label="Iteration range selector loading"
      >
        <div className="iteration-tabs" role="group" aria-busy="true">
          {Array.from({ length: skeletonCount }).map((_, i) => {
            const isLast = i === skeletonCount - 1;
            return (
              <div
                key={i}
                className={`skeleton iteration-tab-skeleton${isLast ? ' active' : ''}`}
                aria-hidden="true"
                role="presentation"
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Don't render if no iterations (and not loading)
  if (iterations.length === 0) {
    return null;
  }

  const classes = ['iteration-tabs-container', className].filter(Boolean).join(' ');

  return (
    <div
      data-testid="iteration-selector"
      className={classes}
      role="toolbar"
      aria-label="Iteration range selector"
      onMouseUp={handleMouseUp}
    >
      <div className="iteration-tabs" role="group">
        {displayItems.map((item) => {
          if (item.type === 'collapsed-group') {
            return (
              <CollapsedGroupTab
                key={`collapsed-${item.group.forcePushEventId}`}
                group={item.group}
              />
            );
          }

          const { iteration } = item;

          // During drag, show preview highlighting
          const inPreviewRange =
            previewRange !== null &&
            iteration.revision >= previewRange.start &&
            iteration.revision <= previewRange.end;

          // When not dragging, show actual selection
          const isInRange = dragState.isDragging
            ? inPreviewRange
            : selectedRevisions.has(iteration.revision);

          const isRangeStartTab = dragState.isDragging
            ? previewRange?.start === iteration.revision
            : rangeStart === iteration.revision;

          const isRangeEndTab = dragState.isDragging
            ? previewRange?.end === iteration.revision
            : rangeEnd === iteration.revision;

          // "Selected" means it's at a boundary of the range
          const isSelected = isRangeStartTab || isRangeEndTab;

          return (
            <IterationTab
              key={iteration.id}
              iteration={iteration}
              isSelected={isSelected}
              isInRange={isInRange}
              isRangeStart={isRangeStartTab}
              isRangeEnd={isRangeEndTab}
              onMouseDown={handleMouseDown}
              onMouseEnter={handleMouseEnter}
              onSelect={handleKeyboardSelect}
            />
          );
        })}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="iteration-loading" role="status" aria-live="polite">
          <div className="spinner-small" aria-hidden="true" />
          <span>Loading...</span>
        </div>
      )}
    </div>
  );
}
