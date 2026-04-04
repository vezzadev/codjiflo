/**
 * Toolbar for diff view controls (S-3.3)
 * AC-3.3.1-16: View mode toggles, content filter, keyboard shortcuts
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { Eye, EyeOff, FileDiff, FileText, ChevronUp, ChevronDown, MessageSquare, MessageSquareOff, AlignJustify, WrapText } from 'lucide-react';
import { Select, Button as AriaButton, Popover, ListBox, ListBoxItem } from 'react-aria-components';
import type { Key } from 'react-aria-components';
import { useDiffStore } from '../stores';
import type { ContentFilter } from '../types';

// Icon color constants (defined outside components to avoid recreation on each render)
const ICON_COLORS = {
  w: 'var(--diff-area-bg)',
  r: 'var(--diff-delete-word)',
  g: 'var(--diff-add-word)',
  border: 'var(--combobox-border)',
} as const;

// Pattern: white, red, red, green, green, green, white, red, red, red, white, white, white, white
const INLINE_ROWS = [
  ICON_COLORS.w, ICON_COLORS.r, ICON_COLORS.r, ICON_COLORS.g, ICON_COLORS.g, ICON_COLORS.g,
  ICON_COLORS.w, ICON_COLORS.r, ICON_COLORS.r, ICON_COLORS.r, ICON_COLORS.w, ICON_COLORS.w,
  ICON_COLORS.w, ICON_COLORS.w,
];

// Left: white, red, red, white, white, white, white, red, red, red, white, white, white, white
const SXS_LEFT_ROWS = [
  ICON_COLORS.w, ICON_COLORS.r, ICON_COLORS.r, ICON_COLORS.w, ICON_COLORS.w, ICON_COLORS.w,
  ICON_COLORS.w, ICON_COLORS.r, ICON_COLORS.r, ICON_COLORS.r, ICON_COLORS.w, ICON_COLORS.w,
  ICON_COLORS.w, ICON_COLORS.w,
];

// Right: white, white, white, green, green, green, white, white, white, white, white, white, white, white
const SXS_RIGHT_ROWS = [
  ICON_COLORS.w, ICON_COLORS.w, ICON_COLORS.w, ICON_COLORS.g, ICON_COLORS.g, ICON_COLORS.g,
  ICON_COLORS.w, ICON_COLORS.w, ICON_COLORS.w, ICON_COLORS.w, ICON_COLORS.w, ICON_COLORS.w,
  ICON_COLORS.w, ICON_COLORS.w,
];

/** Inline view icon - inline diff pattern */
function InlineIcon() {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden className="btn-toolbar-icon">
      {INLINE_ROWS.map((color, i) => (
        <rect key={i} x="1" y={1 + i} width="10" height="1" fill={color} />
      ))}
      <rect x="0.5" y="0.5" width="11" height="15" fill="none" stroke={ICON_COLORS.border} strokeWidth="1" />
    </svg>
  );
}

/** Side-by-side view icon - split diff pattern */
function SxSIcon() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" aria-hidden className="btn-toolbar-icon">
      {SXS_LEFT_ROWS.map((color, i) => (
        <rect key={`l${i}`} x="1" y={1 + i} width="10" height="1" fill={color} />
      ))}
      {SXS_RIGHT_ROWS.map((color, i) => (
        <rect key={`r${i}`} x="13" y={1 + i} width="10" height="1" fill={color} />
      ))}
      <rect x="0.5" y="0.5" width="23" height="15" fill="none" stroke={ICON_COLORS.border} strokeWidth="1" />
      <line x1="12" y1="1" x2="12" y2="15" stroke={ICON_COLORS.border} strokeWidth="1" />
    </svg>
  );
}

interface ToolbarSelectOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface ToolbarSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ToolbarSelectOption<T>[];
  ariaLabel: string;
  tooltip?: string;
}

