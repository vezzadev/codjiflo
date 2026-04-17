# Unauthenticated Access Specification

---

## Overview

CodjiFlo supports an unauthenticated-first experience for public repositories. Users can view public pull requests, read comments, and browse diffs without logging in. Authentication is requested contextually when users attempt actions that require it.

This approach reduces friction for casual users while maintaining full functionality for authenticated users.

---

## GitHub API Behavior

### Public vs Private Repository Access

| API Endpoint | Public Repo (No Auth) | Public Repo (Auth) | Private Repo |
|--------------|----------------------|--------------------| -------------|
| `GET /repos/{owner}/{repo}/pulls/{number}` | Yes | Yes | Auth required |
| `GET /repos/{owner}/{repo}/pulls/{number}/files` | Yes | Yes | Auth required |
| `GET /repos/{owner}/{repo}/pulls/{number}/comments` | Yes | Yes | Auth required |
| `GET /repos/{owner}/{repo}/issues/{number}/comments` | Yes | Yes | Auth required |
| `GET /repos/{owner}/{repo}/contents/{path}` | Yes | Yes | Auth required |
| `GET /repos/{owner}/{repo}/actions/artifacts/{id}/zip` | **No** | Yes | Auth required |
| `POST /repos/{owner}/{repo}/pulls/{number}/comments` | No | Yes | Auth required |

**Key constraint**: GitHub Actions artifact download requires authentication even for public repositories. This means iteration tracking (which relies on artifacts) is unavailable without authentication.

### Rate Limits

| User Type | Requests per Hour | Per-IP Sharing |
|-----------|------------------|----------------|
| Unauthenticated | 60 | Yes (shared across all users on same IP) |
| Authenticated | 5,000 | No (per-user) |

**Rate limit headers** returned by GitHub API:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Authentication States

### State Definitions

```typescript
type AuthenticationState =
  | 'unauthenticated'  // No token present
  | 'authenticated';   // Valid token present

type DegradedReason =
  | 'unauthenticated'         // User not logged in
  | 'workflow_not_installed'  // Repo doesn't have CodjiFlo action
  | 'artifact_expired'        // Artifact older than 90 days
  | 'artifact_error';         // Failed to download/parse artifact
```

### Feature Availability Matrix

| Feature | Unauthenticated | Authenticated |
|---------|-----------------|---------------|
| View public PR metadata | Yes | Yes |
| View public PR file changes | Yes | Yes |
| View public PR diff | Yes | Yes |
| Read comments | Yes | Yes |
| Post comments | No | Yes |
| Reply to comments | No | Yes |
| Resolve comments | No | Yes |
| Edit own comments | No | Yes |
| Delete own comments | No | Yes |
| View private PRs | No | Yes |
| Iteration tracking | No | Yes |
| Cross-iteration diff | No | Yes |
| SpanTracker comment anchoring | No | Yes |

---

## User Flows

### 1. Landing Flow

```
Unauthenticated user visits /
    ↓
Redirect to /dashboard
    ↓
Dashboard shows PR URL input + Login button
    ↓
User enters public PR URL
    ↓
Navigate to /{owner}/{repo}/{number}
    ↓
Load PR data (unauthenticated)
    ↓
Show diff in degraded mode (no iterations)
```

### 2. Private PR Access Flow

```
Unauthenticated user navigates to /{owner}/{repo}/{number}
    ↓
GitHub API returns 404 (private repo)
    ↓
GitHubClient sets isPrivateRepo flag
    ↓
PR page shows PrivateRepoPrompt component
    ↓
User clicks "Log in to access"
    ↓
Navigate to /login?returnPath=/{owner}/{repo}/{number}
    ↓
OAuth flow completes
    ↓
Return to PR page (now authenticated)
    ↓
Load PR data successfully
```

### 3. Rate Limit Warning Flow

```
Unauthenticated user makes API requests
    ↓
GitHubClient parses X-RateLimit-Remaining header
    ↓
updateRateLimit() called on auth store
    ↓
useRateLimitWarning() detects remaining < 20% of limit
    ↓
RateLimitWarningBanner appears
    ↓
User clicks "Sign in" or continues
    ↓
If remaining = 0, banner becomes non-dismissible
```

### 4. Comment Interaction Flow

```
Unauthenticated user views comments
    ↓
All comments display in read-only mode
    ↓
Reply button shows "Log in to reply"
    ↓
Add comment button hidden OR shows login prompt on click
    ↓
User clicks login prompt
    ↓
Navigate to /login?returnPath={currentPath}
    ↓
After auth, return to same comment context
```

---

## Error Handling

### Private Repository Detection

When an unauthenticated user attempts to access a private repository, GitHub typically returns a 404 (not 403) to avoid confirming the repository's existence. However, 403 responses can also occur for permission-related access denials. The client should treat both as potential private repository indicators for unauthenticated requests.

