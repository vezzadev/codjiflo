/**
 * Tests for ArtifactLoader.
 *
 * Focused on issue #494 regression coverage: the direct artifact ZIP fetch
 * must bypass the browser HTTP cache so that a freshly uploaded artifact is
 * downloaded after a soft refresh. The PR-comments fetch flows through
 * githubClient (covered in github-client.test.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ArtifactLoader } from './artifact-loader';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

describe('ArtifactLoader.downloadArtifact', () => {
  let loader: ArtifactLoader;

  beforeEach(() => {
    loader = new ArtifactLoader('owner', 'repo', 1);
    vi.clearAllMocks();
    vi.mocked(useAuthStore.getState).mockReturnValue({ token: 'ghp_test123' } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses cache: "no-cache" so a new artifact ID is fetched fresh on soft refresh (issue #494)', async () => {
    // 410 path triggers an expected console.warn — suppress it so the global
    // test-setup's warn-is-failure guard doesn't flag this test.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 410, // gracefully handled "artifact expired" — avoids JSZip parsing
      statusText: 'Gone',
    });
    global.fetch = fetchMock;

    // Use the public load() entry point with a prefetched reference to
    // exercise downloadArtifact() without mocking findArtifactReference().
    // 410 → returns null, no zip parsing required.
    await loader.load({
      iterationCount: 3,
      timestamp: '2026-05-19T10:00:00Z',
      artifactId: 987654321,
      runId: 12345678,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/actions/artifacts/987654321/zip'),
      expect.objectContaining({ cache: 'no-cache' })
    );
  });
});
