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

## Cross-Subdomain Flow (`*.codjiflo.net`)

Any origin under the `codjiflo.net` apex (production, plus any `*.codjiflo.net`
subdomain) can sign in cross-subdomain. GitHub OAuth only allows specific
callback URLs, so all callbacks go through `codjiflo.net`, then redirect back.

```
foo.codjiflo.net (click login)
    ↓ store return origin cookie (domain=.codjiflo.net)
GitHub OAuth
    ↓
codjiflo.net/auth/callback
    ↓ exchange code, store token in transfer cookie
foo.codjiflo.net/auth/landing
    ↓ hydrate token from cookie
/dashboard
```

The flow relies on `domain=.codjiflo.net` cookies and `isValidReturnOrigin()`
accepting the origin, so it only works on `localhost` and `*.codjiflo.net`.

## Preview-Environment Auth (PAT path)

Cloudflare Workers Builds serves PR previews on **`*.workers.dev`** version/alias
URLs (e.g. `https://<branch>-codjiflo.vezza-dev.workers.dev`). Cloudflare hard-locks
preview URLs to `workers.dev` — they **cannot** be mapped to a `*.codjiflo.net`
custom domain. On a `workers.dev` origin the OAuth flow above does **not** complete:
the PKCE/return-origin cookies fall back to host-only (no `.codjiflo.net` domain to
share) and `isValidReturnOrigin()` rejects the non-`codjiflo.net` origin, so the
callback can't hand the token back.

The supported way to authenticate on a preview is the **Personal Access Token
field** on the login page ("Use Personal Access Token"). It is **origin-independent**:
`validateToken` only calls `GET https://api.github.com/rate_limit` with the token as
a bearer and persists it to `localStorage` — no cookies, no callback, no production
dependency. It accepts any of `ghp_`, `github_pat_`, `gho_`, or `ghs_` prefixes, so
the quickest source is **`gh auth token`** (a `gho_` GitHub CLI OAuth token) pasted
straight in — no PAT needs to be minted. The login page surfaces this as an info-icon
tip next to the PAT field. Unauthenticated public-PR review also works on previews
with no token at all.

> **`pr-{n}.codjiflo.net` custom preview domains were investigated and dropped**
> (migration task 2.6, WONTFIX) — Cloudflare does not allow it. CI prod-mode E2E
> seeds its own token and is unaffected; manual preview auth uses the PAT path above.

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
as plain Worker/build variables. No tooling fetches secrets from any provider.

**Local development needs no secret and no `.env.local`.** Running `npm run dev`
(`NODE_ENV==='development'`) serves a dev-only route, `GET /api/auth/dev-token`,
that returns the GitHub CLI's OAuth token (`gh auth token`); the login page's
`useDevAutoLogin` hook calls it and signs in automatically, skipping the OAuth
client-secret exchange. The route is hard-gated to development — any
production/preview build (and therefore every E2E run, which uses a production
build) returns 404 and never shells out, so a deployed Worker can neither run
`gh` nor leak a token. The secret-bound `/api/auth/token` code-exchange path is
consequently exercised only in PR previews and production. A maintainer who must
test the OAuth exchange locally can still set `GITHUB_APP_CLIENT_SECRET` in
`.env.local` and use the manual "Login with GitHub" / PAT options, which remain
available whenever the CLI auto-login is unavailable.

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
   - `https://codjiflo.net/auth/callback` (production; previews use the PAT path, see above)
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
