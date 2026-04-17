/**
 * Tests for Artifact Download from Previous Runs
 *
 * These tests verify that the action correctly downloads artifacts
 * from previous workflow runs to enable iteration accumulation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findLatestArtifact,
  downloadArtifact,
  downloadPreviousArtifact,
  findNewestCodjifloArtifactForPR,
  downloadArtifactById,
  downloadArtifactWithFallback,
  type ArtifactInfo,
} from './artifact-download';

// Mock octokit
const mockPaginateIterator = vi.fn();
const mockOctokit = {
  rest: {
    actions: {
      listArtifactsForRepo: vi.fn(),
      downloadArtifact: vi.fn(),
      getArtifact: vi.fn(),
    },
  },
  paginate: {
    iterator: mockPaginateIterator,
  },
};

/**
 * Helper to build an async iterator that yields the given pages.
 */
function buildAsyncIterator<T>(pages: T[][]): AsyncIterable<{ data: T[] }> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const page of pages) {
        yield { data: page };
      }
    },
  };
}

describe('findLatestArtifact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find the latest artifact matching the name', async () => {
    mockOctokit.rest.actions.listArtifactsForRepo.mockResolvedValue({
      data: {
        total_count: 3,
        artifacts: [
          { id: 100, name: 'codjiflo-pr-28', created_at: '2025-01-03T10:00:00Z', expired: false, workflow_run: { id: 1000 } },
          { id: 99, name: 'codjiflo-pr-28', created_at: '2025-01-02T10:00:00Z', expired: false, workflow_run: { id: 999 } },
          { id: 98, name: 'codjiflo-pr-27', created_at: '2025-01-01T10:00:00Z', expired: false, workflow_run: { id: 998 } },
        ],
      },
    });

    const result = await findLatestArtifact(
      mockOctokit as never,
      'owner',
      'repo',
      'codjiflo-pr-28'
    );

    expect(result).toEqual({
      id: 100,
      name: 'codjiflo-pr-28',
      created_at: '2025-01-03T10:00:00Z',
      workflow_run_id: 1000,
    });
  });

  it('should return null when no matching artifact exists', async () => {
    mockOctokit.rest.actions.listArtifactsForRepo.mockResolvedValue({
      data: {
        total_count: 1,
        artifacts: [
          { id: 98, name: 'codjiflo-pr-27', created_at: '2025-01-01T10:00:00Z', expired: false, workflow_run: { id: 998 } },
        ],
      },
    });

    const result = await findLatestArtifact(
      mockOctokit as never,
      'owner',
      'repo',
      'codjiflo-pr-28'
    );

    expect(result).toBeNull();
  });

  it('should skip expired artifacts', async () => {
    mockOctokit.rest.actions.listArtifactsForRepo.mockResolvedValue({
      data: {
        total_count: 2,
        artifacts: [
          { id: 100, name: 'codjiflo-pr-28', created_at: '2025-01-03T10:00:00Z', expired: true, workflow_run: { id: 1000 } },
          { id: 99, name: 'codjiflo-pr-28', created_at: '2025-01-02T10:00:00Z', expired: false, workflow_run: { id: 999 } },
        ],
      },
    });

    const result = await findLatestArtifact(
      mockOctokit as never,
      'owner',
      'repo',
      'codjiflo-pr-28'
    );

    expect(result).toEqual({
      id: 99,
      name: 'codjiflo-pr-28',
      created_at: '2025-01-02T10:00:00Z',
      workflow_run_id: 999,
    });
  });

  it('should exclude artifacts from the current run', async () => {
    mockOctokit.rest.actions.listArtifactsForRepo.mockResolvedValue({
      data: {
        total_count: 2,
        artifacts: [
          { id: 100, name: 'codjiflo-pr-28', created_at: '2025-01-03T10:00:00Z', expired: false, workflow_run: { id: 1000 } },
          { id: 99, name: 'codjiflo-pr-28', created_at: '2025-01-02T10:00:00Z', expired: false, workflow_run: { id: 999 } },
        ],
      },
    });

    const result = await findLatestArtifact(
      mockOctokit as never,
      'owner',
      'repo',
      'codjiflo-pr-28',
      1000 // current run ID
    );

    expect(result).toEqual({
      id: 99,
      name: 'codjiflo-pr-28',
      created_at: '2025-01-02T10:00:00Z',
      workflow_run_id: 999,
    });
  });

  it('should handle empty artifact list', async () => {
    mockOctokit.rest.actions.listArtifactsForRepo.mockResolvedValue({
      data: {
        total_count: 0,
        artifacts: [],
      },
    });

    const result = await findLatestArtifact(
      mockOctokit as never,
      'owner',
      'repo',
      'codjiflo-pr-28'
    );

    expect(result).toBeNull();
  });
});

