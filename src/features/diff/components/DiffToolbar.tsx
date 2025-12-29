/**
 * Toolbar for diff view controls (S-3.3)
 * AC-3.3.1-16: View mode toggles, content filter, keyboard shortcuts
 */

import { useEffect, useCallback } from 'react';
import { Columns2, FileText, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useDiffStore } from '../stores';
import type { DiffViewMode, ContentFilter } from '../types';

interface ToggleButtonProps {
  isActive: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  shortcut?: string;
  ariaLabel: string;
}

function ToggleButton({ isActive, onClick, icon, label, shortcut, ariaLabel }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={ariaLabel}
      title={shortcut ? `${ariaLabel} (${shortcut})` : ariaLabel}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500',
        isActive
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

interface ToggleGroupProps<T extends string> {
  options: { value: T; label: string; icon?: React.ReactNode; shortcut?: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: ToggleGroupProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-md shadow-sm"
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          title={option.shortcut ? `${option.label} (${option.shortcut})` : option.label}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 focus:z-10',
            // Border radius
            index === 0 && 'rounded-l-md',
            index === options.length - 1 && 'rounded-r-md',
            // Border
            'border',
            index > 0 && '-ml-px',
            // Colors
            value === option.value
              ? 'bg-blue-600 text-white border-blue-600 z-10'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          )}
        >
          {option.icon}
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * DiffToolbar - View mode and display controls
 */
export function DiffToolbar() {
  const {
    viewConfig,
    setViewMode,
    setContentFilter,
    toggleFullFile,
    toggleWhitespace,
  } = useDiffStore();

  // Keyboard shortcuts (AC-3.3.4)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ignore if modifier keys are pressed (avoid conflicts with browser shortcuts)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'u':
          setViewMode('unified');
          break;
        case 's':
          // Only switch if not already in split to avoid conflicts
          if (viewConfig.mode !== 'split') {
            setViewMode('split');
          }
          break;
      }
    },
    [setViewMode, viewConfig.mode]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const viewModeOptions: {
    value: DiffViewMode;
    label: string;
    icon: React.ReactNode;
    shortcut: string;
  }[] = [
    {
      value: 'unified',
      label: 'Unified',
      icon: <FileText className="w-4 h-4" aria-hidden />,
      shortcut: 'U',
    },
    {
      value: 'split',
      label: 'Split',
      icon: <Columns2 className="w-4 h-4" aria-hidden />,
      shortcut: 'S',
    },
  ];

  const contentFilterOptions: {
    value: ContentFilter;
    label: string;
  }[] = [
    { value: 'left', label: 'Left' },
    { value: 'both', label: 'Both' },
    { value: 'right', label: 'Right' },
  ];

  return (
    <div
      className="flex items-center gap-4 flex-wrap"
      role="toolbar"
      aria-label="Diff view controls"
    >
      {/* View Mode Toggle (AC-3.3.1-4) */}
      <ToggleGroup
        options={viewModeOptions}
        value={viewConfig.mode}
        onChange={setViewMode}
        ariaLabel="View mode"
      />

      {/* Content Filter Toggle (AC-3.3.5-15) - applies to both Unified and Split modes */}
      <ToggleGroup
        options={contentFilterOptions}
        value={viewConfig.filter}
        onChange={setContentFilter}
        ariaLabel="Content filter"
      />

      {/* Full File Toggle (AC-3.1.10-11) */}
      <ToggleButton
        isActive={viewConfig.showFullFile}
        onClick={toggleFullFile}
        icon={<FileText className="w-4 h-4" aria-hidden />}
        label={viewConfig.showFullFile ? 'Full file' : 'Changes only'}
        ariaLabel={viewConfig.showFullFile ? 'Show changes only' : 'Show full file'}
      />

      {/* Whitespace Toggle (AC-3.5.4-5) */}
      <ToggleButton
        isActive={viewConfig.showWhitespace}
        onClick={toggleWhitespace}
        icon={
          viewConfig.showWhitespace ? (
            <Eye className="w-4 h-4" aria-hidden />
          ) : (
            <EyeOff className="w-4 h-4" aria-hidden />
          )
        }
        label={viewConfig.showWhitespace ? 'WS visible' : 'WS hidden'}
        ariaLabel={
          viewConfig.showWhitespace
            ? 'Hide whitespace characters'
            : 'Show whitespace characters'
        }
      />
    </div>
  );
}
