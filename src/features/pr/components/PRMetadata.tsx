import Image from 'next/image';
import type { Review } from '@/api/types';
import { Badge } from '@/components/ui';

interface PRMetadataProps {
  pr: Review;
}

/**
 * Displays PR metadata: title, author, state badge, branches
 * S-1.2: AC-1.2.1 through AC-1.2.6
 */
export function PRMetadata({ pr }: PRMetadataProps) {
  return (
    <div className="pr-metadata">
      {/* Title - H1 per AC-1.2.8 */}
      <h1 className="pr-title">
        {pr.title}
      </h1>

      <div className="pr-meta-row">
        {/* Author avatar and name - AC-1.2.3 */}
        <div className="pr-author">
          <Image
            src={pr.author.avatarUrl}
            alt={`${pr.author.displayName}'s avatar`}
            width={32}
            height={32}
            className="pr-author-avatar"
          />
          <span className="pr-author-name">{pr.author.displayName}</span>
        </div>

        {/* State badge - AC-1.2.4 */}
        <Badge state={pr.state} />

        {/* Branches - AC-1.2.5 */}
        <span className="pr-branches">
          <code className="branch-name">
            {pr.sourceBranch}
          </code>
          <span className="branch-separator">into</span>
          <code className="branch-name">
            {pr.targetBranch}
          </code>
        </span>
      </div>
    </div>
  );
}
