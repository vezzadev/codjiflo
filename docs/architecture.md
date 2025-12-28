# Architecture Documentation

## Authentication

### Overview
GitHub OAuth 2.0 with PKCE. Supports cross-subdomain auth for PR previews.

### Key Files
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

### Cross-Subdomain Flow (PR Previews)

PR previews run on `pr-{number}.codjiflo.vza.net`. GitHub OAuth only allows specific callback URLs, so all callbacks go through `codjiflo.vza.net`, then redirect back.

```
pr-123.codjiflo.vza.net (click login)
    ↓ store return origin cookie (domain=.vza.net)
GitHub OAuth
    ↓
codjiflo.vza.net/auth/callback
    ↓ exchange code, store token in transfer cookie
pr-123.codjiflo.vza.net/auth/landing
    ↓ hydrate token from cookie
/dashboard
```

### Cookie Strategy
| Cookie | Purpose | TTL |
|--------|---------|-----|
| `oauth_code_verifier` | PKCE verifier | 10 min |
| `oauth_state` | CSRF protection | 10 min |
| `oauth_return_origin` | Redirect destination | 10 min |
| `oauth_token_transfer` | Token handoff | 1 min |

All cookies use `domain=.vza.net` (hardcoded in `KNOWN_BASE_DOMAIN`).

### Environment Variables
| Variable | Location | Purpose |
|----------|----------|---------|
| `GITHUB_APP_CLIENT_ID` | Server | Token exchange |
| `GITHUB_APP_CLIENT_SECRET` | Server | Token exchange (secret) |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | Client | Build OAuth URL |
| `NEXT_PUBLIC_APP_URL` | Client | Callback base URL |

**PR previews:** Set `NEXT_PUBLIC_APP_URL=https://codjiflo.vza.net`

### Security Considerations
- Return origin validated against `KNOWN_BASE_DOMAIN` to prevent open redirects
- Token transfer cookie uses 1-min TTL and is cleared immediately after read
- Base64 encoding is for transport only, not encryption
- HTTP status checked before JSON parsing
