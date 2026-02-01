/**
 * Iteration Selector Component (S-4.7)
 *
 * Tab-based iteration selector with drag-to-select range functionality.
 * - Click single tab: diff from base to that iteration
 * - Click and drag from tab A to B: diff between iterations A and B
 *
 * Supports both stateful (artifact) and stateless (Timeline API) modes.
 * In stateless mode, displays CollapsedIterationGroup components for force-pushed iterations.
 */

import { useCallback, useMemo, useState } from 'react';
import { useIterationStore, selectSelectedRange } from '../stores';
import { CollapsedIterationGroup } from './CollapsedIterationGroup';
import type { Iteration, StatelessIteration } from '../types';
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
// Main IterationSelector Component
// ============================================================================

interface IterationSelectorProps {
  className?: string;
}

export function IterationSelector({ className }: IterationSelectorProps) {
  const {
    iterations,
    selectRange,
    isLoading,
    mode,
    artifactReference,
    statelessIterations,
    collapsedGroups,
    toggleCollapsedGroupVisibility,
  } = useIterationStore();
  const selectedRange = useIterationStore(selectSelectedRange);

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startRevision: null,
    currentRevision: null,
  });

  // Calculate which iterations are currently selected based on selectedRange
  // This works for both stateful (iterations) and stateless (statelessIterations) modes
  const { selectedRevisions, rangeStart, rangeEnd } = useMemo(() => {
    // Use stateless iterations in stateless mode, otherwise use stateful iterations
    const iterationsToUse = mode === 'stateless' ? statelessIterations : iterations;

    if (!selectedRange || iterationsToUse.length === 0) {
      return { selectedRevisions: new Set<number>(), rangeStart: null, rangeEnd: null };
    }

    const revisions = new Set<number>();
    let start: number | null = null;
    let end: number | null = null;

    // Find which iterations correspond to the selected snapshot range
    for (const iteration of iterationsToUse) {
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
  }, [selectedRange, iterations, mode, statelessIterations]);

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

  // Build render items for stateless mode (interleaved collapsed groups and live iterations)
  const statelessRenderItems = useMemo(() => {
    if (mode !== 'stateless' || statelessIterations.length === 0) {
      return [];
    }

    // Group iterations by their collapsedGroupId or mark as live
    const items: (| { type: 'iteration'; iteration: StatelessIteration }
      | { type: 'collapsed-group'; groupId: string })[] = [];

    const seenGroups = new Set<string>();

    for (const iteration of statelessIterations) {
      if (iteration.lineage === 'current') {
        // Live iteration - always show
        items.push({ type: 'iteration', iteration });
      } else if (iteration.collapsedGroupId) {
        // Discarded iteration - show collapsed group marker (once per group)
        if (!seenGroups.has(iteration.collapsedGroupId)) {
          seenGroups.add(iteration.collapsedGroupId);
          items.push({ type: 'collapsed-group', groupId: iteration.collapsedGroupId });
        }
      }
    }

    return items;
  }, [mode, statelessIterations]);

  // Handle stateless mode rendering
  if (mode === 'stateless') {
    // Don't render if no stateless iterations
    if (statelessIterations.length === 0) {
      return null;
    }

    const classes = ['iteration-tabs-container', className].filter(Boolean).join(' ');

    return (
      <div
        data-testid="iteration-selector"
        className={classes}
        role="toolbar"
        aria-label="Iteration range selector (stateless mode)"
        onMouseUp={handleMouseUp}
      >
        <div className="iteration-tabs" role="group">
          {statelessRenderItems.map((item) => {
            if (item.type === 'collapsed-group') {
              const group = collapsedGroups.find((g) => g.id === item.groupId);
              if (!group) return null;

              return (
                <CollapsedIterationGroup
                  key={`group-${item.groupId}`}
                  group={group}
                  onToggleExpand={toggleCollapsedGroupVisibility}
                  onMouseDown={handleMouseDown}
                  onMouseEnter={handleMouseEnter}
                  selectedRevisions={selectedRevisions}
                  previewRange={previewRange}
                />
              );
            }

            // Live iteration in stateless mode
            const iteration = item.iteration;
            const inPreviewRange =
              previewRange !== null &&
              iteration.revision >= previewRange.start &&
              iteration.revision <= previewRange.end;

            const isInRange = dragState.isDragging ? inPreviewRange : false;
            const isRangeStartTab = dragState.isDragging
              ? previewRange?.start === iteration.revision
              : false;
            const isRangeEndTab = dragState.isDragging
              ? previewRange?.end === iteration.revision
              : false;
            const isSelected = isRangeStartTab || isRangeEndTab;

            const tabClasses = [
              'iteration-tab',
              isSelected && 'selected',
              isInRange && 'in-range',
              isRangeStartTab && 'range-start',
              isRangeEndTab && 'range-end',
            ]
              .filter(Boolean)
              .join(' ');

            const date = iteration.createdAt.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });

            return (
              <button
                key={iteration.commitSha}
                type="button"
                className={tabClasses}
                onMouseDown={() => handleMouseDown(iteration.revision)}
                onMouseEnter={() => handleMouseEnter(iteration.revision)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleKeyboardSelect(iteration.revision);
                  }
                }}
                title={`${iteration.message} (${date})`}
                aria-pressed={isSelected || isInRange}
                data-testid={`iteration-tab-${iteration.revision}`}
              >
                <span className="iteration-tab-number" aria-hidden="true">
                  {iteration.revision}
                </span>
              </button>
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
        {iterations.map((iteration) => {
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
