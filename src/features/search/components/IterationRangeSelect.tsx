/**
 * IterationRangeSelect Component
 *
 * Radio button group for selecting the iteration scope for search-in-all-files.
 */

import type { IterationSearchScope } from '../types';

interface IterationRangeSelectProps {
  value: IterationSearchScope;
  onChange: (scope: IterationSearchScope) => void;
  disabled?: boolean;
}

interface ScopeOption {
  value: IterationSearchScope;
  label: string;
}

const SCOPE_OPTIONS: ScopeOption[] = [
  { value: 'current-only', label: 'Current iteration only' },
  { value: 'current-and-previous', label: 'Current and previous' },
  { value: 'current-and-later', label: 'Current and later' },
  { value: 'entire-review', label: 'Entire review' },
];

export function IterationRangeSelect({
  value,
  onChange,
  disabled = false,
}: IterationRangeSelectProps) {
  return (
    <div className="search-radio-group" role="radiogroup" aria-label="Iteration range">
      {SCOPE_OPTIONS.map((option) => (
        <label key={option.value} className="search-radio-label">
          <input
            type="radio"
            name="iteration-scope"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            disabled={disabled}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
