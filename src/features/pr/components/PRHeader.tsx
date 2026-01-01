import { usePRStore } from '../stores';
import { Skeleton } from '@/components/ui';
import { PRMetadata } from './PRMetadata';

/**
 * PR Header section with metadata
 * S-1.2: AC-1.2.7 - Skeleton loader while fetching
 */
export function PRHeader() {
  const { currentPR, isLoading, error } = usePRStore();

  if (error) {
    return (
      <div className="pr-header pr-header-error" role="alert" aria-live="polite">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (isLoading || !currentPR) {
    return (
      <div className="pr-header">
        {/* Title skeleton */}
        <Skeleton className="skeleton-title" />
        {/* Metadata skeleton */}
        <div className="pr-header-skeleton-meta">
          <Skeleton className="skeleton-avatar" />
          <Skeleton className="skeleton-text-short" />
          <Skeleton className="skeleton-badge" />
        </div>
      </div>
    );
  }

  return (
    <div className="pr-header-wrapper">
      <PRMetadata pr={currentPR} />
    </div>
  );
}
