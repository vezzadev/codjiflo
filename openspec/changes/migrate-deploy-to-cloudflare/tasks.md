## 1. Build & adapter setup

- [ ] 1.1 Add `@opennextjs/cloudflare` and `wrangler` as dev dependencies; remove the `vercel` dev dependency
- [ ] 1.2 Add `wrangler.jsonc` (Worker name, compatibility date/flags, assets/route config) and `open-next.config.ts`
- [ ] 1.3 Update `package.json` scripts: `build` → OpenNext Cloudflare build; add `preview`/`deploy` (wrangler); keep `dev` on Next/Turbopack (no secret-pull script)
- [ ] 1.4 Verify `next.config.ts` SQL.js/WASM config is compatible with the OpenNext build (server build only; SQL.js is client-side)
- [ ] 1.5 Run the OpenNext build locally and smoke-test with `wrangler dev`/`preview` (load app + `/api/health`)

## 2. Cloudflare Git release process & Secret Store (via `pedrovezzadev`)

- [ ] 2.1 Sign in as `pedrovezzadev`; connect the GitHub repo in Cloudflare (Workers Builds), production branch = `main`
- [ ] 2.2 Create a Cloudflare Secret Store named `codjiflo` and add its binding to the Worker (`wrangler.jsonc`) so the secret is available at runtime
- [ ] 2.3 Upload `GITHUB_APP_CLIENT_SECRET` (from the current `.env.local`) into the `codjiflo` Secret Store off-band (value never leaves the store). This is the only app secret; the E2E token is test-time only and is NOT uploaded
- [ ] 2.4 Once `GITHUB_APP_CLIENT_SECRET` is confirmed in the Secret Store, delete the entire `.env.local` so the plaintext secret no longer lives on disk
- [ ] 2.5 Set non-secret config as plain Worker/build env vars: client id (`GITHUB_APP_CLIENT_ID`, `NEXT_PUBLIC_GITHUB_CLIENT_ID`), `NEXT_PUBLIC_APP_URL=https://codjiflo.net`
- [ ] 2.6 Map `codjiflo.net` (DNS + Worker route + SSL) to the production Worker; configure a custom `*.codjiflo.net` preview domain for non-production deployments so previews keep the `.codjiflo.net` cookie domain (fall back to `*.workers.dev` = login-per-preview only if a custom preview domain isn't supported)
- [ ] 2.7 Open a throwaway test PR; confirm a Cloudflare preview deploys, posts a GitHub deployment status with `target_url`, and serves `/api/health`

## 3. Application & config repoint

- [ ] 3.1 Replace `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` in `src/app/api/health/route.ts` with `NEXT_PUBLIC_APP_COMMIT_SHA`; inline it at build time via the build command `NEXT_PUBLIC_APP_COMMIT_SHA=$WORKERS_CI_COMMIT_SHA <opennext build>` (Workers Builds build vars aren't available at runtime). Read `GITHUB_APP_CLIENT_SECRET` from the Secret Store binding at runtime (client id stays a plain env var)
- [ ] 3.2 Update `src/features/auth/utils/cookies.ts` `KNOWN_BASE_DOMAIN` from `.vza.net` to `.codjiflo.net`
- [ ] 3.3 Remove `vercel env pull` and all secret-download code from `scripts/ensure-env.js`; it must not fetch secrets from any provider. When `.env.local` is missing, print off-band setup guidance only (keep `CI` short-circuit, update help text)
- [ ] 3.4 Verify `scripts/dev.js` startup works without any secret download (off-band `.env.local`)
- [ ] 3.5 Resolve the E2E token: CI injects the built-in `github.token` as `GITHUB_TOKEN` (no stored PAT); `CODJIFLO_E2E_GITHUB_TOKEN` in `.env.local` is unwired since code reads `GITHUB_TOKEN`. Decide: drop `CODJIFLO_E2E_GITHUB_TOKEN`, or wire it → `GITHUB_TOKEN` for local prod-E2E. Not a Worker/Secret Store concern
- [ ] 3.6 Update GitHub App homepage + OAuth callback URLs to `https://codjiflo.net` (and previews under `*.codjiflo.net` if used)

## 4. CI/CD repoint

- [ ] 4.1 `ci-cd-pr.yml`: retarget `wait-for-vercel` to the Cloudflare deployment environment; rename appropriately; keep reading `target_url` for the preview URL
- [ ] 4.2 `ci-cd-pr.yml`: point preview health-check + `E2E_BASE_URL` at the Cloudflare preview URL
- [ ] 4.3 `ci-cd-main.yml`: retarget `wait-for-deployment` to the Cloudflare production deployment; switch health URL + stress-test `E2E_BASE_URL` to `https://codjiflo.net`
- [ ] 4.4 Remove the "Preview deployments handled by Vercel GitHub App" comment and any Vercel-specific env references in workflows

## 5. Required deployment check & cleanup

- [ ] 5.1 Enforce on GitHub: add the successful Cloudflare deployment status check as a required status check in the `main` branch-protection rule (using the `pedrovezzadev` org-admin account) so PRs targeting `main` can't merge until their Cloudflare deployment succeeds. Enable only after a green deploy is confirmed on a test PR
- [ ] 5.2 Delete `vercel.json` and `.vercel/`; remove remaining `NEXT_PUBLIC_VERCEL_*` references
- [ ] 5.3 Pause (do not delete) the Vercel project + disconnect its GitHub App once main has had a green Cloudflare deploy
- [ ] 5.4 Configure a 301 redirect `codjiflo.vza.net → codjiflo.net` in the Cloudflare account that owns `vza.net` (a different account — requires re-login/account switch; ask the user to authorize the change). Verify the redirect resolves and preserves path

## 6. Docs & verification

- [ ] 6.1 Update `openspec/specs/authentication/architecture.md` (domain, preview hostnames, env source, callback URLs) and `AGENTS.md` env-setup notes
- [ ] 6.2 Run `npm run test:all` (lint, typecheck, spec:validate, coverage, e2e, storybook) green
- [ ] 6.3 Confirm prod-mode E2E passes against the live Cloudflare deployment and `/api/health` reports the correct commit on `codjiflo.net`
