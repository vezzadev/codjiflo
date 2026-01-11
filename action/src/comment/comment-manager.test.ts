/**
 * Tests for PR Comment and Description Manager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updatePRComment, updatePRDescription } from './comment-manager';

describe('updatePRComment', () => {
  let mockOctokit: any;
  const owner = 'testowner';
  const repo = 'testrepo';
  const prNumber = 123;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        issues: {
          listComments: vi.fn(),
          createComment: vi.fn(),
          updateComment: vi.fn(),
        },
      },
    };
  });

  it('should create comment with baseline commit metadata', async () => {
    // Arrange
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [],
    });
    mockOctokit.rest.issues.createComment.mockResolvedValue({});

    const commentData = {
      iterationCount: 1,
      artifactName: 'codjiflo-pr-123-run-456',
      runId: 456,
      timestamp: '2024-01-01T00:00:00.000Z',
      baseCommitSha: 'abc123def456789',
      baseCommitDate: '2023-12-31T12:00:00.000Z',
    };

    // Act
    await updatePRComment(mockOctokit, owner, repo, prNumber, commentData);

    // Assert
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(1);
    const call = mockOctokit.rest.issues.createComment.mock.calls[0][0];
    expect(call.body).toContain('Baseline commit');
    expect(call.body).toContain('abc123d'); // Short SHA
    expect(call.body).toContain('Baseline commit date');
    expect(call.body).toContain('Baseline commit age');
  });

  it('should handle missing baseline commit date', async () => {
    // Arrange
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [],
    });
    mockOctokit.rest.issues.createComment.mockResolvedValue({});

    const commentData = {
      iterationCount: 1,
      artifactName: 'codjiflo-pr-123-run-456',
      runId: 456,
      timestamp: '2024-01-01T00:00:00.000Z',
      baseCommitSha: 'abc123def456789',
      baseCommitDate: null,
    };

    // Act
    await updatePRComment(mockOctokit, owner, repo, prNumber, commentData);

    // Assert
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(1);
    const call = mockOctokit.rest.issues.createComment.mock.calls[0][0];
    expect(call.body).toContain('Baseline commit');
    expect(call.body).toContain('abc123d'); // Short SHA
    expect(call.body).not.toContain('Baseline commit date');
    expect(call.body).not.toContain('Baseline commit age');
  });

  it('should update existing comment with baseline commit metadata', async () => {
    // Arrange
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [
        {
          id: 789,
          body: '<!-- codjiflo-data -->\nOld comment',
        },
      ],
    });
    mockOctokit.rest.issues.updateComment.mockResolvedValue({});

    const commentData = {
      iterationCount: 2,
      artifactName: 'codjiflo-pr-123-run-456',
      runId: 456,
      timestamp: '2024-01-01T00:00:00.000Z',
      baseCommitSha: 'abc123def456789',
      baseCommitDate: '2023-12-31T12:00:00.000Z',
    };

    // Act
    await updatePRComment(mockOctokit, owner, repo, prNumber, commentData);

    // Assert
    expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledTimes(1);
    const call = mockOctokit.rest.issues.updateComment.mock.calls[0][0];
    expect(call.comment_id).toBe(789);
    expect(call.body).toContain('Baseline commit');
    expect(call.body).toContain('abc123d'); // Short SHA
    expect(call.body).toContain('Baseline commit date');
    expect(call.body).toContain('Baseline commit age');
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
      body: expect.stringContaining('https://codjiflo.vza.net/testowner/testrepo/123'),
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
      body: expect.stringContaining('https://codjiflo.vza.net/testowner/testrepo/123'),
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
    expect(updateCall[0].body).toContain('https://codjiflo.vza.net/testowner/testrepo/123');
    expect(updateCall[0].body).toContain('<!-- codjiflo-link -->');
    expect(updateCall[0].body).toContain('My PR description');
  });

  it('should not update if description already contains correct link', async () => {
    // Arrange
    const correctBody = `My PR description

<!-- codjiflo-link -->

---

🔍 **[Review in CodjiFlo](https://codjiflo.vza.net/testowner/testrepo/123)**

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
      body: expect.stringContaining('https://codjiflo.vza.net/testowner/testrepo/123'),
    });
  });
});
