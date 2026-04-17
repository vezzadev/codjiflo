import type { Review } from '@/api/types';

export type PRErrorKind = 'not-found' | 'private-repo' | 'forbidden' | 'generic';

export interface PRError {
  message: string;
  kind: PRErrorKind;
}

export interface PRState {
  currentPR: Review | null;
  isLoading: boolean;
  error: PRError | null;
  loadPR: (owner: string, repo: string, number: number) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export interface ParsedPRUrl {
  owner: string;
  repo: string;
  number: number;
}
