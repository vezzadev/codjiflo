/**
 * Commit Loader
 *
 * Fetches PR commits from GitHub Commits API for stateless iteration management.
 * Each commit maps to one iteration in stateless mode.
 *
 * @see spec/functional/iterations-stateless.md
 */

import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { tracer, SemanticAttributes as Attr } from '@/lib/tracing';

// ============================================================================
// Types
// ============================================================================

/** GitHub API commit structure */
interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      date: string;
      name?: string;
    };
  };
  author: { login: string } | null;
  parents: { sha: string }[];
}

/** Transformed commit for iteration building */
export interface PRCommit {
  /** Git commit SHA */
  sha: string;
  /** First line of commit message */
  message: string;
  /** Author username (or 'unknown' if null) */
  author: string;
  /** Commit timestamp */
  createdAt: Date;
  /** First parent SHA (undefined for root commits) */
  parentSha?: string;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Parse Link header to extract next page URL.
 *
 * Link header format:
 * <url1>; rel="next", <url2>; rel="last", <url3>; rel="prev"
 */
function parseNextLinkUrl(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }

  // Split by comma and find the "next" relation
  const links = linkHeader.split(',');
  for (const link of links) {
    const parts = link.trim().split(';');
    const urlPart = parts[0];
    const relPart = parts[1];
    if (!urlPart || !relPart) {
      continue;
    }

    const relMatch = /rel="?next"?/.exec(relPart);
    if (relMatch) {
      const urlMatch = /<(.+)>/.exec(urlPart);
      if (urlMatch?.[1]) {
        return urlMatch[1];
      }
    }
  }

  return null;
}

/**
 * Extract first line of commit message.
 * Handles both LF and CRLF line endings.
 */
function extractMessageFirstLine(message: string): string {
  const lineEndIndex = message.search(/\r?\n/);
  if (lineEndIndex === -1) {
    return message;
  }
  return message.substring(0, lineEndIndex);
}

/**
 * Transform GitHub API commit to PRCommit format.
 */
function transformCommit(commit: GitHubCommit): PRCommit {
  const firstParent = commit.parents[0];
  const result: PRCommit = {
    sha: commit.sha,
    message: extractMessageFirstLine(commit.commit.message),
    author: commit.author?.login ?? 'unknown',
    createdAt: new Date(commit.commit.author.date),
  };

  if (firstParent) {
    result.parentSha = firstParent.sha;
  }

  return result;
}

/**
 * Load all commits for a PR from GitHub API.
 *
 * Handles pagination via Link header.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @returns Array of PRCommit objects
 */
export async function loadCommits(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRCommit[]> {
  const span = tracer.startSpan('loadCommits', {
    [Attr.GITHUB_OWNER]: owner,
    [Attr.GITHUB_REPO]: repo,
    [Attr.GITHUB_PR_NUMBER]: prNumber,
  });

  try {
    const commits: PRCommit[] = [];
    let url: string | null = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/commits?per_page=100`;
    let pageCount = 0;

    while (url) {
      pageCount++;
      span.addEvent('page.fetch', { page: pageCount });

      const { token, updateRateLimit } = useAuthStore.getState();

      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(url, { headers });

      // Update rate limit from response headers
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const reset = response.headers.get('X-RateLimit-Reset');
      const limit = response.headers.get('X-RateLimit-Limit');

      if (remaining !== null && reset !== null && limit !== null) {
        const remainingInt = parseInt(remaining, 10);
        const resetInt = parseInt(reset, 10);
        const limitInt = parseInt(limit, 10);

        if (!Number.isNaN(remainingInt) && !Number.isNaN(resetInt) && !Number.isNaN(limitInt)) {
          updateRateLimit({
            remaining: remainingInt,
            reset: new Date(resetInt * 1000),
            limit: limitInt,
          });
        }
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({})) as { message?: string };
        const errorMessage = errorBody.message ?? response.statusText;
        throw new Error(`GitHub API error: ${response.status} ${errorMessage}`);
      }

      const pageCommits = (await response.json()) as GitHubCommit[];
      commits.push(...pageCommits.map(transformCommit));

      // Check for next page
      url = parseNextLinkUrl(response.headers.get('Link'));
    }

    span.setAttribute(Attr.ITERATION_COUNT, commits.length);
    span.addEvent('commits.loaded', { count: commits.length });
    span.setStatus('ok');

    return commits;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    span.setStatus('error', message);
    throw error;
  } finally {
    span.end();
  }
}
