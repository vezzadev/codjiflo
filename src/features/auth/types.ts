/**
 * Rate limit information from GitHub API response headers.
 */
export interface RateLimitInfo {
  remaining: number;
  reset: Date;
  limit: number;
}
