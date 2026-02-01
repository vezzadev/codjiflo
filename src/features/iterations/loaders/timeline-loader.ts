/**
 * Timeline Loader (Task 1.3)
 *
 * Loads force-push events from GitHub Timeline API for stateless iteration management.
 * Handles pagination and extracts head_ref_force_pushed events.
 *
 * @see spec/functional/iterations.md
 */

import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { tracer, SemanticAttributes } from '@/lib/tracing';
import type { ForcePushEvent } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Raw timeline event from GitHub API
 */
interface TimelineEvent {
  event: string;
  before?: { sha: string };
  after?: { sha: string };
  created_at?: string;
  actor?: { login: string };
}

// ============================================================================
// Link Header Parsing
// ============================================================================

/**
 * Parse Link header to extract next page URL
 * Format: <url>; rel="next", <url>; rel="last"
 */
function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }

  const links = linkHeader.split(',');
  for (const link of links) {
    const parts = link.trim().split(';');
    if (parts.length < 2) continue;

    const urlPart = parts[0]?.trim();
    const relPart = parts[1]?.trim();

    if (!urlPart || !relPart) continue;

    // Check if this is the "next" relation
    if (relPart === 'rel="next"') {
      // Extract URL from angle brackets: <url>
      const urlMatch = /^<(.+)>$/.exec(urlPart);
      if (urlMatch?.[1]) {
        return urlMatch[1];
      }
    }
  }

  return null;
}

// ============================================================================
// Timeline Loader
// ============================================================================

/**
 * Load force-push events from GitHub Timeline API
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param token - Optional auth token (uses auth store if not provided)
 * @returns Array of force-push events
 */
export async function loadTimeline(
  owner: string,
  repo: string,
  prNumber: number,
  token?: string
): Promise<ForcePushEvent[]> {
  const span = tracer.startSpan('timeline.load', {
    [SemanticAttributes.GITHUB_OWNER]: owner,
    [SemanticAttributes.GITHUB_REPO]: repo,
    [SemanticAttributes.GITHUB_PR_NUMBER]: prNumber,
  });

  try {
    const events = await fetchAllPages(owner, repo, prNumber, token, span);
    span.setAttribute('force_push_count', events.length);
    span.setStatus('ok');
    return events;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    span.setStatus('error', message);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Fetch all pages of timeline events
 */
async function fetchAllPages(
  owner: string,
  repo: string,
  prNumber: number,
  token: string | undefined,
  span: ReturnType<typeof tracer.startSpan>
): Promise<ForcePushEvent[]> {
  const forcePushEvents: ForcePushEvent[] = [];
  let url: string | null =
    `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/timeline?per_page=100`;
  let pageNumber = 0;

  // Get token from store if not provided
  const authToken = token ?? useAuthStore.getState().token;

  while (url) {
    pageNumber++;
    const { events, nextUrl } = await fetchPage(url, authToken, span, pageNumber);

    // Extract force-push events
    for (const event of events) {
      const forcePush = extractForcePushEvent(event);
      if (forcePush) {
        forcePushEvents.push(forcePush);
      }
    }

    url = nextUrl;
  }

  return forcePushEvents;
}

/**
 * Fetch a single page of timeline events
 */
async function fetchPage(
  url: string,
  token: string | null,
  span: ReturnType<typeof tracer.startSpan>,
  pageNumber: number
): Promise<{ events: TimelineEvent[]; nextUrl: string | null }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  span.addEvent('page.fetched', {
    page: pageNumber,
    status: response.status,
    url,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = (await response.json()) as { message?: string };
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Use statusText if response body can't be parsed
    }
    throw new Error(`Timeline API error: ${response.status} ${errorMessage}`);
  }

  const events = (await response.json()) as TimelineEvent[];
  const linkHeader = response.headers.get('Link');
  const nextUrl = parseNextLink(linkHeader);

  return { events, nextUrl };
}

/**
 * Extract ForcePushEvent from raw timeline event
 * Returns null if event is not a force-push or is malformed
 */
function extractForcePushEvent(event: TimelineEvent): ForcePushEvent | null {
  if (event.event !== 'head_ref_force_pushed') {
    return null;
  }

  // Require before and after SHAs
  const beforeSha = event.before?.sha;
  const afterSha = event.after?.sha;

  if (!beforeSha || !afterSha) {
    return null;
  }

  return {
    beforeSha,
    afterSha,
    timestamp: event.created_at ? new Date(event.created_at) : new Date(),
    actor: event.actor?.login ?? 'unknown',
  };
}
