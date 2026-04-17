import { ReviewState } from '@/api/types';

interface BadgeProps {
  state: ReviewState;
  className?: string;
}

const STATE_CSS_CLASSES: { [key in ReviewState]: string } = {
  [ReviewState.Open]: 'badge badge-success',
  [ReviewState.Closed]: 'badge badge-error',
  [ReviewState.Merged]: 'badge badge-merged',
  [ReviewState.Draft]: 'badge',
};

const STATE_LABELS: { [key in ReviewState]: string } = {
  [ReviewState.Open]: 'Open',
  [ReviewState.Closed]: 'Closed',
  [ReviewState.Merged]: 'Merged',
  [ReviewState.Draft]: 'Draft',
};

/**
 * Badge component for displaying PR state
 * Uses color + text for accessibility (not just color)
 */
export function Badge({ state, className }: BadgeProps) {
  const classes = [STATE_CSS_CLASSES[state], className].filter(Boolean).join(' ');

  return (
    <span
      className={classes}
      aria-label={`Pull request status: ${STATE_LABELS[state]}`}
    >
      {STATE_LABELS[state]}
    </span>
  );
}
