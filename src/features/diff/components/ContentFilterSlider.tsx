import { useCallback, useEffect, useRef, useState } from 'react';
import { RadioGroup, Radio } from 'react-aria-components';
import type { ContentFilter } from '../types';

const FILTER_POSITIONS: ContentFilter[] = ['left', 'both', 'right'];
const FILTER_LABELS: { [key in ContentFilter]: string } = {
  left: 'Left Only',
  both: 'Show Both',
  right: 'Right Only',
};

interface ContentFilterSliderProps {
  value: ContentFilter;
  onChange: (value: ContentFilter) => void;
}

/** Three-stop radiogroup for content filter (left/both/right). */
export function ContentFilterSlider({ value, onChange }: ContentFilterSliderProps) {
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
    <RadioGroup
      className="content-filter-slider"
      aria-label="Content filter"
      value={value}
      onChange={(v) => { onChange(v as ContentFilter); }}
    >
      <div
        ref={trackRef}
        className="content-filter-track"
        title={dragHints[value]}
        onMouseDown={handleMouseDown}
      >
        {/* Color indicators: red (left/deletions) and green (right/additions) */}
        <span className="content-filter-indicator content-filter-indicator-left" aria-hidden="true" />
        <span className="content-filter-indicator content-filter-indicator-right" aria-hidden="true" />

        {/* react-aria Radio renders a hidden native input + visible label wrapper */}
        {FILTER_POSITIONS.map((position) => (
          <Radio
            key={position}
            value={position}
            aria-label={FILTER_LABELS[position]}
            className={`content-filter-option content-filter-option-${position}`}
          >
            <span
              className="content-filter-thumb"
              aria-hidden="true"
            >
              {FILTER_LABELS[position]}
            </span>
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}
