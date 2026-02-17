/**
 * Diff Empty State Component
 *
 * Shows appropriate message when no diff content is available.
 */

export type DiffEmptyStateVariant = 'no-file' | 'no-patch' | 'no-pr';

interface DiffEmptyStateProps {
  /** The type of empty state to display */
  variant: DiffEmptyStateVariant;
}

/**
 * Empty state messages for different scenarios.
 */
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style -- String literal union-keyed Record is more precise than index signature
const EMPTY_STATE_MESSAGES: Record<DiffEmptyStateVariant, { title: string; subtitle?: string }> = {
  'no-file': {
    title: 'Select a file to view diff',
  },
  'no-patch': {
    title: 'No diff available',
    subtitle: '(binary file or too large)',
  },
  'no-pr': {
    title: 'No PR data available',
  },
};

/**
 * Empty state display for diff view.
 */
export function DiffEmptyState({ variant }: DiffEmptyStateProps) {
  const { title, subtitle } = EMPTY_STATE_MESSAGES[variant];

  return (
    <div className="diff-empty-state">
      <p>{title}</p>
      {subtitle && <p className="diff-empty-subtext">{subtitle}</p>}
    </div>
  );
}
