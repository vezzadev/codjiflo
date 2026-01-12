# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into your CodjiFlo Next.js application. The integration includes:

- **Client-side initialization** via `instrumentation-client.ts` (Next.js 15.3+ recommended approach)
- **Server-side tracking** via `posthog-node` for API route events
- **Reverse proxy configuration** in `next.config.ts` to reduce tracking blocker interference
- **Environment variables** configured in `.env` for PostHog API key and host
- **Error tracking** enabled via `capture_exceptions: true`
- **User identity reset** on logout to properly separate user sessions

## Events Implemented

| Event Name | Description | File Path |
|------------|-------------|-----------|
| `oauth_login_initiated` | User clicked the Login with GitHub button to start OAuth flow | `src/app/login/page.tsx` |
| `pat_login_initiated` | User expanded the PAT section and submitted a personal access token | `src/app/login/page.tsx` |
| `login_success` | User successfully authenticated via OAuth or PAT | `src/features/auth/stores/useAuthStore.ts` |
| `login_failed` | User's authentication attempt failed (invalid token, OAuth error, etc.) | `src/features/auth/stores/useAuthStore.ts` |
| `logout` | User logged out of the application | `src/app/dashboard/page.tsx` |
| `pr_url_submitted` | User submitted a pull request URL from the dashboard to view | `src/app/dashboard/page.tsx` |
| `pr_loaded` | Pull request data successfully loaded for review | `src/features/pr/stores/usePRStore.ts` |
| `pr_load_failed` | Failed to load pull request (404, access denied, or other error) | `src/features/pr/stores/usePRStore.ts` |
| `file_selected` | User selected a file from the file list to view its diff | `src/features/diff/stores/useDiffStore.ts` |
| `diff_view_mode_changed` | User changed the diff view mode (unified/split) | `src/features/diff/stores/useDiffStore.ts` |
| `comment_posted` | User posted a new comment or reply on a file diff | `src/features/comments/stores/useCommentsStore.ts` |
| `iteration_range_changed` | User changed the iteration range to view different snapshots of the PR | `src/features/iterations/stores/useIterationStore.ts` |
| `keyboard_shortcuts_opened` | User opened the keyboard shortcuts modal | `src/app/[owner]/[repo]/[number]/page.tsx` |
| `server_oauth_token_exchanged` | Server-side: OAuth token exchange completed successfully | `src/app/api/auth/token/route.ts` |
| `server_oauth_token_exchange_failed` | Server-side: OAuth token exchange failed | `src/app/api/auth/token/route.ts` |

## Files Created/Modified

### New Files
- `instrumentation-client.ts` - Client-side PostHog initialization
- `src/lib/posthog-server.ts` - Server-side PostHog client
- `.env` - Environment variables for PostHog configuration

### Modified Files
- `next.config.ts` - Added reverse proxy rewrites for PostHog
- `src/app/login/page.tsx` - Added login initiation tracking
- `src/app/dashboard/page.tsx` - Added logout and PR URL submission tracking
- `src/app/[owner]/[repo]/[number]/page.tsx` - Added keyboard shortcuts tracking
- `src/app/api/auth/token/route.ts` - Added server-side OAuth tracking
- `src/features/auth/stores/useAuthStore.ts` - Added login success/failure tracking and identity reset
- `src/features/pr/stores/usePRStore.ts` - Added PR load success/failure tracking
- `src/features/diff/stores/useDiffStore.ts` - Added file selection and view mode tracking
- `src/features/comments/stores/useCommentsStore.ts` - Added comment posting tracking
- `src/features/iterations/stores/useIterationStore.ts` - Added iteration range change tracking

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

### Dashboard
- [Analytics Basics](https://us.posthog.com/project/285672/dashboard/1023333) - Core analytics dashboard tracking user authentication, PR review activity, and conversion funnels

### Insights
- [Login Conversion Funnel](https://us.posthog.com/project/285672/insights/9P8N9qle) - Tracks user flow from initiating login (OAuth or PAT) to successful authentication
- [PR Review Activity](https://us.posthog.com/project/285672/insights/F7Ehw6gi) - Tracks how many pull requests are being loaded and reviewed
- [Login Failures](https://us.posthog.com/project/285672/insights/OCidewsZ) - Tracks authentication failures by method and reason
- [User Journey Funnel](https://us.posthog.com/project/285672/insights/Lu8y41bX) - Complete user journey from login to reviewing PR files and posting comments
- [PR Load Errors](https://us.posthog.com/project/285672/insights/HjsGfSfG) - Tracks failed PR loads broken down by error type
