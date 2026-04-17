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
});
