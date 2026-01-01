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
  const prTitle = currentPR?.title;
  const prAuthor = currentPR?.author.displayName;
  const prNumber = currentPR?.number;

  useEffect(() => {
    if (prTitle && prAuthor && prNumber !== undefined) {
      document.title = `${prTitle} by ${prAuthor} · PR #${prNumber} · ${owner}/${repo}`;
    } else {
      document.title = `PR #${number} · ${owner}/${repo}`;
    }
  }, [prTitle, prAuthor, prNumber, owner, repo, number]);
}