describe('downloadArtifact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should download and return artifact data', async () => {
    const mockZipData = new ArrayBuffer(100);
    mockOctokit.rest.actions.downloadArtifact.mockResolvedValue({
      data: mockZipData,
    });

    const artifactInfo: ArtifactInfo = {
      id: 100,
      name: 'codjiflo-pr-28',
      created_at: '2025-01-03T10:00:00Z',
      workflow_run_id: 1000,
    };

    const result = await downloadArtifact(
      mockOctokit as never,
      'owner',
      'repo',
      artifactInfo
    );

    expect(result).toBe(mockZipData);
    expect(mockOctokit.rest.actions.downloadArtifact).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      artifact_id: 100,
      archive_format: 'zip',
    });
  });
});

describe('downloadPreviousArtifact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return artifact data when previous artifact exists', async () => {
    const mockZipData = new ArrayBuffer(100);
    mockOctokit.rest.actions.listArtifactsForRepo.mockResolvedValue({
      data: {
        total_count: 1,
        artifacts: [
          { id: 99, name: 'codjiflo-pr-28', created_at: '2025-01-02T10:00:00Z', expired: false, workflow_run: { id: 999 } },
        ],
      },
    });
    mockOctokit.rest.actions.downloadArtifact.mockResolvedValue({
      data: mockZipData,
    });

    const result = await downloadPreviousArtifact(
      mockOctokit as never,
      'owner',
      'repo',
      'codjiflo-pr-28',
      1000
    );

    expect(result).toEqual({
      data: mockZipData,
      artifactInfo: {
        id: 99,
        name: 'codjiflo-pr-28',
        created_at: '2025-01-02T10:00:00Z',
        workflow_run_id: 999,
      },
    });
  });

  it('should return null when no previous artifact exists', async () => {
    mockOctokit.rest.actions.listArtifactsForRepo.mockResolvedValue({
      data: {
        total_count: 0,
        artifacts: [],
      },
    });

    const result = await downloadPreviousArtifact(
      mockOctokit as never,
      'owner',
      'repo',
      'codjiflo-pr-28',
      1000
    );

    expect(result).toBeNull();
  });
});

describe('findNewestCodjifloArtifactForPR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find artifact matching PR-specific pattern', async () => {
    mockOctokit.rest.actions.listArtifactsForRepo.mockResolvedValue({
      data: {
        total_count: 3,
        artifacts: [
          { id: 100, name: 'codjiflo-pr-28-1000', created_at: '2025-01-03T10:00:00Z', expired: false, workflow_run: { id: 1000 } },
          { id: 99, name: 'codjiflo-pr-28-999', created_at: '2025-01-02T10:00:00Z', expired: false, workflow_run: { id: 999 } },
          { id: 98, name: 'codjiflo-pr-27-998', created_at: '2025-01-01T10:00:00Z', expired: false, workflow_run: { id: 998 } },
        ],
      },
    });

    const result = await findNewestCodjifloArtifactForPR(
      mockOctokit as never,
      'owner',
      'repo',
      28
    );

    expect(result).toEqual({
      id: 100,
      name: 'codjiflo-pr-28-1000',
      created_at: '2025-01-03T10:00:00Z',
      workflow_run_id: 1000,
    });
  });

  it('should skip expired artifacts', async () => {
    mockOctokit.rest.actions.listArtifactsForRepo.mockResolvedValue({
      data: {
        total_count: 2,
        artifacts: [
          { id: 100, name: 'codjiflo-pr-28-1000', created_at: '2025-01-03T10:00:00Z', expired: true, workflow_run: { id: 1000 } },
          { id: 99, name: 'codjiflo-pr-28-999', created_at: '2025-01-02T10:00:00Z', expired: false, workflow_run: { id: 999 } },
        ],
      },
    });

    const result = await findNewestCodjifloArtifactForPR(
      mockOctokit as never,
      'owner',
      'repo',
      28
    );

    expect(result?.id).toBe(99);
  });

  it('should find target artifact on page 2 when page 1 is dominated by unrelated artifacts', async () => {
    // Page 1: 100 non-matching artifacts (other CI jobs on a busy repo)
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      id: 10000 + i,
      name: `other-ci-artifact-${i}`,
      created_at: '2025-01-10T10:00:00Z',
      expired: false,
      workflow_run: { id: 2000 + i },
    }));
    // Page 2: contains the target codjiflo artifact for PR 28
    const page2 = [
      {
        id: 9000,
        name: 'codjiflo-pr-28-1500',
        created_at: '2025-01-05T10:00:00Z',
        expired: false,
        workflow_run: { id: 1500 },
      },
      {
        id: 8999,
        name: 'other-artifact',
        created_at: '2025-01-04T10:00:00Z',
        expired: false,
        workflow_run: { id: 1499 },
      },
    ];

    mockPaginateIterator.mockReturnValue(buildAsyncIterator([page1, page2]));

    const result = await findNewestCodjifloArtifactForPR(
      mockOctokit as never,
      'owner',
      'repo',
      28
    );

    expect(result).toEqual({
      id: 9000,
      name: 'codjiflo-pr-28-1500',
      created_at: '2025-01-05T10:00:00Z',
      workflow_run_id: 1500,
    });
  });

  it('should return null when no matching artifact exists for PR', async () => {
    mockOctokit.rest.actions.listArtifactsForRepo.mockResolvedValue({
      data: {
        total_count: 1,
        artifacts: [
          { id: 98, name: 'codjiflo-pr-27-998', created_at: '2025-01-01T10:00:00Z', expired: false, workflow_run: { id: 998 } },
        ],
      },
    });

    const result = await findNewestCodjifloArtifactForPR(
      mockOctokit as never,
      'owner',
      'repo',
      28
    );

    expect(result).toBeNull();
  });
});

