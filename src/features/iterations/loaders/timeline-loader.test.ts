/**
 * Tests for Timeline Loader (Task 1.3)
 *
 * Tests loading force-push events from GitHub Timeline API with:
 * - Successful extraction of head_ref_force_pushed events
 * - Pagination handling via Link header
 * - Optional token support (authenticated vs unauthenticated)
 * - OTel tracing instrumentation
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { loadTimeline } from './timeline-loader';

// Mock the auth store
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

// Create a reusable mock span factory
function createMockSpan() {
  return {
    setAttribute: vi.fn(),
    addEvent: vi.fn(),
    setStatus: vi.fn(),
    end: vi.fn(),
    getContext: vi.fn().mockReturnValue({ traceId: 'test-trace', spanId: 'test-span' }),
  };
}

// Mock the tracing module
vi.mock('@/lib/tracing', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/tracing')>();
  return {
    ...original,
    tracer: {
      startSpan: vi.fn(() => createMockSpan()),
    },
  };
});

import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { tracer } from '@/lib/tracing';

/**
 * Create a mock GitHub timeline event
 */
function createTimelineEvent(
  event: string,
  options?: {
    before?: string;
    after?: string;
    createdAt?: string;
    actor?: string;
  }
): Record<string, unknown> {
  const baseEvent: Record<string, unknown> = { event };

  if (options?.before) {
    baseEvent.before = { sha: options.before };
  }
  if (options?.after) {
    baseEvent.after = { sha: options.after };
  }
  if (options?.createdAt) {
    baseEvent.created_at = options.createdAt;
  }
  if (options?.actor) {
    baseEvent.actor = { login: options.actor };
  }

  return baseEvent;
}

