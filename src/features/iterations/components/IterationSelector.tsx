/**
 * Iteration Selector Component (S-4.7)
 *
 * Dropdowns for selecting iteration range with preset options.
 */

import { useCallback, useMemo } from 'react';
import { ChevronDown, GitCommit, RefreshCw } from 'lucide-react';
import { useIterationStore } from '../stores';
import type { Iteration, IterationPreset } from '../types';
import { iterationToRightSnapshot } from '../types';

// ============================================================================
// Preset Button Component
// ============================================================================

interface PresetButtonProps {
  preset: IterationPreset;
  label: string;
  description: string;
  isActive: boolean;
  onClick: () => void;
}

function PresetButton({ label, description, isActive, onClick }: PresetButtonProps) {
  const classes = ['btn-toggle', isActive ? 'active' : ''].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      title={description}
      className={classes}
    >
      {label}
    </button>
  );
}

// ============================================================================
// Snapshot Dropdown Component
// ============================================================================

interface SnapshotDropdownProps {
  label: string;
  value: number;
  iterations: Iteration[];
  onChange: (snapshotIndex: number) => void;
  includeBase?: boolean;
}

function SnapshotDropdown({
  label,
  value,
  iterations,
  onChange,
  includeBase = false,
}: SnapshotDropdownProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(parseInt(e.target.value, 10));
    },
    [onChange]
  );

  // Build options: base (0) + each iteration's right snapshot
  const options: { value: number; label: string }[] = [];

  if (includeBase) {
    options.push({ value: 0, label: 'Base' });
  }

  for (const iteration of iterations) {
    const rightSnapshot = iterationToRightSnapshot(iteration.revision);
    const date = iteration.createdAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    options.push({
      value: rightSnapshot,
      label: `v${String(iteration.revision)} (${date})`,
    });
  }

  return (
    <div className="iteration-dropdown-wrapper">
      <label className="iteration-dropdown-label">{label}</label>
      <div className="iteration-dropdown-container">
        <select
          value={value}
          onChange={handleChange}
          className="select"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="iteration-dropdown-chevron"
          aria-hidden
        />
      </div>
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
  const { iterations, selectedRange, selectRange, selectPreset, isLoading, isDegraded } =
    useIterationStore();

  // All hooks must be called before any conditional returns
  const handleFromChange = useCallback(
    (fromSnapshot: number) => {
      if (selectedRange) {
        selectRange(fromSnapshot, selectedRange.toSnapshot);
      }
    },
    [selectedRange, selectRange]
  );

  const handleToChange = useCallback(
    (toSnapshot: number) => {
      if (selectedRange) {
        selectRange(selectedRange.fromSnapshot, toSnapshot);
      }
    },
    [selectedRange, selectRange]
  );

  // Determine active preset using useMemo for consistency
  const activePreset = useMemo((): IterationPreset | null => {
    if (!selectedRange || iterations.length === 0) return null;

    const latestIteration = iterations[iterations.length - 1];
    if (!latestIteration) return null;

    const latestRightSnapshot = iterationToRightSnapshot(latestIteration.revision);

    // Full: base (0) to latest
    if (selectedRange.fromSnapshot === 0 && selectedRange.toSnapshot === latestRightSnapshot) {
      return 'full';
    }

    // Latest: previous iteration to latest
    if (iterations.length > 1) {
      const prevIteration = iterations[iterations.length - 2];
      if (prevIteration) {
        const prevRightSnapshot = iterationToRightSnapshot(prevIteration.revision);
        if (
          selectedRange.fromSnapshot === prevRightSnapshot &&
          selectedRange.toSnapshot === latestRightSnapshot
        ) {
          return 'latest';
        }
      }
    } else if (
      selectedRange.fromSnapshot === 0 &&
      selectedRange.toSnapshot === latestRightSnapshot
    ) {
      // Only one iteration: latest = full
      return 'latest';
    }

    return null;
  }, [selectedRange, iterations]);

  // Don't render if degraded mode or no iterations
  if (isDegraded || iterations.length === 0) {
    return null;
  }

  const classes = ['iteration-selector', className].filter(Boolean).join(' ');

  return (
    <div
      data-testid="iteration-selector"
      className={classes}
      role="toolbar"
      aria-label="Iteration range selector"
    >
      {/* Iteration icon */}
      <div className="iteration-count">
        <GitCommit size={20} aria-hidden />
        <span>
          {iterations.length} iteration{iterations.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Preset buttons */}
      <div className="btn-group" role="group" aria-label="Quick select presets">
        <PresetButton
          preset="full"
          label="Full diff"
          description="Compare base to latest"
          isActive={activePreset === 'full'}
          onClick={() => selectPreset('full')}
        />
        <PresetButton
          preset="latest"
          label="Latest"
          description="Compare previous to latest iteration"
          isActive={activePreset === 'latest'}
          onClick={() => selectPreset('latest')}
        />
      </div>

      {/* Separator */}
      <div className="iteration-separator" aria-hidden />

      {/* Custom range dropdowns */}
      {selectedRange && (
        <div className="iteration-range-dropdowns">
          <SnapshotDropdown
            label="From:"
            value={selectedRange.fromSnapshot}
            iterations={iterations}
            onChange={handleFromChange}
            includeBase
          />
          <RefreshCw size={16} className="iteration-range-icon" aria-hidden />
          <SnapshotDropdown
            label="To:"
            value={selectedRange.toSnapshot}
            iterations={iterations}
            onChange={handleToChange}
          />
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="iteration-loading">
          <div className="spinner-small" />
          <span>Loading...</span>
        </div>
      )}
    </div>
  );
}
