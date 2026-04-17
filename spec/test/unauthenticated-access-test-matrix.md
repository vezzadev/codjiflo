# Unauthenticated Access Test Matrix

This document defines comprehensive test scenarios for validating CodjiFlo's unauthenticated experience. Tests cover public PR access, rate limiting, private repo detection, and read-only comment functionality.

## Test Environment

- **Mode**: Mock (Playwright route interception)
- **Directory**: `e2e/mock/degraded-mode/`
- **Auth State**: Cleared (no token in storage)

---

## Unit Tests

### GitHub Client (`github-client.test.ts`)

| ID | Test Case | Input | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| GC-01 | Request without token succeeds | No token, public endpoint | Request sent without Authorization header | S-4.1.2 |
| GC-02 | Request with token includes auth | Valid token | Authorization: Bearer {token} header included | S-4.1.2 |
| GC-03 | Rate limit headers parsed | Response with X-RateLimit-* | RateLimitInfo extracted correctly | S-4.1.2 |
| GC-04 | Rate limit headers missing | Response without headers | No error, rateLimit undefined | S-4.1.2 |
| GC-05 | 404 without token flags private | 404 response, no token | error.isPrivateRepo === true | S-4.1.2 |
| GC-06 | 404 with token no flag | 404 response, valid token | error.isPrivateRepo === false | S-4.1.2 |
| GC-07 | 401 no logout when unauthenticated | 401 response, no token | No logout triggered | S-4.1.2 |
| GC-08 | 403 without token flags private | 403 response, no token | error.isPrivateRepo === true | S-4.1.2 |

### Auth Store (`useAuthStore.test.ts`)

| ID | Test Case | Input | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| AS-01 | updateRateLimit sets state | RateLimitInfo object | Store updated with remaining, reset, limit | S-4.1.3 |
| AS-02 | Rate limit not persisted | Update then reload | Rate limit state is null after rehydration | S-4.1.3 |
| AS-03 | Initial rate limit state | Fresh store | rateLimitRemaining/Reset/Limit are null | S-4.1.3 |

### Rate Limit Warning Hook (`useRateLimitWarning.test.ts`)

| ID | Test Case | Input | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| RL-01 | No warning when authenticated | isAuthenticated: true | shouldWarn: false | S-4.1.3 |
| RL-02 | No warning when limit unknown | rateLimitRemaining: null | shouldWarn: false | S-4.1.3 |
| RL-03 | Warning at 12 remaining (20% of 60) | remaining: 12, limit: 60 | shouldWarn: true | S-4.1.3 |
| RL-04 | No warning at 13 remaining | remaining: 13, limit: 60 | shouldWarn: false | S-4.1.3 |
| RL-05 | Exhausted when remaining 0 | remaining: 0 | isExhausted: true | S-4.1.3 |
| RL-06 | Reset time passed through | resetTime set | resetTime in result matches | S-4.1.3 |

### Optional Auth Hook (`useOptionalAuth.test.ts`)

| ID | Test Case | Input | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| OA-01 | Returns false when unauthenticated | No token | isAuthenticated: false | S-4.1.1 |
| OA-02 | Returns true when authenticated | Valid token | isAuthenticated: true | S-4.1.1 |
| OA-03 | Loading while hydrating | hasHydrated: false | isLoading: true | S-4.1.1 |
| OA-04 | Not loading after hydration | hasHydrated: true | isLoading: false | S-4.1.1 |
| OA-05 | Does not redirect | Unauthenticated | No router.replace call | S-4.1.1 |

### Artifact Loader (`artifact-loader.test.ts`)

| ID | Test Case | Input | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| AL-01 | Returns null without token | No token | load() returns null immediately | S-4.1.5 |
| AL-02 | Finds artifact reference without token | No token, public PR | findArtifactReference() succeeds | S-4.1.5 |
| AL-03 | downloadArtifact returns null without token | No token | Returns null, logs warning | S-4.1.5 |

---

## Integration Tests

### Dashboard Integration (`dashboard.integration.test.tsx`)

| ID | Test Case | Setup | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| DI-01 | Dashboard loads without auth | Clear auth state | Page renders with PR input form | S-4.1.1 |
| DI-02 | Login button visible when unauthenticated | Clear auth state | "Log in" button in header | S-4.1.1 |
| DI-03 | Login button hidden when authenticated | Set valid token | No "Log in" button, shows user indicator | S-4.1.1 |
| DI-04 | PR URL navigation works unauthenticated | Enter public PR URL | Navigates to PR page | S-4.1.1 |

### PR Page Integration (`pr-page.integration.test.tsx`)

| ID | Test Case | Setup | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| PI-01 | Public PR loads without auth | Mock successful API | PR data displayed | S-4.1.2 |
| PI-02 | Private PR shows login prompt | Mock 404 response | PrivateRepoPrompt displayed | S-4.1.4 |
| PI-03 | Rate limit warning appears | Mock low rate limit | Banner visible | S-4.1.3 |
| PI-04 | Degraded mode entered without auth | No token | isDegraded: true, banner shown | S-4.1.5 |

