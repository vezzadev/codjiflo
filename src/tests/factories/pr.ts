import { Review, Author, ReviewState } from '@/api/types';

let idCounter = 0;

export function createMockAuthor(overrides: Partial<Author> = {}): Author {
  idCounter++;
  return {
    id: `user-${idCounter}`,
    displayName: `User ${idCounter}`,
    avatarUrl: `https://avatars.githubusercontent.com/u/${idCounter}`,
    ...overrides,
  };
}

export function createMockReview(overrides: Partial<Review> = {}): Review {
  idCounter++;
  return {
    id: idCounter,
    number: idCounter,
    title: `Test Pull Request #${idCounter}`,
    description: 'This is a test description for the pull request.',
    state: ReviewState.Open,
    author: createMockAuthor(),
    sourceBranch: 'feature/test-branch',
    targetBranch: 'main',
    baseSha: 'abc123def456',
    headSha: '789ghi012jkl',
    htmlUrl: `https://github.com/owner/repo/pull/${idCounter}`,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-02T15:30:00Z'),
    ...overrides,
  };
}

export function resetFactoryCounters() {
  idCounter = 0;
}
