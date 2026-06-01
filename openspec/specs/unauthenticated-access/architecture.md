# unauthenticated-access — Architecture

> Implementation reference. The behavioral contract lives in [spec.md](spec.md).

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

## State Types

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

## Hooks

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

## Error Detection

When an unauthenticated user attempts to access a private repository, GitHub typically returns a 404 (not 403) to avoid confirming the repository's existence. However, 403 responses can also occur for permission-related access denials. The client should treat both as potential private repository indicators for unauthenticated requests.

**Detection logic**:
```typescript
if ((response.status === 404 || response.status === 403) && !token) {
  error.isPrivateRepo = true;
}
```

## Route Changes

| Route | Current Guard | New Guard |
|-------|--------------|-----------|
| `/` | Redirect based on auth | Always redirect to `/dashboard` |
| `/dashboard` | `useRequireAuth()` | `useOptionalAuth()` |
| `/:owner/:repo/:number` | `useRequireAuth()` | `useOptionalAuth()` |
| `/login` | `useRedirectIfAuthenticated()` | No change |

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
