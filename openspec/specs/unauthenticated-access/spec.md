# unauthenticated-access Specification

## Purpose
Public-PR review without login — public-repo detection, rate-limit accounting and surfacing, private-PR detection with login prompt, contextual login prompts for write actions, and the boundary between view-only and login-required surfaces.

## Requirements
### Requirement: Unauthenticated Public PR Access
The system SHALL allow unauthenticated users to view public pull requests, including PR metadata, file changes, diffs, and existing comments, without requiring login.

#### Scenario: Unauthenticated user opens a public PR URL
- **WHEN** an unauthenticated user navigates to a public PR route `/{owner}/{repo}/{number}`
- **THEN** the system loads PR metadata, file changes, and diff content from the GitHub API without sending an `Authorization` header and renders the PR page successfully

#### Scenario: Unauthenticated user views existing review comments
- **WHEN** an unauthenticated user opens a public PR that has review and issue comments
- **THEN** the system fetches and displays all comments in read-only mode

### Requirement: Optional Authorization Header
The system SHALL omit the `Authorization: Bearer {token}` header from outbound GitHub API requests whenever no authentication token is present, and MUST include it on every request when a token is available.

#### Scenario: No token present
- **WHEN** the GitHub API client issues any request and the auth store has no token
- **THEN** the request MUST NOT include an `Authorization` header

#### Scenario: Token present
- **WHEN** the GitHub API client issues any request and a valid token is present
- **THEN** the request MUST include `Authorization: Bearer {token}`

### Requirement: Landing Route for Unauthenticated Users
The system SHALL route unauthenticated visitors to the dashboard rather than forcing them through a login flow.

#### Scenario: Unauthenticated visitor hits the root route
- **WHEN** an unauthenticated user navigates to `/`
- **THEN** the system redirects them to `/dashboard` where they can enter a PR URL or choose to log in

#### Scenario: Dashboard renders without authentication
- **WHEN** an unauthenticated user reaches `/dashboard`
- **THEN** the system renders the dashboard with a PR URL input and a "Log in" button without redirecting to `/login`

### Requirement: Private Repository Detection
The system SHALL treat HTTP 404 or 403 responses from the GitHub API as potential private-repository indicators when the request was made without an authentication token, and SHALL surface this signal to the UI.

#### Scenario: 404 returned on unauthenticated PR fetch
- **WHEN** an unauthenticated user requests a PR and the GitHub API responds with HTTP 404
- **THEN** the API client flags the resulting error as `isPrivateRepo` so the UI can present a login prompt instead of a generic "not found" message

#### Scenario: 403 returned on unauthenticated PR fetch
- **WHEN** an unauthenticated user requests a PR and the GitHub API responds with HTTP 403
- **THEN** the API client flags the resulting error as `isPrivateRepo`

#### Scenario: 404 returned while authenticated
- **WHEN** an authenticated user requests a PR and the GitHub API responds with HTTP 404
- **THEN** the API client MUST NOT flag the error as `isPrivateRepo` and the UI displays a "Pull request not found" message

### Requirement: Private Repository Login Prompt
The system SHALL display a dedicated, accessible login prompt in place of PR content whenever a private-repo indicator is detected for an unauthenticated user.

#### Scenario: Unauthenticated user opens a private PR
- **WHEN** the PR page receives an error flagged as `isPrivateRepo` for an unauthenticated user
- **THEN** the system replaces the PR content with a full-page prompt containing a lock icon, a heading "This PR may be private", a "Log in with GitHub" button, and a link back to the dashboard

#### Scenario: Login from private repo prompt preserves destination
- **WHEN** the user clicks "Log in with GitHub" on the private repo prompt at `/{owner}/{repo}/{number}`
- **THEN** the system navigates to `/login?returnPath=/{owner}/{repo}/{number}` and, after a successful OAuth completion, returns the user to the original PR page

