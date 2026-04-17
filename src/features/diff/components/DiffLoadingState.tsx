/**
 * Diff Loading State Component
 *
 * Shows a skeleton loading state while diff content is being loaded.
 */

import { Skeleton } from '@/components/ui';

/** Number of skeleton lines to show */
const SKELETON_LINE_COUNT = 20;

/**
 * Loading skeleton for diff view.
 */
export function DiffLoadingState() {
  return (
    <div className="diff-loading" role="status" aria-label="Loading diff">
      {Array.from({ length: SKELETON_LINE_COUNT }).map((_, i) => (
        <Skeleton key={i} className="skeleton-line" />
      ))}
    </div>
  );
}
