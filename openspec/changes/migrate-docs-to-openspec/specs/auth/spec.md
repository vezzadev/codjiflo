## ADDED Requirements

### Requirement: GitHub App OAuth 2.0 with PKCE

The system SHALL authenticate users via a GitHub **App** (not a standalone OAuth App) using the OAuth 2.0 authorization code flow with PKCE (Proof Key for Code Exchange). A client-side PKCE code verifier SHALL be generated per attempt and exchanged server-side; the code verifier MUST NOT leave the originating browser tab in plaintext.

#### Scenario: User initiates login
- **WHEN** an unauthenticated user clicks "Sign in with GitHub"
- **THEN** the client generates a fresh PKCE `code_verifier` and `state`, stores both in short-lived cookies, and redirects the browser to GitHub's OAuth authorize endpoint with the corresponding `code_challenge` and `state`

#### Scenario: Token exchange happens server-side
- **WHEN** GitHub redirects back with an authorization `code`
- **THEN** the server route `/api/auth/token` exchanges the `code` plus the cookie-stored `code_verifier` for an access token, and the client never sees the `GITHUB_APP_CLIENT_SECRET`

#### Scenario: State mismatch is rejected
- **WHEN** the `state` returned by GitHub does not match the `oauth_state` cookie
- **THEN** the callback route returns an error and does not perform a token exchange

### Requirement: Token refresh

The system SHALL refresh expired tokens through a server-side route rather than from the browser, keeping the refresh secret off the client.

#### Scenario: Expired token is refreshed
- **WHEN** a request to GitHub fails with an authentication error and the stored refresh token is still valid
- **THEN** the client calls `/api/auth/refresh`, which exchanges the refresh token server-side and returns a new access token

### Requirement: Cross-subdomain auth for PR previews

The system SHALL support login originating from `pr-{n}.codjiflo.vza.net` PR-preview subdomains while only registering a single GitHub callback URL (`https://codjiflo.vza.net/auth/callback`). The user SHALL be returned to the originating subdomain with a valid token after the callback completes.

#### Scenario: Login from a PR-preview subdomain
- **WHEN** a user on `pr-123.codjiflo.vza.net` initiates login
- **THEN** the originating subdomain is stored in an `oauth_return_origin` cookie scoped to `.vza.net`, the OAuth flow completes on `codjiflo.vza.net`, and the user is redirected to `pr-123.codjiflo.vza.net/auth/landing` which hydrates the token

#### Scenario: Return origin is validated
- **WHEN** the `oauth_return_origin` cookie value does not resolve to a subdomain of the known base domain (`.vza.net`)
- **THEN** the redirect is refused as an open-redirect attempt

### Requirement: Cookie strategy

The system SHALL use the following cookies during the OAuth flow, all scoped to `domain=.vza.net`:

| Cookie | Purpose | TTL |
|--------|---------|-----|
| `oauth_code_verifier` | PKCE verifier | 10 min |
| `oauth_state` | CSRF protection | 10 min |
| `oauth_return_origin` | Redirect destination | 10 min |
| `oauth_token_transfer` | Token handoff to originating subdomain | 1 min |

Transfer cookies SHALL be cleared immediately after the receiving page consumes them.

#### Scenario: Transfer cookie is single-use
- **WHEN** the `auth/landing` page reads `oauth_token_transfer`
- **THEN** the cookie is deleted before the page renders, preventing replay

#### Scenario: PKCE cookies expire after 10 minutes
- **WHEN** more than 10 minutes pass between login initiation and callback
- **THEN** the cookies are no longer present and the callback fails with a recoverable error that re-initiates the flow

### Requirement: Required GitHub App permissions

The system SHALL request only the minimum GitHub App permissions needed for review use cases.

**Repository permissions:**

| Permission | Access | Purpose |
|------------|--------|---------|
| Pull requests | Read & Write | View PRs, files, diffs; create/edit comments |
| Contents | Read | View raw file contents for diffs |
| Checks | Read | View CI status, code coverage |
| Deployments | Read | View deployment status |
| Issues | Read | View linked issue titles, assignees |
| Metadata | Read | Mandatory for all GitHub Apps |

The GitHub App SHALL NOT request `Contents: Write`, `Administration`, or any organization-level write scopes.

#### Scenario: Onboarding a new repo
- **WHEN** a user installs the GitHub App on a repository
- **THEN** GitHub displays exactly the permissions above and no broader scopes

### Requirement: Optional (unauthenticated) auth mode

The system SHALL allow unauthenticated browsing of public PRs, falling back to GitHub's unauthenticated REST rate limit (60 req/hr) and a read-only comment view.

#### Scenario: Anonymous user opens a public PR
- **WHEN** an unauthenticated user navigates to a public PR URL
- **THEN** the diff renders without a login redirect, comments are visible read-only, and reply controls show a "Log in to reply" prompt

#### Scenario: Anonymous user opens a private PR
- **WHEN** an unauthenticated user navigates to a private PR URL
- **THEN** GitHub returns 404 and the app redirects the user to the login flow

#### Scenario: Rate limit is surfaced
- **WHEN** the GitHub API returns an `X-RateLimit-Remaining: 0` response for an anonymous request
- **THEN** the app shows a banner indicating the remaining-quota state and suggests logging in

## Implementation Notes

| File | Purpose |
|------|---------|
| `src/features/auth/config.ts` | OAuth config (client ID, scopes, URLs) |
| `src/features/auth/utils/pkce.ts` | PKCE utilities and state storage |
| `src/features/auth/utils/cookies.ts` | Cross-subdomain cookie utilities |
| `src/features/auth/hooks/useOAuthFlow.ts` | Initiates OAuth redirect |
| `src/features/auth/hooks/useOptionalAuth.ts` | Non-redirecting auth hook for public PRs |
| `src/features/auth/stores/useAuthStore.ts` | Token storage (Zustand + localStorage) |
| `src/app/api/auth/token/route.ts` | Server-side token exchange |
| `src/app/api/auth/refresh/route.ts` | Server-side token refresh |
| `src/app/auth/callback/page.tsx` | OAuth callback handler |
| `src/app/auth/landing/page.tsx` | Cross-subdomain token hydration |

**Environment variables** (synced from Vercel via `vercel env pull`):

| Variable | Location | Purpose |
|----------|----------|---------|
| `GITHUB_APP_CLIENT_ID` | Server | Token exchange |
| `GITHUB_APP_CLIENT_SECRET` | Server | Token exchange (secret) |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | Client | Build OAuth URL |
| `NEXT_PUBLIC_APP_URL` | Client | Callback base URL |

Backup defaults: `GITHUB_APP_CLIENT_ID = Iv23liUEkzCUSR78IkHn`, `NEXT_PUBLIC_APP_URL = http://localhost:3000` (local) or `https://codjiflo.vza.net` (preview & prod). The known base domain is hardcoded as `KNOWN_BASE_DOMAIN = .vza.net`.

**GitHub App setup checklist:**
1. https://github.com/settings/apps → "New GitHub App"
2. Homepage URL: `https://codjiflo.vza.net`
3. Callback URLs: `http://localhost:3000/auth/callback` and `https://codjiflo.vza.net/auth/callback`
4. Permissions per the table above
5. Copy Client ID → `GITHUB_APP_CLIENT_ID` and `NEXT_PUBLIC_GITHUB_CLIENT_ID`
6. Generate Client Secret → `GITHUB_APP_CLIENT_SECRET`
