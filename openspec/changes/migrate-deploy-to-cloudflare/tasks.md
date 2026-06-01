## 1. Build & adapter setup

- [x] 1.1 Add `@opennextjs/cloudflare` and `wrangler` as dev dependencies; remove the `vercel` dev dependency
- [x] 1.2 Add `wrangler.jsonc` (Worker name, compatibility date/flags, assets/route config) and `open-next.config.ts`
- [x] 1.3 Update `package.json` scripts: `build` IS `opennextjs-cloudflare build` (Cloudflare Workers Builds runs `npm run build`, so it must produce the Worker). The recursion (OpenNext's inner build defaults to `npm run build`) is broken by setting `config.buildCommand = 'next build'` in `open-next.config.ts`, so the inner build calls `next build` directly. `build:next` exposes a raw Next build; `preview`/`deploy` wrap OpenNext; `dev` stays on Next/Turbopack
- [x] 1.4 Verify `next.config.ts` SQL.js/WASM config is compatible with the OpenNext build (server build only; SQL.js is client-side) — OpenNext build completed clean
- [x] 1.5 Run the OpenNext build locally and smoke-test with `wrangler dev`/`preview` (load app + `/api/health`) — `/api/health` 200, `/` 200 via `wrangler dev`

## 2. Cloudflare Git release process & Secret Store (via `pedrovezzadev`)

- [ ] 2.1 Sign in as `pedrovezzadev`; connect the GitHub repo in Cloudflare (Workers Builds), production branch = `main`
- [x] 2.2 Used the account's default Secret Store (`cc49be40eb984d38a45fae3a4f29a9b2`) rather than a new `codjiflo` store; added the `secrets_store_secrets` binding to `wrangler.jsonc` (binding `GITHUB_APP_CLIENT_SECRET`). `wrangler deploy --dry-run` confirms it resolves as a Secrets Store Secret
- [x] 2.3 Uploaded `GITHUB_APP_CLIENT_SECRET` (from `.env.local`) into the default Secret Store off-band via `printf '%s' … | wrangler secrets-store secret create` (stdin, value never echoed). This is the only app secret; the E2E token is test-time only and is NOT uploaded
- [ ] 2.4 Once `GITHUB_APP_CLIENT_SECRET` is confirmed in the Secret Store, delete the entire `.env.local` so the plaintext secret no longer lives on disk
- [ ] 2.5 Non-secret config: `GITHUB_APP_CLIENT_ID` is now a plain Worker runtime `var` in `wrangler.jsonc` (server-side, not inlined). **Still dashboard:** the `NEXT_PUBLIC_*` values are inlined at BUILD time, so set them as Workers Builds build env vars — `NEXT_PUBLIC_GITHUB_CLIENT_ID=Iv23liUEkzCUSR78IkHn`, `NEXT_PUBLIC_APP_URL=https://codjiflo.net` (`.env.production` can't be committed — gitignored by the repo's `.env.*` rule)
- [ ] 2.6 Map `codjiflo.net` (DNS + Worker route + SSL) to the production Worker; configure a custom `*.codjiflo.net` preview domain for non-production deployments so previews keep the `.codjiflo.net` cookie domain (fall back to `*.workers.dev` = login-per-preview only if a custom preview domain isn't supported)
- [x] 2.7 Confirmed on PR #530 itself: Cloudflare builds + deploys a preview. It does **NOT** post a GitHub deployment/environment — it posts the `Workers Builds: codjiflo` check run carrying `Preview URL` (`https://<version>-codjiflo.vezza-dev.workers.dev`) and `Preview Alias URL` (`https://<branch>-codjiflo.vezza-dev.workers.dev`). Previews are on `*.vezza-dev.workers.dev` (custom `*.codjiflo.net` preview domain still pending, task 2.6 — workers.dev fallback = login-per-preview, fine for CI). **Ruleset implication (task 5.1):** the old `required_deployments: ["Preview"]` gate can never be met (no deployment env); require the `Workers Builds: codjiflo` check instead

## 3. Application & config repoint

- [x] 3.1 Replaced `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` → `NEXT_PUBLIC_APP_COMMIT_SHA` in `route.ts` (Next inlines it at build). `validateClientCredentials()` is now async and reads `GITHUB_APP_CLIENT_SECRET` from the bound Cloudflare Secret Store via `getCloudflareContext()`, falling back to `process.env` for local/CI; client id stays a plain env var. **Dashboard step (task 2.5):** set the Workers Builds build command to `NEXT_PUBLIC_APP_COMMIT_SHA=$WORKERS_CI_COMMIT_SHA npx opennextjs-cloudflare build` (build vars aren't available at runtime, so the SHA must be inlined at build)
- [x] 3.2 Updated `KNOWN_BASE_DOMAIN` `.vza.net` → `.codjiflo.net` (+ cookies/pkce tests, landing-page docs; 53 tests green)
- [x] 3.3 Rewrote `scripts/ensure-env.js`: no `vercel env pull` / no secret download; `CI` short-circuit kept; missing `.env.local` prints off-band guidance and is non-blocking
- [x] 3.4 Verified `scripts/dev.js` startup needs no secret download — it only calls `ensure-env.js`, which now exits 0 in all paths
- [x] 3.5 Resolved: **dropped** `CODJIFLO_E2E_GITHUB_TOKEN` (zero code refs). Code + `playwright.config.ts` already standardize on `GITHUB_TOKEN`; the stale var only lived in `.env.local` (removed in task 2.4). No code change needed
- [ ] 3.6 **[needs GitHub App dashboard]** Update GitHub App homepage + OAuth callback URLs to `https://codjiflo.net` (and previews under `*.codjiflo.net` if used)

## 4. CI/CD repoint

- [x] 4.1 `ci-cd-pr.yml`: `wait-for-deployment` reworked. **Cloudflare Workers Builds posts NO GitHub deployment object** — it posts a check run `Workers Builds: codjiflo` whose `output.summary` carries `Preview URL` (version-pinned `https://<ver>-codjiflo.vezza-dev.workers.dev`) + `Preview Alias URL` (branch). The job now polls the check-runs API for that check to succeed and parses the version-specific Preview URL → `preview-url`. Permission `deployments: read` → `checks: read`. (Verified on PR #530: deployments API only ever had `vercel[bot]` entries; Cloudflare uses checks.)
- [x] 4.2 `ci-cd-pr.yml`: the version-specific preview URL is pinned to the exact build, so the old commit-match health check is replaced by a liveness check (HTTP 200) — no dependency on `NEXT_PUBLIC_APP_COMMIT_SHA` for PR previews. `E2E_BASE_URL` still consumes `needs.wait-for-deployment.outputs.preview-url`
- [x] 4.3 `ci-cd-main.yml`: production wait reworked to poll the `Workers Builds` check run (no deployment object). Production has no version URL (serves `codjiflo.net` directly), so `Verify deployment serves new commit` keeps the commit-match against `https://codjiflo.net/api/health` — **this requires the dashboard build command to inject `NEXT_PUBLIC_APP_COMMIT_SHA=$WORKERS_CI_COMMIT_SHA`** (task 3.1). Stress-test `E2E_BASE_URL`s → `https://codjiflo.net`. Permission `deployments: read` → `checks: read`
- [x] 4.4 Replaced the Vercel GitHub App comment with the Cloudflare Workers Builds note; no Vercel env references remain in workflows

## 4b. codjiflo-action review-link domain

- [x] 4b.1 Updated `action/src/comment/comment-manager.ts` review link `codjiflo.vza.net` → `codjiflo.net` (+ tests, 7 pass); rebuilt `action/dist/index.js` (clean 2-line diff; reverted unrelated sourcemap/binary build churn)
- [ ] 4b.2 **[needs the standalone `github.com/codjiflo/action` repo]** Sync this change and release a new tag if consumers pin `@v1`

## 5. Required deployment check & cleanup

- [ ] 5.1 **[needs GitHub org-admin / `pedrovezzadev`]** Update the `main` ruleset (id 11385098): (a) **remove** `required_deployments: ["Preview"]` — Cloudflare posts no deployment env, so this gate is permanently unsatisfiable; (b) add `Workers Builds: codjiflo` as a required status check (the Cloudflare build signal). Keep `e2e-tests-prod`. Enable only after a green build is confirmed
- [x] 5.2 Deleted `vercel.json` and `.vercel/`; the only `NEXT_PUBLIC_VERCEL_*` ref (health route) was already replaced in task 3.1
- [ ] 5.3 **[needs Vercel dashboard]** Pause (do not delete) the Vercel project + disconnect its GitHub App once main has had a green Cloudflare deploy
- [ ] 5.4 **[needs the other Cloudflare account that owns `vza.net`]** Configure a 301 redirect `codjiflo.vza.net → codjiflo.net`, preserving path. Requires account switch — ask the user to authorize

## 6. Docs & verification

- [x] 6.1 Updated `openspec/specs/authentication/architecture.md` (domain, preview hostnames, Secret Store env source, commit-SHA build var, callback URLs) and `AGENTS.md` env-setup notes
- [x] 6.2 `npm run test:all` green — lint ✓ typecheck ✓ spec:validate (11) ✓ unit+coverage (1522) ✓ e2e mock (121) ✓ storybook (31) ✓
- [ ] 6.3 **[needs live Cloudflare deploy]** Confirm prod-mode E2E passes against the live deployment and `/api/health` reports the correct commit on `codjiflo.net`
