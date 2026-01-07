'use client';

import { ChevronRight, ChevronUp } from 'lucide-react';

interface CollapseBarProps {
  direction: 'horizontal' | 'vertical';
  onExpand: () => void;
  'aria-label'?: string;
}

export function CollapseBar({
  direction,
  onExpand,
  'aria-label': ariaLabel,
}: CollapseBarProps) {
  const className =
    direction === 'horizontal' ? 'collapse-bar-left' : 'collapse-bar-bottom';

  const Icon = direction === 'horizontal' ? ChevronRight : ChevronUp;
  const defaultLabel =
    direction === 'horizontal' ? 'Expand left pane' : 'Expand bottom pane';

  return (
    <button
      className={`collapse-bar ${className}`}
      onClick={onExpand}
      aria-label={ariaLabel ?? defaultLabel}
      type="button"
    >
      <Icon size={14} />
    </button>
  );
}
