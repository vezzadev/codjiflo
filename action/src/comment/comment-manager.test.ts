/**
 * Tests for PR Comment and Description Manager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updatePRDescription } from './comment-manager';

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