/** Accessible dropdown using React Aria Select */
function ToolbarSelect<T extends string>({ value, onChange, options, ariaLabel, tooltip }: ToolbarSelectProps<T>) {
  const selectedOption = options.find(opt => opt.value === value) ?? options[0];

  return (
    <Select
      value={value}
      onChange={(key: Key | null) => { if (key !== null) onChange(key as T); }}
      aria-label={ariaLabel}
    >
      <AriaButton className="toolbar-dropdown-button" {...(tooltip ? { title: tooltip } : {})}>
        {selectedOption?.icon}
        <span className="toolbar-dropdown-label">{selectedOption?.label}</span>
        <svg className="toolbar-dropdown-arrow" width="8" height="8" viewBox="0 0 8 8" aria-hidden>
          <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </AriaButton>
      <Popover className="toolbar-dropdown-listbox-popover toolbar-dropdown-listbox">
        <ListBox>
          {options.map((opt) => (
            <ListBoxItem
              key={opt.value}
              id={opt.value}
              className={({ isSelected }) => `toolbar-dropdown-option ${isSelected ? 'selected' : ''}`}
              textValue={opt.label}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}

// Content filter constants (defined outside component to avoid recreation on each render)
const FILTER_POSITIONS: ContentFilter[] = ['left', 'both', 'right'];
const FILTER_LABELS: { [key in ContentFilter]: string } = {
  left: 'Left Only',
  both: 'Show Both',
  right: 'Right Only',
};

/** Three-stop radiogroup for content filter (left/both/right) */
interface ContentFilterSliderProps {
  value: ContentFilter;
  onChange: (value: ContentFilter) => void;
}

function ContentFilterSlider({ value, onChange }: ContentFilterSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Dynamic tooltip hints based on current position
  const dragHints: { [key in ContentFilter]: string } = {
    left: 'Drag for Both (O) or Right Only (R)',
    both: 'Drag for Left Only (L) or Right Only (R)',
    right: 'Drag for Left Only (L) or Both (O)',
  };

  const updatePositionFromMouse = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const width = rect.width;
    const ratio = Math.max(0, Math.min(1, x / width));

    // Snap to nearest position
    if (ratio < 0.33) {
      onChange('left');
    } else if (ratio < 0.67) {
      onChange('both');
    } else {
      onChange('right');
    }
  }, [onChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updatePositionFromMouse(e.clientX);
  }, [updatePositionFromMouse]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updatePositionFromMouse(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, updatePositionFromMouse]);

  return (
    <fieldset
      className="content-filter-slider"
      role="radiogroup"
      aria-label="Content filter"
      title={dragHints[value]}
    >
      <legend className="sr-only">Content filter</legend>
      <div
        ref={trackRef}
        className="content-filter-track"
        onMouseDown={handleMouseDown}
      >
        {/* Color indicators: red (left/deletions) and green (right/additions) */}
        <span className="content-filter-indicator content-filter-indicator-left" aria-hidden="true" />
        <span className="content-filter-indicator content-filter-indicator-right" aria-hidden="true" />

        {/* Semantic radio inputs with visual thumb */}
        {FILTER_POSITIONS.map((position) => (
          <label
            key={position}
            className={`content-filter-option content-filter-option-${position}`}
          >
            <input
              type="radio"
              name="content-filter"
              value={position}
              checked={value === position}
              onChange={() => onChange(position)}
              className="sr-only"
              aria-label={FILTER_LABELS[position]}
              tabIndex={value === position ? 0 : -1}
            />
            <span
              className="content-filter-thumb"
              aria-hidden="true"
            >
              {FILTER_LABELS[position]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
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
    toggleComments,
    setTextWrap,
    scrollToNextChange,
    scrollToPreviousChange,
    currentChangeIndex,
    totalChangeCount,
  } = useDiffStore();

  // Derived state for button disabled status
  const canGoPrevious = currentChangeIndex > 0;
  const canGoNext = totalChangeCount > 0 && currentChangeIndex < totalChangeCount - 1;

  // Keyboard shortcuts (AC-3.3.4) - consolidated handler for all toolbar shortcuts
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
        // View mode shortcuts
        case 'i':
          event.preventDefault();
          setViewMode('inline');
          break;
        case 'x':
          // X for "switch" to side-by-side view
          if (viewConfig.mode !== 'split') {
            event.preventDefault();
            setViewMode('split');
          }
          break;
        // Content filter shortcuts
        case 'l':
          event.preventDefault();
          setContentFilter('left');
          break;
        case 'o':
          // O for "bOth" content filter
          event.preventDefault();
          setContentFilter('both');
          break;
        case 'r':
          event.preventDefault();
          setContentFilter('right');
          break;
        // Display mode shortcuts
        case 'f':
          // Show full file
          if (!viewConfig.showFullFile) {
            event.preventDefault();
            toggleFullFile();
          }
          break;
        case 'c':
          // Show changes only
          if (viewConfig.showFullFile) {
            event.preventDefault();
            toggleFullFile();
          }
          break;
        case 'b':
          // B for whitespace toggle
          event.preventDefault();
          toggleWhitespace();
          break;
        case 'd':
          // D for comments toggle
          event.preventDefault();
          toggleComments();
          break;
        case 'p':
          // P for text wrap toggle
          event.preventDefault();
          setTextWrap(viewConfig.textWrap === 'wrap' ? 'nowrap' : 'wrap');
          break;
      }
    },
    [setViewMode, setContentFilter, viewConfig.mode, viewConfig.showFullFile, viewConfig.textWrap, toggleFullFile, toggleWhitespace, toggleComments, setTextWrap]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="toolbar-right" role="toolbar" aria-label="Diff view controls">
      {/* Content Filter Slider (AC-3.3.5-15) */}
      <ContentFilterSlider
        value={viewConfig.filter}
        onChange={setContentFilter}
      />

      {/* View Mode Select (AC-3.3.1-4) */}
      <ToolbarSelect
        value={viewConfig.mode}
        onChange={setViewMode}
        options={[
          { value: 'inline', label: 'Inline', icon: <InlineIcon /> },
          { value: 'split', label: 'Side-by-Side', icon: <SxSIcon /> },
        ]}
        ariaLabel="View mode"
        tooltip="View mode (I: Inline, X: Side-by-Side)"
      />

      {/* Full File Select (AC-3.1.10-11) */}
      <ToolbarSelect
        value={viewConfig.showFullFile ? 'full' : 'changes'}
        onChange={(v) => {
          const wantsFull = v === 'full';
          if (wantsFull !== viewConfig.showFullFile) toggleFullFile();
        }}
        options={[
          { value: 'changes', label: 'Changes', icon: <FileDiff className="w-4 h-4" aria-hidden /> },
          { value: 'full', label: 'Full File', icon: <FileText className="w-4 h-4" aria-hidden /> },
        ]}
        ariaLabel="File content"
        tooltip="File content (C: Changes, F: Full File)"
      />

      {/* Whitespace Select (AC-3.5.4-5) */}
      <ToolbarSelect
        value={viewConfig.showWhitespace ? 'visible' : 'hidden'}
        onChange={(v) => {
          const wantsVisible = v === 'visible';
          if (wantsVisible !== viewConfig.showWhitespace) toggleWhitespace();
        }}
        options={[
          { value: 'hidden', label: 'WS: Hidden', icon: <EyeOff className="w-4 h-4" aria-hidden /> },
          { value: 'visible', label: 'WS: Visible', icon: <Eye className="w-4 h-4" aria-hidden /> },
        ]}
        ariaLabel="Whitespace visibility"
        tooltip="Whitespace visibility (B: Toggle)"
      />

      {/* Text Wrap Select */}
      <ToolbarSelect
        value={viewConfig.textWrap}
        onChange={setTextWrap}
        options={[
          { value: 'nowrap', label: 'No Wrap', icon: <AlignJustify className="w-4 h-4" aria-hidden /> },
          { value: 'wrap', label: 'Wrap', icon: <WrapText className="w-4 h-4" aria-hidden /> },
        ]}
        ariaLabel="Text wrap"
        tooltip="Text wrap (P: Toggle)"
      />

      {/* Separator before comments */}
      <span className="toolbar-separator" aria-hidden="true" />

      {/* Comments Select */}
      <ToolbarSelect
        value={viewConfig.showComments ? 'visible' : 'hidden'}
        onChange={(v) => {
          const wantsVisible = v === 'visible';
          if (wantsVisible !== viewConfig.showComments) toggleComments();
        }}
        options={[
          { value: 'hidden', label: 'Comments: Hidden', icon: <MessageSquareOff className="w-4 h-4" aria-hidden /> },
          { value: 'visible', label: 'Comments: Visible', icon: <MessageSquare className="w-4 h-4" aria-hidden /> },
        ]}
        ariaLabel="Comments visibility"
        tooltip="Comments visibility (D: Toggle)"
      />

      {/* Change Navigation Buttons */}
      <div className="btn-group-nav">
        <button
          type="button"
          onClick={scrollToNextChange}
          disabled={!canGoNext}
          aria-label="Next change (J)"
          title="Next change (J)"
          className="btn-toolbar btn-nav"
        >
          <ChevronDown className="w-4 h-4" aria-hidden />
          <span className="btn-nav-hint">J</span>
        </button>
        <button
          type="button"
          onClick={scrollToPreviousChange}
          disabled={!canGoPrevious}
          aria-label="Previous change (K)"
          title="Previous change (K)"
          className="btn-toolbar btn-nav"
        >
          <ChevronUp className="w-4 h-4" aria-hidden />
          <span className="btn-nav-hint">K</span>
        </button>
      </div>
    </div>
  );
}