**Detection logic**:
```typescript
if ((response.status === 404 || response.status === 403) && !token) {
  error.isPrivateRepo = true;
}
```

### Error Messages

| Scenario | Unauthenticated Message | Authenticated Message |
|----------|------------------------|----------------------|
| 404 on PR | "This PR may be private or doesn't exist. Log in to access." | "Pull request not found." |
| 403 on PR | "You don't have permission to view this PR. Log in to access." | "You don't have permission. Request access from the repository owner." |
| Rate limit exceeded | "Rate limit exceeded. Resets in {time}. Sign in for higher limits." | "Rate limit exceeded. Resets in {time}." |
| Artifact unavailable | "Sign in to enable iteration tracking." | "Iteration tracking unavailable for this repository." |

---

## UI Components

### Login Button (Header)

- **Location**: Dashboard and PR page headers
- **Visibility**: Only when unauthenticated
- **Label**: "Log in" or "Log in with GitHub"
- **Behavior**: Navigate to `/login?returnPath={currentPath}`

### Rate Limit Warning Banner

- **Location**: Below titlebar (similar to DegradedModeBanner)
- **Visibility**: When `remaining < 20% of limit`
- **Content**: "{remaining} requests remaining. Sign in for 5,000 requests/hour."
- **Actions**: "Sign in" button, dismiss (unless exhausted)
- **ARIA**: `role="alert"`, `aria-live="polite"` (or `assertive` when exhausted)

### Private Repo Prompt

- **Location**: Full-page centered card (replaces PR content)
- **Icon**: Lock icon
- **Title**: "This PR may be private"
- **Content**: Explanation + "Log in with GitHub" button + "Back to Dashboard" link
- **ARIA**: Main heading is `<h1>`, login button auto-focused

### Comment Login Prompts

- **Reply prompt**: Button labeled "Log in to reply" replacing reply input
- **Add comment prompt**: Either hide "+" button or show modal on click
- **Resolve prompt**: Disable button with tooltip "Log in to resolve"

---

## Implementation Notes

### GitHubClient Changes

1. **Optional Authorization header**: Only include `Authorization: Bearer {token}` when token exists
2. **Rate limit parsing**: Extract from response headers on every request
3. **Private repo flag**: Add `isPrivateRepo` to GitHubAPIError when 404 without token
4. **No auto-logout on 401**: Only trigger logout if token was present

### Auth Store Changes

1. **New state fields** (not persisted):
   - `rateLimitRemaining: number | null`
   - `rateLimitReset: Date | null`
   - `rateLimitLimit: number | null`

2. **New action**:
   - `updateRateLimit(info: RateLimitInfo): void`

### New Hooks

1. **`useOptionalAuth()`**: Returns auth state without redirecting
   ```typescript
   function useOptionalAuth(): {
     isAuthenticated: boolean;
     isLoading: boolean;
     token: string | null;
   }
   ```

2. **`useRateLimitWarning()`**: Returns rate limit warning state
   ```typescript
   function useRateLimitWarning(): {
     shouldWarn: boolean;
     remaining: number | null;
     resetTime: Date | null;
     isExhausted: boolean;
   }
   ```

### Route Changes

| Route | Current Guard | New Guard |
|-------|--------------|-----------|
| `/` | Redirect based on auth | Always redirect to `/dashboard` |
| `/dashboard` | `useRequireAuth()` | `useOptionalAuth()` |
| `/:owner/:repo/:number` | `useRequireAuth()` | `useOptionalAuth()` |
| `/login` | `useRedirectIfAuthenticated()` | No change |

---

## Security Considerations

### Token Exposure

- Unauthenticated mode does not expose any tokens
- Rate limit tracking uses only numeric data from headers
- No sensitive information stored for unauthenticated users

### Private Repository Privacy

- GitHub returns 404 (not 403) for private repos to unauthenticated users
- This prevents confirming repository existence
- CodjiFlo follows same pattern in error messages

### Rate Limit Abuse

- Per-IP rate limiting means shared IPs (offices, universities) may hit limits faster
- Warning threshold (20%) provides early notice
- Encouraging authentication improves experience and distributes load

---

## Testing Considerations

### Mock Mode Requirements

- Mock GitHub API to return rate limit headers
- Mock 404 responses for private repo simulation
- Mock successful responses for public repo data

### Test Scenarios

1. **Happy path**: Unauthenticated user views public PR
2. **Private PR**: Unauthenticated user sees login prompt
3. **Rate limiting**: Warning appears at threshold
4. **Rate exhausted**: Non-dismissible banner, requests blocked
5. **Comments read-only**: All comments visible, actions disabled
6. **Login redirect**: Return to correct page after auth
