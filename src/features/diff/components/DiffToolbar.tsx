/**
 * Toolbar for diff view controls (S-3.3)
 * AC-3.3.1-16: View mode toggles, content filter, keyboard shortcuts
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { Eye, EyeOff, File } from 'lucide-react';
import { useDiffStore } from '../stores';
import type { ContentFilter } from '../types';

/** Inline view icon - unified diff pattern */
function InlineIcon() {
  // Pattern: white, red, red, green, green, green, white, red, red, red, white, white, white, white
  const w = 'var(--main-bg)';
  const r = 'var(--diff-delete-word)';
  const g = 'var(--diff-add-word)';
  const rows = [w, r, r, g, g, g, w, r, r, r, w, w, w, w];

  return (
    <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden className="btn-toolbar-icon">
      {rows.map((color, i) => (
        <rect key={i} x="1" y={1 + i} width="10" height="1" fill={color} />
      ))}
      <rect x="0.5" y="0.5" width="11" height="15" fill="none" stroke="var(--combobox-border)" strokeWidth="1" />
    </svg>
  );
}

/** Side-by-side view icon - split diff pattern */
function SxSIcon() {
  // Left side shows deletions (red) where inline has red
  // Right side shows additions (green) where inline has green
  const w = 'var(--main-bg)';
  const r = 'var(--diff-delete-word)';
  const g = 'var(--diff-add-word)';
  // Inline: white, red, red, green, green, green, white, red, red, red, white, white, white, white
  // Left:   white, red, red, white, white, white, white, red, red, red, white, white, white, white
  const leftRows = [w, r, r, w, w, w, w, r, r, r, w, w, w, w];
  // Right:  white, white, white, green, green, green, white, white, white, white, white, white, white, white
  const rightRows = [w, w, w, g, g, g, w, w, w, w, w, w, w, w];

  return (
    <svg width="24" height="16" viewBox="0 0 24 16" aria-hidden className="btn-toolbar-icon">
      {leftRows.map((color, i) => (
        <rect key={`l${i}`} x="1" y={1 + i} width="10" height="1" fill={color} />
      ))}
      {rightRows.map((color, i) => (
        <rect key={`r${i}`} x="13" y={1 + i} width="10" height="1" fill={color} />
      ))}
      <rect x="0.5" y="0.5" width="23" height="15" fill="none" stroke="var(--combobox-border)" strokeWidth="1" />
      <line x1="12" y1="1" x2="12" y2="15" stroke="var(--combobox-border)" strokeWidth="1" />
    </svg>
  );
}

interface ToggleButtonProps {
  isActive: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  shortcut?: string;
  ariaLabel: string;
  className?: string;
}

function ToggleButton({ isActive, onClick, icon, label, shortcut, ariaLabel, className }: ToggleButtonProps) {
  const classes = ['btn-toggle', 'btn-toolbar', isActive ? 'active' : '', className].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={ariaLabel}
      title={shortcut ? `${ariaLabel} (${shortcut})` : ariaLabel}
      className={classes}
    >
      {icon}
      <span className="btn-label">{label}</span>
    </button>
  );
}

/** Three-stop slider for content filter (left/both/right) */
interface ContentFilterSliderProps {
  value: ContentFilter;
  onChange: (value: ContentFilter) => void;
}

function ContentFilterSlider({ value, onChange }: ContentFilterSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const positions: ContentFilter[] = ['left', 'both', 'right'];

  const labels: Record<ContentFilter, string> = {
    left: 'Left Only',
    both: 'Show Both',
    right: 'Right Only',
  };

  // Dynamic tooltip hints based on current position
  const dragHints: Record<ContentFilter, string> = {
    left: 'Drag for Both (B) or Right Only (R)',
    both: 'Drag for Left Only (L) or Right Only (R)',
    right: 'Drag for Left Only (L) or Both (B)',
  };

  // Keyboard shortcuts for content filter
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ignore if modifier keys are pressed
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'l':
          onChange('left');
          break;
        case 'b':
          onChange('both');
          break;
        case 'r':
          onChange('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onChange]);

  const handleClick = (filter: ContentFilter) => {
    onChange(filter);
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
    <div
      className="content-filter-slider"
      role="slider"
      aria-label="Content filter"
      aria-valuemin={0}
      aria-valuemax={2}
      aria-valuenow={positions.indexOf(value)}
      aria-valuetext={labels[value]}
      title={dragHints[value]}
    >
      <div
        ref={trackRef}
        className="content-filter-track"
        onMouseDown={handleMouseDown}
      >
        {/* Color indicators: red (left/deletions) and green (right/additions) */}
        <span className="content-filter-indicator content-filter-indicator-left" />
        <span className="content-filter-indicator content-filter-indicator-right" />

        {/* Thumb with label */}
        <div
          className={`content-filter-thumb content-filter-thumb-${value}`}
        >
          <span className="content-filter-thumb-label">{labels[value]}</span>
        </div>
      </div>

      {/* Clickable labels */}
      <div className="content-filter-labels">
        {positions.map((pos) => (
          <button
            key={pos}
            type="button"
            className={`content-filter-label ${value === pos ? 'active' : ''}`}
            onClick={() => handleClick(pos)}
          >
            {labels[pos]}
          </button>
        ))}
      </div>
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

  // Toggle between unified and split view
  const handleViewModeToggle = useCallback(() => {
    setViewMode(viewConfig.mode === 'unified' ? 'split' : 'unified');
  }, [viewConfig.mode, setViewMode]);

  return (
    <div className="toolbar-right" role="toolbar" aria-label="Diff view controls">
      {/* Content Filter Slider (AC-3.3.5-15) */}
      <ContentFilterSlider
        value={viewConfig.filter}
        onChange={setContentFilter}
      />

      {/* View Mode Toggle - Single button (AC-3.3.1-4) */}
      <ToggleButton
        isActive={false}
        onClick={handleViewModeToggle}
        icon={viewConfig.mode === 'split' ? <SxSIcon /> : <InlineIcon />}
        label={viewConfig.mode === 'split' ? 'SxS' : 'Inline'}
        shortcut={viewConfig.mode === 'split' ? 'U' : 'S'}
        ariaLabel={viewConfig.mode === 'split' ? 'Switch to unified view' : 'Switch to side-by-side view'}
        className="btn-toolbar-wide"
      />

      {/* Full File Toggle (AC-3.1.10-11) */}
      <ToggleButton
        isActive={false}
        onClick={toggleFullFile}
        icon={<File className="w-4 h-4" aria-hidden />}
        label={viewConfig.showFullFile ? 'Full' : 'Changes'}
        ariaLabel={viewConfig.showFullFile ? 'Show changes only' : 'Show full file'}
        className="btn-toolbar-wide"
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
        label="a · b"
        ariaLabel={
          viewConfig.showWhitespace
            ? 'Hide whitespace characters'
            : 'Show whitespace characters'
        }
        className="btn-toolbar-wide"
      />
    </div>
  );
}
