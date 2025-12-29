/**
 * Iteration Selector Component (S-4.7)
 *
 * Dropdowns for selecting iteration range with preset options.
 */

import { useCallback, useMemo } from 'react';
import { ChevronDown, GitCommit, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';
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
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      title={description}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500',
        isActive
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      )}
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
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-600">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={handleChange}
          className={cn(
            'appearance-none bg-white border border-gray-300 rounded-md',
            'pl-3 pr-8 py-1.5 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'cursor-pointer'
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
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

  return (
    <div
      data-testid="iteration-selector"
      className={cn(
        'flex items-center gap-4 flex-wrap p-3 bg-gray-50 rounded-lg border border-gray-200',
        className
      )}
      role="toolbar"
      aria-label="Iteration range selector"
    >
      {/* Iteration icon */}
      <div className="flex items-center gap-2 text-gray-600">
        <GitCommit className="w-5 h-5" aria-hidden />
        <span className="text-sm font-medium">
          {iterations.length} iteration{iterations.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Preset buttons */}
      <div className="flex items-center gap-2" role="group" aria-label="Quick select presets">
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
      <div className="h-6 w-px bg-gray-300" aria-hidden />

      {/* Custom range dropdowns */}
      {selectedRange && (
        <div className="flex items-center gap-3">
          <SnapshotDropdown
            label="From:"
            value={selectedRange.fromSnapshot}
            iterations={iterations}
            onChange={handleFromChange}
            includeBase
          />
          <RefreshCw className="w-4 h-4 text-gray-400" aria-hidden />
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
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      )}
    </div>
  );
}