### Requirement: Rate Limit Accounting
The system SHALL parse `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers from every GitHub API response and update transient rate-limit state available to the UI.

#### Scenario: GitHub response includes rate limit headers
- **WHEN** any GitHub API response is received
- **THEN** the system extracts the three rate-limit headers and updates the auth store's `rateLimitLimit`, `rateLimitRemaining`, and `rateLimitReset` fields

#### Scenario: Rate limit state is not persisted
- **WHEN** the user reloads the application
- **THEN** rate-limit state MUST be reinitialized to null and MUST NOT be restored from persistent storage

### Requirement: Rate Limit Warning Banner
The system SHALL surface a rate-limit warning banner to unauthenticated users when the remaining request budget falls below 20% of the limit, encouraging sign-in for a higher quota.

#### Scenario: Remaining requests drop below the warning threshold
- **WHEN** an unauthenticated user's `rateLimitRemaining` is below 20% of `rateLimitLimit`
- **THEN** the system displays a banner below the titlebar with the remaining count, a sign-in call to action, and an accessible `role="alert"` with `aria-live="polite"`

#### Scenario: Rate limit exhausted
- **WHEN** `rateLimitRemaining` reaches zero
- **THEN** the banner becomes non-dismissible, switches `aria-live` to `assertive`, and continues to display until the reset time elapses or the user authenticates

#### Scenario: Above warning threshold
- **WHEN** `rateLimitRemaining` is at or above 20% of `rateLimitLimit`
- **THEN** the rate-limit warning banner MUST NOT be displayed

### Requirement: Contextual Login Prompts for Write Actions
The system SHALL gate every comment write action (post, reply, resolve, edit, delete, react) behind authentication and SHALL replace each disabled control with a contextual login prompt rather than a generic error.

#### Scenario: Unauthenticated reply attempt
- **WHEN** an unauthenticated user views a comment thread
- **THEN** the reply input is replaced by a "Log in to reply" button

#### Scenario: Unauthenticated add-comment attempt
- **WHEN** an unauthenticated user attempts to add a new comment on a diff line
- **THEN** the system either hides the add-comment affordance or presents a login prompt on activation, never silently failing

#### Scenario: Unauthenticated resolve attempt
- **WHEN** an unauthenticated user hovers a resolve control
- **THEN** the control is disabled and exposes a "Log in to resolve" tooltip

#### Scenario: Login from a write-action prompt preserves context
- **WHEN** an unauthenticated user activates any comment login prompt
- **THEN** the system navigates to `/login?returnPath={currentPath}` and returns to the same comment context after OAuth completes

### Requirement: Header Login Affordance
The system SHALL expose a "Log in" affordance in the dashboard and PR page headers whenever the user is unauthenticated, and SHALL hide it when authenticated.

#### Scenario: Unauthenticated header
- **WHEN** an unauthenticated user views the dashboard or a PR page
- **THEN** the header displays a "Log in" (or "Log in with GitHub") button that links to `/login?returnPath={currentPath}`

#### Scenario: Authenticated header
- **WHEN** the user is authenticated
- **THEN** the header MUST NOT display the "Log in" affordance

### Requirement: Unauthenticated Iteration Mode
The system SHALL fall back to stateless iteration mode for unauthenticated users because GitHub Actions artifact downloads require authentication, and SHALL communicate that iteration tracking can be enabled by signing in.

#### Scenario: Unauthenticated PR view requests iterations
- **WHEN** an unauthenticated user opens a PR
- **THEN** the system MUST NOT attempt to download iteration artifacts and instead operates in stateless mode as defined by the `iterations` capability

#### Scenario: Surfacing the artifact-unavailable reason
- **WHEN** an unauthenticated user is in stateless mode because of missing authentication
- **THEN** the UI presents the message "Sign in to enable iteration tracking" rather than a generic artifact error

### Requirement: Contextual Error Messaging by Auth State
The system SHALL tailor error messages for 404, 403, rate-limit, and artifact failures based on whether the user is authenticated, prompting unauthenticated users to log in when relevant.

#### Scenario: 404 on PR for unauthenticated user
- **WHEN** an unauthenticated user receives a 404 on a PR fetch
- **THEN** the displayed message reads "This PR may be private or doesn't exist. Log in to access."

#### Scenario: 403 on PR for unauthenticated user
- **WHEN** an unauthenticated user receives a 403 on a PR fetch
- **THEN** the displayed message reads "You don't have permission to view this PR. Log in to access."

#### Scenario: Rate limit exceeded for unauthenticated user
- **WHEN** an unauthenticated user has exhausted their rate limit
- **THEN** the displayed message includes the time until reset and the call to action "Sign in for higher limits."

#### Scenario: Rate limit exceeded for authenticated user
- **WHEN** an authenticated user has exhausted their rate limit
- **THEN** the displayed message includes the time until reset but MUST NOT prompt sign-in

### Requirement: No Auto-Logout for Unauthenticated 401
The system SHALL only trigger automatic logout on an HTTP 401 response when a token was present on the originating request, preventing spurious logout flows for unauthenticated users.

#### Scenario: 401 received without a token
- **WHEN** the GitHub API responds with HTTP 401 to a request issued without an `Authorization` header
- **THEN** the auth store MUST NOT clear any state and the UI MUST NOT trigger a logout flow

#### Scenario: 401 received with a token
- **WHEN** the GitHub API responds with HTTP 401 to a request that included an `Authorization` header
- **THEN** the system clears the stored token and transitions the user to the unauthenticated state

### Requirement: Route Guards Honor Unauthenticated Access
The system SHALL allow the dashboard and PR routes to render for unauthenticated users while continuing to redirect authenticated users away from the login route.

#### Scenario: Dashboard route is open
- **WHEN** an unauthenticated user navigates to `/dashboard`
- **THEN** the route renders without redirecting to `/login`

#### Scenario: PR route is open
- **WHEN** an unauthenticated user navigates to `/{owner}/{repo}/{number}`
- **THEN** the route renders without redirecting to `/login`, deferring auth prompts to per-feature checks

#### Scenario: Already-authenticated user visits `/login`
- **WHEN** an authenticated user navigates to `/login`
- **THEN** the system redirects them away from the login page

### Requirement: Privacy-Preserving Private Repo Messaging
The system SHALL avoid confirming the existence of private repositories to unauthenticated users by using the same "may be private or doesn't exist" wording regardless of whether the repository actually exists.

#### Scenario: Unknown vs private repo indistinguishable
- **WHEN** an unauthenticated user requests a PR for a repository that is either private or non-existent
- **THEN** the UI presents identical messaging that does not reveal which case applies

