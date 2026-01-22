/**
 * SearchOptionsBar Component
 *
 * Shared toggle buttons for search options: Match Case, Whole Word, Regex, Highlight All.
 * Used by both FindInFileBar and FindInAllFilesModal.
 */

import { useCallback } from 'react';
import type { SearchOptions } from '../types';

interface SearchOptionsBarProps {
  options: SearchOptions;
  onToggleOption: (option: keyof SearchOptions) => void;
  /** Whether to show the Highlight All toggle (only for find-in-file) */
  showHighlightAll?: boolean;
}

interface OptionButtonConfig {
  key: keyof SearchOptions;
  label: string;
  title: string;
}

const OPTION_BUTTONS: OptionButtonConfig[] = [
  { key: 'matchCase', label: 'Aa', title: 'Match Case' },
  { key: 'matchWholeWord', label: 'Ab', title: 'Match Whole Word' },
  { key: 'useRegex', label: '.*', title: 'Use Regular Expression' },
];

export function SearchOptionsBar({
  options,
  onToggleOption,
  showHighlightAll = false,
}: SearchOptionsBarProps) {
  const handleClick = useCallback(
    (key: keyof SearchOptions) => () => {
      onToggleOption(key);
    },
    [onToggleOption]
  );

  const buttonsToRender = showHighlightAll
    ? [...OPTION_BUTTONS, { key: 'highlightAll' as const, label: 'Hi', title: 'Highlight All Matches' }]
    : OPTION_BUTTONS;

  return (
    <div className="search-options" role="group" aria-label="Search options">
      {buttonsToRender.map(({ key, label, title }) => (
        <button
          key={key}
          type="button"
          className="search-option-btn"
          aria-pressed={options[key]}
          title={title}
          onClick={handleClick(key)}
          data-testid={`search-option-${key}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