describe('loadTimeline', () => {
  let consoleSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.mocked(useAuthStore.getState).mockReturnValue({ token: 'ghp_test123' } as never);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('basic functionality', () => {
    it('returns empty array when no force-push events exist', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve([
            createTimelineEvent('committed'),
            createTimelineEvent('reviewed'),
            createTimelineEvent('commented'),
          ]),
      });

      const result = await loadTimeline('owner', 'repo', 123);

      expect(result).toEqual([]);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/issues/123/timeline?per_page=100',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/vnd.github.v3+json',
          }) as Record<string, string>,
        })
      );
    });

    it('extracts head_ref_force_pushed events correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve([
            createTimelineEvent('committed'),
            createTimelineEvent('head_ref_force_pushed', {
              before: 'abc123',
              after: 'def456',
              createdAt: '2024-01-15T10:00:00Z',
              actor: 'developer',
            }),
            createTimelineEvent('reviewed'),
          ]),
      });

      const result = await loadTimeline('owner', 'repo', 123);

      expect(result).toHaveLength(1);
      const event = result[0];
      expect(event).toBeDefined();
      expect(event?.beforeSha).toBe('abc123');
      expect(event?.afterSha).toBe('def456');
      expect(event?.timestamp).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(event?.actor).toBe('developer');
    });

    it('extracts multiple force-push events', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve([
            createTimelineEvent('head_ref_force_pushed', {
              before: 'sha1',
              after: 'sha2',
              createdAt: '2024-01-15T10:00:00Z',
              actor: 'user1',
            }),
            createTimelineEvent('committed'),
            createTimelineEvent('head_ref_force_pushed', {
              before: 'sha3',
              after: 'sha4',
              createdAt: '2024-01-15T11:00:00Z',
              actor: 'user2',
            }),
          ]),
      });

      const result = await loadTimeline('owner', 'repo', 123);

      expect(result).toHaveLength(2);
      expect(result[0]?.beforeSha).toBe('sha1');
      expect(result[0]?.afterSha).toBe('sha2');
      expect(result[1]?.beforeSha).toBe('sha3');
      expect(result[1]?.afterSha).toBe('sha4');
    });
  });

  describe('authentication', () => {
    it('includes Authorization header when token is available', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: 'ghp_test123' } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      await loadTimeline('owner', 'repo', 123);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer ghp_test123',
          }) as Record<string, string>,
        })
      );
    });

    it('proceeds without Authorization header when no token available', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: null } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      await loadTimeline('owner', 'repo', 123);

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as
        | [string, RequestInit]
        | undefined;
      const callHeaders = callArgs?.[1]?.headers as Record<string, string> | undefined;
      expect(callHeaders).not.toHaveProperty('Authorization');
    });

    it('uses provided token parameter over store token', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ token: 'store_token' } as never);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      await loadTimeline('owner', 'repo', 123, 'override_token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer override_token',
          }) as Record<string, string>,
        })
      );
    });
  });

  describe('pagination', () => {
    it('follows Link header pagination', async () => {
      const page1Headers = new Headers();
      page1Headers.set(
        'Link',
        '<https://api.github.com/repos/owner/repo/issues/123/timeline?per_page=100&page=2>; rel="next"'
      );

      const page2Headers = new Headers();
      // No next link on page 2

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            headers: page1Headers,
            json: () =>
              Promise.resolve([
                createTimelineEvent('head_ref_force_pushed', {
                  before: 'sha1',
                  after: 'sha2',
                  createdAt: '2024-01-15T10:00:00Z',
                  actor: 'user1',
                }),
              ]),
          });
        }
        return Promise.resolve({
          ok: true,
          headers: page2Headers,
          json: () =>
            Promise.resolve([
              createTimelineEvent('head_ref_force_pushed', {
                before: 'sha3',
                after: 'sha4',
                createdAt: '2024-01-15T11:00:00Z',
                actor: 'user2',
              }),
            ]),
        });
      });

      const result = await loadTimeline('owner', 'repo', 123);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0]?.beforeSha).toBe('sha1');
      expect(result[1]?.beforeSha).toBe('sha3');
    });

    it('handles multiple pages correctly', async () => {
      const createPageHeaders = (hasNext: boolean, page: number) => {
        const headers = new Headers();
        if (hasNext) {
          headers.set(
            'Link',
            `<https://api.github.com/repos/owner/repo/issues/123/timeline?per_page=100&page=${page + 1}>; rel="next"`
          );
        }
        return headers;
      };

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          headers: createPageHeaders(callCount < 3, callCount),
          json: () =>
            Promise.resolve([
              createTimelineEvent('head_ref_force_pushed', {
                before: `sha${callCount * 2 - 1}`,
                after: `sha${callCount * 2}`,
                createdAt: `2024-01-15T${10 + callCount}:00:00Z`,
                actor: `user${callCount}`,
              }),
            ]),
        });
      });

      const result = await loadTimeline('owner', 'repo', 123);

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
    });

    it('correctly parses Link header with multiple relations', async () => {
      const headers = new Headers();
      headers.set(
        'Link',
        '<https://api.github.com/repos/owner/repo/issues/123/timeline?per_page=100&page=2>; rel="next", <https://api.github.com/repos/owner/repo/issues/123/timeline?per_page=100&page=5>; rel="last"'
      );

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          headers: callCount === 1 ? headers : new Headers(),
          json: () => Promise.resolve([]),
        });
      });

      await loadTimeline('owner', 'repo', 123);

      // Should follow the next link
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/owner/repo/issues/123/timeline?per_page=100&page=2',
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('throws error on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ message: 'Not Found' }),
      });

      await expect(loadTimeline('owner', 'repo', 123)).rejects.toThrow();
    });

    it('handles malformed timeline events gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve([
            // Missing before/after
            createTimelineEvent('head_ref_force_pushed', {
              createdAt: '2024-01-15T10:00:00Z',
              actor: 'user',
            }),
            // Valid event
            createTimelineEvent('head_ref_force_pushed', {
              before: 'sha1',
              after: 'sha2',
              createdAt: '2024-01-15T11:00:00Z',
              actor: 'user',
            }),
          ]),
      });

      const result = await loadTimeline('owner', 'repo', 123);

      // Should only include the valid event
      expect(result).toHaveLength(1);
      expect(result[0]?.beforeSha).toBe('sha1');
    });

    it('handles missing created_at gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve([
            createTimelineEvent('head_ref_force_pushed', {
              before: 'sha1',
              after: 'sha2',
              // No createdAt
              actor: 'user',
            }),
          ]),
      });

      const result = await loadTimeline('owner', 'repo', 123);

      // Should still include the event with a fallback timestamp
      expect(result).toHaveLength(1);
      expect(result[0]?.beforeSha).toBe('sha1');
      expect(result[0]?.timestamp).toBeInstanceOf(Date);
    });

    it('handles missing actor gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve([
            createTimelineEvent('head_ref_force_pushed', {
              before: 'sha1',
              after: 'sha2',
              createdAt: '2024-01-15T10:00:00Z',
              // No actor
            }),
          ]),
      });

      const result = await loadTimeline('owner', 'repo', 123);

      expect(result).toHaveLength(1);
      expect(result[0]?.actor).toBe('unknown');
    });
  });

  describe('OTel tracing', () => {
    it('starts a span with correct attributes', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      await loadTimeline('owner', 'repo', 123);

      // Verify the mocked tracer was called with expected attributes
      const mockedTracer = vi.mocked(tracer);
      const calls = mockedTracer.startSpan.mock.calls;
      expect(calls).toHaveLength(1);
      const [name, attributes] = calls[0] ?? [];
      expect(name).toBe('timeline.load');
      expect(attributes).toMatchObject({
        'github.owner': 'owner',
        'github.repo': 'repo',
        'github.pr.number': 123,
      });
    });

    it('ends span with ok status on success', async () => {
      const mockSpan = createMockSpan();
      const mockedTracer = vi.mocked(tracer);
      mockedTracer.startSpan.mockReturnValue(mockSpan);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      await loadTimeline('owner', 'repo', 123);

      expect(mockSpan.setStatus).toHaveBeenCalledWith('ok');
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('ends span with error status on failure', async () => {
      const mockSpan = createMockSpan();
      const mockedTracer = vi.mocked(tracer);
      mockedTracer.startSpan.mockReturnValue(mockSpan);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ message: 'Server error' }),
      });

      await expect(loadTimeline('owner', 'repo', 123)).rejects.toThrow();

      expect(mockSpan.setStatus).toHaveBeenCalledWith('error', expect.any(String));
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('records page fetch events', async () => {
      const mockSpan = createMockSpan();
      const mockedTracer = vi.mocked(tracer);
      mockedTracer.startSpan.mockReturnValue(mockSpan);

      const headers = new Headers();
      headers.set(
        'Link',
        '<https://api.github.com/repos/owner/repo/issues/123/timeline?per_page=100&page=2>; rel="next"'
      );

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          headers: callCount === 1 ? headers : new Headers(),
          json: () => Promise.resolve([]),
        });
      });

      await loadTimeline('owner', 'repo', 123);

      // Should record events for each page fetch
      expect(mockSpan.addEvent).toHaveBeenCalledWith('page.fetched', expect.any(Object));
    });
  });

  describe('edge cases', () => {
    it('handles empty timeline response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      const result = await loadTimeline('owner', 'repo', 123);

      expect(result).toEqual([]);
    });

    it('filters out non-force-push events', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve([
            createTimelineEvent('committed'),
            createTimelineEvent('referenced'),
            createTimelineEvent('merged'),
            createTimelineEvent('closed'),
            createTimelineEvent('reopened'),
            createTimelineEvent('head_ref_deleted'),
            createTimelineEvent('base_ref_changed'),
          ]),
      });

      const result = await loadTimeline('owner', 'repo', 123);

      expect(result).toEqual([]);
    });
  });
});
