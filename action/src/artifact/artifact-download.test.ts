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
  type ArtifactInfo,
} from './artifact-download';

// Mock octokit
const mockOctokit = {
  rest: {
    actions: {
      listArtifactsForRepo: vi.fn(),
      downloadArtifact: vi.fn(),
    },
  },
};

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
