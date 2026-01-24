/**
 * Floating Comment Button Component
 *
 * Appears near a text selection to allow users to add comments.
 * Part of S-5.1: Multi-line/Region Comments
 */

import { Plus } from 'lucide-react';
import type { SelectionPosition } from '../hooks/useRegionSelection';
import type { CommentRegion } from '../types';

export interface RegionCommentButtonProps {
  /** Position for the button */
  position: SelectionPosition;
  /** The selected region */
  region: CommentRegion;
  /** Handler when the add comment button is clicked */
  onAddComment: () => void;
  /** Accessible label for screen readers */
  ariaLabel?: string;
}

/**
 * Floating button that appears near a text selection
 */
export function RegionCommentButton({
  position,
  region,
  onAddComment,
  ariaLabel,
}: RegionCommentButtonProps) {
  const lineCount = region.endLine - region.startLine + 1;
  const label = ariaLabel ?? (
    lineCount > 1
      ? `Add comment to lines ${region.startLine}-${region.endLine}`
      : `Add comment to line ${region.startLine}`
  );

  return (
    <button
      type="button"
      className="region-comment-button"
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(8px, -50%)',
      }}
      onClick={onAddComment}
      aria-label={label}
      title={label}
    >
      <Plus size={16} aria-hidden="true" />
    </button>
  );
}
