/**
 * Tests for PR Comment and Description Manager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updatePRDescription, updatePRComment, getArtifactIdFromComment } from './comment-manager';

describe('findExistingComment pagination', () => {
  let mockOctokit: any;
  const owner = 'testowner';
  const repo = 'testrepo';
  const prNumber = 123;

  beforeEach(() => {
    // Simulate 150 comments across 2 pages, with codjiflo marker on page 2
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      body: `unrelated comment ${i + 1}`,
    }));
    const page2 = [
      ...Array.from({ length: 20 }, (_, i) => ({
        id: 101 + i,
        body: `unrelated comment ${101 + i}`,
      })),
      {
        id: 999,
        body: '<!-- codjiflo-data -->\n**Artifact**: `42`\n',
      },
      ...Array.from({ length: 29 }, (_, i) => ({
        id: 1000 + i,
        body: `unrelated comment ${1000 + i}`,
      })),
    ];

    mockOctokit = {
      rest: {
        issues: {
          listComments: Object.assign(
            vi.fn(async ({ page }: { page?: number }) => {
              if (page === 1 || page === undefined) return { data: page1 };
              if (page === 2) return { data: page2 };
              return { data: [] };
            }),
            { endpoint: { merge: vi.fn() } }
          ),
          createComment: vi.fn().mockResolvedValue({}),
          updateComment: vi.fn().mockResolvedValue({}),
        },
      },
      paginate: vi.fn(async (fn: any, params: any) => {
        const results: any[] = [];
        let page = 1;
        while (true) {
          const { data } = await fn({ ...params, page });
          if (!data || data.length === 0) break;
          results.push(...data);
          if (data.length < (params.per_page ?? 30)) break;
          page += 1;
        }
        return results;
      }),
    };
  });

  it('should find marker comment on page 2 via getArtifactIdFromComment', async () => {
    const artifactId = await getArtifactIdFromComment(mockOctokit, owner, repo, prNumber);
    expect(artifactId).toBe(42);
  });

  it('should update (not create) when marker comment exists on page 2', async () => {
    await updatePRComment(mockOctokit, owner, repo, prNumber, {
      iterationCount: 1,
      runId: 1,
      timestamp: '2026-01-01',
      artifactId: 42,
    });
    expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 999 })
    );
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
  });
});

describe('updatePRDescription', () => {
  let mockOctokit: any;
  const owner = 'testowner';
  const repo = 'testrepo';
  const prNumber = 123;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn(),
          update: vi.fn(),
        },
      },
    };
  });

  it('should append CodjiFlo link to empty PR description', async () => {
    // Arrange
    mockOctokit.rest.pulls.get.mockResolvedValue({
      data: {
        body: '',
      },
    });
    mockOctokit.rest.pulls.update.mockResolvedValue({});

    // Act
    await updatePRDescription(mockOctokit, owner, repo, prNumber);

    // Assert
    expect(mockOctokit.rest.pulls.get).toHaveBeenCalledWith({
      owner,
      repo,
      pull_number: prNumber,
    });
    expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
      owner,
      repo,
      pull_number: prNumber,
      body: expect.stringContaining('https://codjiflo.net/testowner/testrepo/123'),
    });
    expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
      owner,
      repo,
      pull_number: prNumber,
      body: expect.stringContaining('<!-- codjiflo-link -->'),
    });
  });

  it('should append CodjiFlo link to existing PR description', async () => {
    // Arrange
    const existingBody = 'This is my PR description\n\nWith multiple lines';
    mockOctokit.rest.pulls.get.mockResolvedValue({
      data: {
        body: existingBody,
      },
    });
    mockOctokit.rest.pulls.update.mockResolvedValue({});

    // Act
    await updatePRDescription(mockOctokit, owner, repo, prNumber);

    // Assert
    expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
      owner,
      repo,
      pull_number: prNumber,
      body: expect.stringContaining(existingBody),
    });
    expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
      owner,
      repo,
      pull_number: prNumber,
      body: expect.stringContaining('https://codjiflo.net/testowner/testrepo/123'),
    });
  });

  it('should update existing CodjiFlo link in PR description', async () => {
    // Arrange - Use a different link format to trigger an update
    const existingBodyWithOldLink = `My PR description

<!-- codjiflo-link -->

Old link content here

<!-- codjiflo-link -->`;
    
    mockOctokit.rest.pulls.get.mockResolvedValue({
      data: {
        body: existingBodyWithOldLink,
      },
    });
    mockOctokit.rest.pulls.update.mockResolvedValue({});

    // Act
    await updatePRDescription(mockOctokit, owner, repo, prNumber);

    // Assert - should update with the new link format
    expect(mockOctokit.rest.pulls.update).toHaveBeenCalledTimes(1);
    const updateCall = mockOctokit.rest.pulls.update.mock.calls[0];
    expect(updateCall[0].body).toContain('https://codjiflo.net/testowner/testrepo/123');
    expect(updateCall[0].body).toContain('<!-- codjiflo-link -->');
    expect(updateCall[0].body).toContain('My PR description');
  });

  it('should not update if description already contains correct link', async () => {
    // Arrange
    const correctBody = `My PR description

<!-- codjiflo-link -->

---

🔍 **[Review in CodjiFlo](https://codjiflo.net/testowner/testrepo/123)**

<!-- codjiflo-link -->`;
    
    mockOctokit.rest.pulls.get.mockResolvedValue({
      data: {
        body: correctBody,
      },
    });

    // Act
    await updatePRDescription(mockOctokit, owner, repo, prNumber);

    // Assert - should NOT call update if body hasn't changed
    expect(mockOctokit.rest.pulls.update).not.toHaveBeenCalled();
  });

  it('should handle null PR body', async () => {
    // Arrange
    mockOctokit.rest.pulls.get.mockResolvedValue({
      data: {
        body: null,
      },
    });
    mockOctokit.rest.pulls.update.mockResolvedValue({});

    // Act
    await updatePRDescription(mockOctokit, owner, repo, prNumber);

    // Assert
    expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
      owner,
      repo,
      pull_number: prNumber,
      body: expect.stringContaining('https://codjiflo.net/testowner/testrepo/123'),
    });
  });
});
