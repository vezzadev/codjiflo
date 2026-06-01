# authentication — Architecture

> Implementation reference. The behavioral contract for this capability has not yet been formalized as `spec.md` — when it is, this document remains the implementation companion.

## Overview

GitHub App with OAuth 2.0 and PKCE (not a standalone OAuth App). Supports cross-subdomain auth for PR previews.

## Key Files

| File | Purpose |
|------|---------|
| `src/features/auth/config.ts` | OAuth config (client ID, scopes, URLs) |
| `src/features/auth/utils/pkce.ts` | PKCE utilities and state storage |
| `src/features/auth/utils/cookies.ts` | Cross-subdomain cookie utilities |
| `src/features/auth/hooks/useOAuthFlow.ts` | Initiates OAuth redirect |
| `src/features/auth/stores/useAuthStore.ts` | Token storage (Zustand + localStorage) |
| `src/app/api/auth/token/route.ts` | Server-side token exchange |
| `src/app/api/auth/refresh/route.ts` | Server-side token refresh |
| `src/app/auth/callback/page.tsx` | OAuth callback handler |
| `src/app/auth/landing/page.tsx` | Cross-subdomain token hydration |

## Cross-Subdomain Flow (PR Previews)

PR previews run on `pr-{number}.codjiflo.net` (Cloudflare custom preview domain under the `codjiflo.net` apex). GitHub OAuth only allows specific callback URLs, so all callbacks go through `codjiflo.net`, then redirect back.

```
pr-123.codjiflo.net (click login)
    ↓ store return origin cookie (domain=.codjiflo.net)
GitHub OAuth
    ↓
codjiflo.net/auth/callback
    ↓ exchange code, store token in transfer cookie
pr-123.codjiflo.net/auth/landing
    ↓ hydrate token from cookie
/dashboard
```

## Cookie Strategy

| Cookie | Purpose | TTL |
|--------|---------|-----|
| `oauth_code_verifier` | PKCE verifier | 10 min |
| `oauth_state` | CSRF protection | 10 min |
| `oauth_return_origin` | Redirect destination | 10 min |
| `oauth_token_transfer` | Token handoff | 1 min |

All cookies use `domain=.codjiflo.net` (hardcoded in `KNOWN_BASE_DOMAIN`).

## Environment Variables

Hosting is a Cloudflare Worker (OpenNext adapter). The **only secret**,
`GITHUB_APP_CLIENT_SECRET`, lives in the Cloudflare **Secret Store** (`codjiflo`)
bound to the Worker and is read at runtime via the binding — it is never
exported, downloaded, or written to the client bundle. Non-secret config is set
as plain Worker/build variables. No tooling fetches secrets from any provider;
locally the secret is supplied off-band in `.env.local`.

| Variable | Location | Purpose |
|----------|----------|---------|
| `GITHUB_APP_CLIENT_SECRET` | Cloudflare Secret Store (Worker binding) | Token exchange (secret) |
| `GITHUB_APP_CLIENT_ID` | Plain Worker var (`wrangler.jsonc`) | Token exchange (server runtime) |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | `next.config.ts` `env` default (inlined) | Build OAuth URL (browser) |
| `NEXT_PUBLIC_APP_URL` | `next.config.ts` `env` default (inlined) | Callback base URL (browser) |
| `APP_COMMIT_SHA` | `next.config.ts` `env` default (inlined) | `/api/health` commit; from `WORKERS_CI_COMMIT_SHA` or `git rev-parse` |

The three inlined values are **non-secret constants**, identical for production
and every preview (OAuth always funnels through the canonical `codjiflo.net`
domain). They are computed in `next.config.ts` via the `env` key — so **no
Cloudflare dashboard build vars or build-command override are needed**. The
commit SHA comes from `WORKERS_CI_COMMIT_SHA` (Cloudflare Workers Builds) with a
`git rev-parse HEAD` fallback for local builds. Each can still be overridden by
exporting the matching env var at build time. Only `GITHUB_APP_CLIENT_ID` (runtime,
paired with the secret) lives in `wrangler.jsonc` `vars`.

**Backup values:**
```
GITHUB_APP_CLIENT_ID = Iv23liUEkzCUSR78IkHn
NEXT_PUBLIC_GITHUB_CLIENT_ID = Iv23liUEkzCUSR78IkHn
NEXT_PUBLIC_APP_URL = http://localhost:3000        # local dev (NODE_ENV !== production)
NEXT_PUBLIC_APP_URL = https://codjiflo.net         # preview & prod
```

## GitHub App Setup

1. Go to https://github.com/settings/apps → "New GitHub App"
2. Set Homepage URL: `https://codjiflo.net`
3. Under "Identifying and authorizing users", add callback URLs:
   - `http://localhost:3000/auth/callback` (local dev)
   - `https://codjiflo.net/auth/callback` (production + PR previews under `*.codjiflo.net`)
4. Set required permissions (see table below)
5. Copy Client ID → `GITHUB_APP_CLIENT_ID` and `NEXT_PUBLIC_GITHUB_CLIENT_ID`
6. Generate Client Secret → `GITHUB_APP_CLIENT_SECRET`

## Required Permissions

**Repository permissions:**

| Permission | Access | Purpose |
|------------|--------|---------|
| Pull requests | Read & Write | View PRs, files, diffs; create/edit comments |
| Contents | Read | View raw file contents for diffs |
| Checks | Read | View CI status, code coverage results |
| Deployments | Read | View deployment status for PRs |
| Issues | Read | View linked issue titles, assignees |
| Metadata | Read | Required for all GitHub Apps |

## Security Considerations

- Return origin validated against `KNOWN_BASE_DOMAIN` to prevent open redirects
- Token transfer cookie uses 1-min TTL and is cleared immediately after read
- Base64 encoding is for transport only, not encryption
- HTTP status checked before JSON parsing
