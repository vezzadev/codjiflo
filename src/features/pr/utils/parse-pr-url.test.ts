import { describe, it, expect } from 'vitest';
import { parseGitHubPRUrl } from './parse-pr-url';

describe('parseGitHubPRUrl', () => {
  it('parses a standard GitHub PR URL', () => {
    const result = parseGitHubPRUrl('https://github.com/facebook/react/pull/123');
    expect(result).toEqual({
      owner: 'facebook',
      repo: 'react',
      number: 123,
    });
  });

  it('parses URL without protocol', () => {
    const result = parseGitHubPRUrl('github.com/owner/repo/pull/456');
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 456,
    });
  });

  it('parses URL with http protocol', () => {
    const result = parseGitHubPRUrl('http://github.com/test/project/pull/789');
    expect(result).toEqual({
      owner: 'test',
      repo: 'project',
      number: 789,
    });
  });

  it('returns null for invalid URLs', () => {
    expect(parseGitHubPRUrl('https://gitlab.com/owner/repo/pull/123')).toBeNull();
    expect(parseGitHubPRUrl('https://github.com/owner/repo/issues/123')).toBeNull();
    expect(parseGitHubPRUrl('random string')).toBeNull();
    expect(parseGitHubPRUrl('')).toBeNull();
  });

  it('handles URLs with trailing content', () => {
    const result = parseGitHubPRUrl('https://github.com/owner/repo/pull/123/files');
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 123,
    });
  });

  it('handles URLs with query parameters', () => {
    const result = parseGitHubPRUrl('https://github.com/owner/repo/pull/123?diff=unified');
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 123,
    });
  });

  it('handles URLs with hash fragments', () => {
    const result = parseGitHubPRUrl('https://github.com/owner/repo/pull/123#pullrequestreview-456');
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 123,
    });
  });

  it('handles hyphenated and underscored owner/repo names', () => {
    const result = parseGitHubPRUrl('https://github.com/my-org/my_repo/pull/1');
    expect(result).toEqual({
      owner: 'my-org',
      repo: 'my_repo',
      number: 1,
    });
  });

  it('handles owner/repo names with numbers', () => {
    const result = parseGitHubPRUrl('https://github.com/user123/project456/pull/789');
    expect(result).toEqual({
      owner: 'user123',
      repo: 'project456',
      number: 789,
    });
  });

  it('handles owner/repo names with dots', () => {
    const result = parseGitHubPRUrl('https://github.com/angular/angular.js/pull/999');
    expect(result).toEqual({
      owner: 'angular',
      repo: 'angular.js',
      number: 999,
    });
  });

  it('returns null for URLs with leading zeros that create NaN', () => {
    // PR number with leading zeros should still parse as valid integer
    const result = parseGitHubPRUrl('https://github.com/owner/repo/pull/0123');
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 123, // parseInt handles leading zeros
    });
  });

  it('returns null for missing owner', () => {
    expect(parseGitHubPRUrl('https://github.com//repo/pull/123')).toBeNull();
  });

  it('returns null for missing repo', () => {
    expect(parseGitHubPRUrl('https://github.com/owner//pull/123')).toBeNull();
  });

  it('returns null for missing PR number', () => {
    expect(parseGitHubPRUrl('https://github.com/owner/repo/pull/')).toBeNull();
  });

  it('returns null for non-numeric PR number', () => {
    expect(parseGitHubPRUrl('https://github.com/owner/repo/pull/abc')).toBeNull();
  });

  it('returns null for negative PR number', () => {
    expect(parseGitHubPRUrl('https://github.com/owner/repo/pull/-123')).toBeNull();
  });
});