describe('downloadArtifactById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should download artifact directly by ID', async () => {
    const mockZipData = new ArrayBuffer(100);
    mockOctokit.rest.actions.getArtifact.mockResolvedValue({
      data: { id: 100, name: 'codjiflo-1000', created_at: '2025-01-03T10:00:00Z', expired: false, workflow_run: { id: 1000 } },
    });
    mockOctokit.rest.actions.downloadArtifact.mockResolvedValue({
      data: mockZipData,
    });

    const result = await downloadArtifactById(
      mockOctokit as never,
      'owner',
      'repo',
      100
    );

    expect(result?.artifactInfo.id).toBe(100);
    expect(result?.data).toBe(mockZipData);
  });

  it('should return null for expired artifact', async () => {
    mockOctokit.rest.actions.getArtifact.mockResolvedValue({
      data: { id: 100, name: 'codjiflo-1000', created_at: '2025-01-03T10:00:00Z', expired: true, workflow_run: { id: 1000 } },
    });

    const result = await downloadArtifactById(
      mockOctokit as never,
      'owner',
      'repo',
      100
    );

    expect(result).toBeNull();
  });

  it('should return null when artifact not found', async () => {
    mockOctokit.rest.actions.getArtifact.mockRejectedValue(new Error('Not found'));

    const result = await downloadArtifactById(
      mockOctokit as never,
      'owner',
      'repo',
      999
    );

    expect(result).toBeNull();
  });
});

describe('downloadArtifactWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should download specific artifact by ID when found', async () => {
    const mockZipData = new ArrayBuffer(100);
    mockOctokit.rest.actions.getArtifact.mockResolvedValue({
      data: { id: 100, name: 'codjiflo-999', created_at: '2025-01-02T10:00:00Z', expired: false, workflow_run: { id: 999 } },
    });
    mockOctokit.rest.actions.downloadArtifact.mockResolvedValue({
      data: mockZipData,
    });

    const result = await downloadArtifactWithFallback(
      mockOctokit as never,
      'owner',
      'repo',
      28,
      100 // Artifact ID
    );

    expect(result?.artifactInfo.id).toBe(100);
    expect(result?.data).toBe(mockZipData);
  });

  it('should fall back to newest PR artifact when specific ID is not found', async () => {
    const mockZipData = new ArrayBuffer(100);
    // First call for specific artifact ID fails
    mockOctokit.rest.actions.getArtifact.mockRejectedValue(new Error('Not found'));
    // Fallback call lists all artifacts (PR-specific pattern)
    mockOctokit.rest.actions.listArtifactsForRepo.mockResolvedValue({
      data: {
        total_count: 1,
        artifacts: [
          { id: 99, name: 'codjiflo-pr-28-998', created_at: '2025-01-01T10:00:00Z', expired: false, workflow_run: { id: 998 } },
        ],
      },
    });
    mockOctokit.rest.actions.downloadArtifact.mockResolvedValue({
      data: mockZipData,
    });

    const result = await downloadArtifactWithFallback(
      mockOctokit as never,
      'owner',
      'repo',
      28,
      999 // This ID doesn't exist
    );

    expect(result?.artifactInfo.id).toBe(99);
  });

  it('should try fallback when no specific ID is provided', async () => {
    const mockZipData = new ArrayBuffer(100);
    mockOctokit.rest.actions.listArtifactsForRepo.mockResolvedValue({
      data: {
        total_count: 1,
        artifacts: [
          { id: 100, name: 'codjiflo-pr-28-1000', created_at: '2025-01-03T10:00:00Z', expired: false, workflow_run: { id: 1000 } },
        ],
      },
    });
    mockOctokit.rest.actions.downloadArtifact.mockResolvedValue({
      data: mockZipData,
    });

    const result = await downloadArtifactWithFallback(
      mockOctokit as never,
      'owner',
      'repo',
      28,
      null // No specific ID
    );

    expect(result?.artifactInfo.id).toBe(100);
  });

  it('should return null when no artifacts exist at all', async () => {
    mockOctokit.rest.actions.listArtifactsForRepo.mockResolvedValue({
      data: {
        total_count: 0,
        artifacts: [],
      },
    });

    const result = await downloadArtifactWithFallback(
      mockOctokit as never,
      'owner',
      'repo',
      28,
      null
    );

    expect(result).toBeNull();
  });
});
