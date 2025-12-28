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
      <div className="p-6 bg-white border-b" role="alert" aria-live="polite">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (isLoading || !currentPR) {
    return (
      <div className="p-6 bg-white border-b">
        {/* Title skeleton */}
        <Skeleton className="h-9 w-3/4 mb-4" />
        {/* Metadata skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-b">
      <PRMetadata pr={currentPR} />
    </div>
  );
}
