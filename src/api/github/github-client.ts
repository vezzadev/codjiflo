import { useAuthStore } from '@/features/auth/stores/useAuthStore';

/**
 * GitHub API Error with status code
 */
export class GitHubAPIError extends Error {
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
 * GitHub REST API client
 * Injects auth token from useAuthStore
 * Handles 401 errors by attempting token refresh before failing
 */
export class GitHubClient {
  private baseURL = 'https://api.github.com';

  async fetch<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  async request<T>(
    endpoint: string,
    options?: { method?: string; body?: unknown },
    isRetry = false
  ): Promise<T> {
    const { token, authMethod, refreshAccessToken } = useAuthStore.getState();
    if (!token) {
      throw new GitHubAPIError(401, 'Unauthorized', 'Not authenticated');
    }

    const requestInit: RequestInit = {
      method: options?.method ?? 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      },
    };

    if (options?.body) {
      requestInit.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, requestInit);

    if (!response.ok) {
      // Handle 401 by attempting token refresh (OAuth only, and only on first attempt)
      if (response.status === 401 && authMethod === 'oauth' && !isRetry) {
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
      throw new GitHubAPIError(
        response.status,
        response.statusText,
        errorMessage
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}

export const githubClient = new GitHubClient();
