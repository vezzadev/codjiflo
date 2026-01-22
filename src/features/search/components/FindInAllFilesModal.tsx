/**
 * FindInAllFilesModal Component
 *
 * Modal for configuring and executing search across all files.
 * Results are displayed in the bottom panel, not in this modal.
 */

import { useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { useSearchStore } from '../stores';
import { SearchOptionsBar } from './SearchOptionsBar';
import { IterationRangeSelect } from './IterationRangeSelect';
import type { SideFilter } from '../types';

interface FindInAllFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: () => void;
}

export function FindInAllFilesModal({
  isOpen,
  onClose,
  onSearch,
}: FindInAllFilesModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    query,
    fileFilter,
    fileFilterUseRegex,
    options,
    iterationScope,
    sideFilter,
    setQuery,
    setFileFilter,
    setFileFilterUseRegex,
    toggleOption,
    setIterationScope,
    setSideFilter,
  } = useSearchStore();

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSearch();
      }
    },
    [onClose, onSearch]
  );

  const handleSearchClick = useCallback(() => {
    onSearch();
  }, [onSearch]);

  const handleSideFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSideFilter(e.target.value as SideFilter);
    },
    [setSideFilter]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-modal-title"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        className="modal-content search-modal"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id="search-modal-title" className="modal-title">
            Find in All Files
          </h2>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={12} />
          </button>
        </div>

        {/* Search query */}
        <div className="search-modal-section">
          <label className="search-modal-label" htmlFor="search-query">
            Search:
          </label>
          <div className="search-modal-row">
            <input
              ref={inputRef}
              id="search-query"
              type="text"
              className="search-modal-input"
              placeholder="Search text..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-search-input
            />
            <SearchOptionsBar
              options={options}
              onToggleOption={toggleOption}
            />
          </div>
        </div>

        {/* File filter */}
        <div className="search-modal-section">
          <label className="search-modal-label" htmlFor="file-filter">
            File filter:
          </label>
          <div className="search-modal-row">
            <input
              id="file-filter"
              type="text"
              className="search-modal-input"
              placeholder="*.ts, src/**/*.tsx..."
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
            />
            <button
              type="button"
              className="search-option-btn"
              aria-pressed={fileFilterUseRegex}
              title="Use Regular Expression for file filter"
              onClick={() => setFileFilterUseRegex(!fileFilterUseRegex)}
            >
              .*
            </button>
          </div>
        </div>

        {/* Iteration range */}
        <div className="search-modal-section">
          <span className="search-modal-label">Iteration Range:</span>
          <IterationRangeSelect
            value={iterationScope}
            onChange={setIterationScope}
          />
        </div>

        {/* Side filter */}
        <div className="search-modal-section">
          <label className="search-modal-label" htmlFor="side-filter">
            Side:
          </label>
          <select
            id="side-filter"
            className="search-side-select select"
            value={sideFilter}
            onChange={handleSideFilterChange}
          >
            <option value="both">Both</option>
            <option value="left">Left only (deletions)</option>
            <option value="right">Right only (additions)</option>
          </select>
        </div>

        {/* Actions */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-colorful"
            onClick={handleSearchClick}
            disabled={!query.trim()}
          >
            Search
          </button>
        </div>
      </div>
    </div>
  );
}
