import type { ParsedPRUrl } from '../types';

/**
 * Parses a GitHub Pull Request URL and extracts owner, repo, and PR number
 * @param url - GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)
 * @returns Parsed URL components or null if invalid
 */
export function parseGitHubPRUrl(url: string): ParsedPRUrl | null {
  // Match: https://github.com/owner/repo/pull/123
  // Also handles: github.com/owner/repo/pull/123 (without protocol)
  const regex = /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
  const match = regex.exec(url);

  if (!match?.[1] || !match[2] || !match[3]) return null;

  const owner = match[1];
  const repo = match[2];
  const number = parseInt(match[3], 10);

  if (isNaN(number)) return null;

  return { owner, repo, number };
}
