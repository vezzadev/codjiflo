import type {
  GitHubPRCommit,
  GitHubTimelineForcePushEvent,
  GitHubTimelineOtherEvent,
  GitHubCompareCommit,
  GitHubCompareResponse,
} from '@/api/github/types';
import type {
  StatelessIteration,
  CollapsedIterationGroup,
  DiscardedCommit,
} from '@/features/iterations/types';

let commitCounter = 0;
let eventCounter = 0;

export function resetStatelessIterationFactoryCounters(): void {
  commitCounter = 0;
  eventCounter = 0;
}

function generateSha(prefix: string, counter: number): string {
  return `${prefix}${counter.toString().padStart(8, '0')}${'0'.repeat(32 - prefix.length - 8)}`;
}

export function createMockPRCommit(
  overrides?: Partial<GitHubPRCommit>
): GitHubPRCommit {
  commitCounter++;
  const sha = generateSha('c', commitCounter);
  return {
    sha,
    commit: {
      message: `Commit ${commitCounter}`,
      author: {
        name: 'Test User',
        email: 'test@example.com',
        date: new Date(2025, 0, commitCounter).toISOString(),
      },
    },
    author: {
      id: commitCounter,
      login: 'test-user',
      avatar_url: `https://avatars.example.com/${commitCounter}`,
    },
    ...overrides,
  };
}

export function createMockForcePushEvent(
  overrides?: Partial<GitHubTimelineForcePushEvent>
): GitHubTimelineForcePushEvent {
  eventCounter++;
  return {
    id: eventCounter,
    event: 'head_ref_force_pushed',
    created_at: new Date(2025, 0, eventCounter).toISOString(),
    before_commit: { sha: generateSha('b', eventCounter) },
    after_commit: { sha: generateSha('a', eventCounter) },
    ...overrides,
  };
}

export function createMockTimelineOtherEvent(
  event = 'commented',
  overrides?: Partial<GitHubTimelineOtherEvent>
): GitHubTimelineOtherEvent {
  eventCounter++;
  return {
    id: eventCounter,
    event,
    created_at: new Date(2025, 0, eventCounter).toISOString(),
    ...overrides,
  };
}

export function createMockCompareCommit(
  overrides?: Partial<GitHubCompareCommit>
): GitHubCompareCommit {
  commitCounter++;
  const sha = generateSha('d', commitCounter);
  return {
    sha,
    commit: {
      message: `Discarded commit ${commitCounter}`,
      author: {
        name: 'Test User',
        email: 'test@example.com',
        date: new Date(2025, 0, commitCounter).toISOString(),
      },
    },
    author: {
      id: commitCounter,
      login: 'test-user',
      avatar_url: `https://avatars.example.com/${commitCounter}`,
    },
    ...overrides,
  };
}

export function createMockCompareResponse(
  commits: GitHubCompareCommit[] = [],
  overrides?: Partial<GitHubCompareResponse>
): GitHubCompareResponse {
  return {
    commits,
    status: 'diverged',
    ahead_by: commits.length,
    behind_by: 0,
    ...overrides,
  };
}

export function createMockStatelessIteration(
  overrides?: Partial<StatelessIteration>
): StatelessIteration {
  commitCounter++;
  return {
    revision: commitCounter,
    commitSha: generateSha('c', commitCounter),
    baseSha: generateSha('base', 1),
    author: 'test-user',
    createdAt: new Date(2025, 0, commitCounter).toISOString(),
    status: 'live',
    ...overrides,
  };
}

export function createMockCollapsedGroup(
  overrides?: Partial<CollapsedIterationGroup>
): CollapsedIterationGroup {
  eventCounter++;
  return {
    forcePushEventId: eventCounter,
    discardedRevisions: [],
    commits: [],
    reason: 'force_push',
    visibility: 'collapsed',
    ...overrides,
  };
}

export function createMockDiscardedCommit(
  overrides?: Partial<DiscardedCommit>
): DiscardedCommit {
  commitCounter++;
  return {
    sha: generateSha('d', commitCounter),
    message: `Discarded commit ${commitCounter}`,
    author: 'test-user',
    date: new Date(2025, 0, commitCounter).toISOString(),
    status: 'available',
    ...overrides,
  };
}
