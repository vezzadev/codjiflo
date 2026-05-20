/**
 * Rate limit information from GitHub API response headers.
 */
export interface RateLimitInfo {
  remaining: number;
  reset: Date;
  limit: number;
}

/**
 * Response from GitHub's OAuth token endpoint.
 * Used for both initial token exchange and token refresh.
 */
export interface GitHubTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}
