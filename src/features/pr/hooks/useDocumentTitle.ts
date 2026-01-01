import { useEffect } from 'react';
import { Review } from '@/api/types';

interface UseDocumentTitleParams {
  currentPR: Review | null;
  owner: string;
  repo: string;
  number: string;
}

export function useDocumentTitle({
  currentPR,
  owner,
  repo,
  number,
}: UseDocumentTitleParams): void {
  useEffect(() => {
    if (currentPR) {
      document.title = `${currentPR.title} by ${currentPR.author.displayName} · PR #${currentPR.number} · ${owner}/${repo}`;
    } else {
      document.title = `PR #${number} · ${owner}/${repo}`;
    }
  }, [currentPR, owner, repo, number]);
}