### Comments Integration (`comments.integration.test.tsx`)

| ID | Test Case | Setup | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| CI-01 | Comments load without auth | Mock comments API | Comments displayed | S-4.1.6 |
| CI-02 | Reply button shows login prompt | Unauthenticated | "Log in to reply" button | S-4.1.6 |
| CI-03 | Add comment button hidden | Unauthenticated | "+" button not visible | S-4.1.6 |

---

## E2E Tests

### File: `e2e/mock/degraded-mode/unauthenticated-access.spec.ts`

| ID | Test Case | Steps | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| UA-01 | View public PR without login | Navigate to /facebook/react/123 | Diff view loads, no redirect | S-4.1.1, S-4.1.2 |
| UA-02 | Dashboard accessible without login | Navigate to /dashboard | Form and login button visible | S-4.1.1 |
| UA-03 | Root redirects to dashboard | Navigate to / | Ends up at /dashboard | S-4.1.1 |
| UA-04 | Login button preserves return path | Click login from PR page | /login?returnPath=/owner/repo/123 | S-4.1.1 |

### File: `e2e/mock/degraded-mode/rate-limit-warning.spec.ts`

| ID | Test Case | Steps | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| RW-01 | Warning appears at threshold | Mock remaining=12 | Banner with "{remaining} requests" | S-4.1.3 |
| RW-02 | No warning above threshold | Mock remaining=50 | No banner | S-4.1.3 |
| RW-03 | Exhausted state non-dismissible | Mock remaining=0 | Banner without dismiss button | S-4.1.3 |
| RW-04 | Sign in button navigates to login | Click sign in on banner | Navigates to /login | S-4.1.3 |
| RW-05 | Reset time displayed | Mock reset timestamp | "Resets in X minutes" shown | S-4.1.3 |

### File: `e2e/mock/degraded-mode/private-pr-detection.spec.ts`

| ID | Test Case | Steps | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| PP-01 | 404 shows login prompt | Mock 404 for PR | "This PR may be private" message | S-4.1.4 |
| PP-02 | Login button has return path | Check login button href | Includes returnPath parameter | S-4.1.4 |
| PP-03 | Back to dashboard link works | Click "Back to Dashboard" | Navigates to /dashboard | S-4.1.4 |
| PP-04 | Lock icon visible | Render prompt | Lock icon present | S-4.1.4 |
| PP-05 | Authenticated 404 shows different message | Set token, mock 404 | "Pull request not found" (no login prompt) | S-4.1.4 |

### File: `e2e/mock/degraded-mode/read-only-comments.spec.ts`

| ID | Test Case | Steps | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| RC-01 | Comments display without auth | Load PR with comments | All comments visible | S-4.1.6 |
| RC-02 | Reply shows login prompt | Find reply area | "Log in to reply" button | S-4.1.6 |
| RC-03 | Add comment hidden | Check diff lines | No "+" button on hover | S-4.1.6 |
| RC-04 | Login prompt navigates correctly | Click "Log in to reply" | /login with returnPath | S-4.1.6 |
| RC-05 | Comment content renders markdown | Comment with markdown | Formatted correctly | S-4.1.6 |
| RC-06 | Thread structure preserved | Nested replies | Proper indentation | S-4.1.6 |

---

## Test Data Requirements

### Mock API Responses

**Public PR Success** (`/repos/facebook/react/pulls/123`):
```json
{
  "id": 123,
  "number": 123,
  "title": "Test PR",
  "state": "open",
  "user": { "login": "testuser", "avatar_url": "..." },
  "head": { "sha": "abc123", "ref": "feature-branch" },
  "base": { "sha": "def456", "ref": "main" }
}
```

**Private PR Response** (404):
```json
{
  "message": "Not Found",
  "documentation_url": "https://docs.github.com/rest/pulls/pulls#get-a-pull-request"
}
```

**Rate Limit Headers** (low):
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 10
X-RateLimit-Reset: 1706300400
```

**Comments Response**:
```json
[
  {
    "id": 1,
    "body": "**Bold** and _italic_ comment",
    "user": { "login": "reviewer", "avatar_url": "..." },
    "created_at": "2024-01-26T10:00:00Z",
    "path": "src/index.ts",
    "line": 42
  }
]
```

---

## Coverage Targets

| Area | Target | Rationale |
|------|--------|-----------|
| GitHub Client changes | 90% | Critical path for all API calls |
| Rate limit hooks | 85% | User-facing warning logic |
| Auth hooks | 80% | Core routing behavior |
| New components | 70% | UI elements with clear behavior |
| Overall milestone | 70% | Matches project standard |

---

## Regression Risks

| Area | Risk | Mitigation |
|------|------|------------|
| Authenticated users | Auth flow broken | Existing E2E tests cover authenticated paths |
| Token refresh | Refresh stops working | Unit tests for refresh logic unchanged |
| Private repo access | Incorrect detection | Test both 404 and 403 scenarios |
| Rate limits | False positives | Test threshold boundaries exactly |
