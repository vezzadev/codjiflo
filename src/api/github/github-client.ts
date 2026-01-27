import { useAuthStore } from '@/features/auth/stores/useAuthStore';

/**
 * Rate limit information from GitHub API response headers
 */
export interface RateLimitInfo {
  remaining: number;
  reset: Date;
  limit: number;
}

/**
 * GitHub API Error with status code and error metadata
 */
export class GitHubAPIError extends Error {
  /**
   * Indicates if the error is likely due to accessing a private repo without auth.
   * Set to true for 404/403 errors when no token was provided.
   */
  isPrivateRepo?: boolean;

  /**
   * Indicates if the error is due to rate limiting (403 with rate limit message).
   */
  isRateLimitError?: boolean;

  constructor(
    public status: number,
    public statusText: string,
    message: string,
  ) {
    super(message);
    this.name = 'GitHubAPIError';
  }
}

/**
 * Response type that includes rate limit info alongside data
 */
export interface GitHubResponse<T> {
  data: T;
  rateLimit?: RateLimitInfo | undefined;
}

/**
 * Parse rate limit headers from GitHub API response
 */
function parseRateLimitHeaders(response: Response): RateLimitInfo | undefined {
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');
  const limit = response.headers.get('X-RateLimit-Limit');

  if (remaining === null || reset === null || limit === null) {
    return undefined;
  }

  const remainingInt = parseInt(remaining, 10);
  const resetInt = parseInt(reset, 10);
  const limitInt = parseInt(limit, 10);

  if (Number.isNaN(remainingInt) || Number.isNaN(resetInt) || Number.isNaN(limitInt)) {
    return undefined;
  }

  return {
    remaining: remainingInt,
    reset: new Date(resetInt * 1000),
    limit: limitInt,
  };
}

/**
 * GitHub REST API client
 * Supports both authenticated and unauthenticated requests.
 * - When token present: Includes Authorization header, handles 401 with token refresh
 * - When no token: Proceeds without auth header (works for public repos, 60 req/hr limit)
 */
export class GitHubClient {
  private baseURL = 'https://api.github.com';

  async fetch<T>(endpoint: string): Promise<T> {
    const result = await this.request<T>(endpoint);
    return result.data;
  }

  /**
   * Make a request to the GitHub API with full response including rate limit info
   */
  async requestWithRateLimit<T>(
    endpoint: string,
    options?: { method?: string; body?: unknown }
  ): Promise<GitHubResponse<T>> {
    return this.request<T>(endpoint, options);
  }

  async request<T>(
    endpoint: string,
    options?: { method?: string; body?: unknown },
    isRetry = false
  ): Promise<GitHubResponse<T>> {
    const { token, authMethod, refreshAccessToken } = useAuthStore.getState();
    const hadToken = !!token;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (options?.body) {
      headers['Content-Type'] = 'application/json';
    }

    const requestInit: RequestInit = {
      method: options?.method ?? 'GET',
      headers,
    };

    if (options?.body) {
      requestInit.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, requestInit);
    const rateLimit = parseRateLimitHeaders(response);

    if (!response.ok) {
      // Handle 401 by attempting token refresh (OAuth only, token must have been present, and only on first attempt)
      if (response.status === 401 && hadToken && authMethod === 'oauth' && !isRetry) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Token refreshed successfully, retry the request
          return this.request<T>(endpoint, options, true);
        }
        // Refresh failed - refreshAccessToken already called logout()
        throw new GitHubAPIError(401, 'Unauthorized', 'Session expired. Please log in again.');
      }

      let errorMessage = response.statusText;
      try {
        const errorData = await response.json() as { message?: string };
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Use statusText if response body can't be parsed
      }

      const error = new GitHubAPIError(
        response.status,
        response.statusText,
        errorMessage
      );

      // Flag potential private repo access for 404/403 without token
      if ((response.status === 404 || response.status === 403) && !hadToken) {
        error.isPrivateRepo = true;
      }

      // Flag rate limit errors (403 with rate limit message)
      if (response.status === 403 && errorMessage.toLowerCase().includes('rate limit')) {
        error.isRateLimitError = true;
        error.isPrivateRepo = false; // Rate limit is not a private repo issue
      }

      throw error;
    }

    if (response.status === 204) {
      return { data: undefined as T, rateLimit };
    }

    const data = await response.json() as T;
    return { data, rateLimit };
  }
}

export const githubClient = new GitHubClient();
