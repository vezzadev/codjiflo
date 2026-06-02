## Context

CodjiFlo is a Next.js 15 (App Router) app hosted on Vercel. Vercel's GitHub App auto-deploys production (`codjiflo.vza.net`) on push to `main` and PR previews (`pr-{n}.codjiflo.vza.net`), posting GitHub deployment statuses that CI polls (`wait-for-vercel`, `wait-for-deployment`). Env vars live in Vercel and sync locally via `vercel env pull`. The health endpoint reports the deployed commit via `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`. Cross-subdomain auth hardcodes `KNOWN_BASE_DOMAIN = .vza.net`.

A base Cloudflare Worker has already been created. We are migrating hosting to that Worker, moving to the apex domain `codjiflo.net`, and adopting Cloudflare's default Git release process. The app has server runtime needs (OAuth callback routes, `/api/health`), so it cannot be a static export.

## Goals / Non-Goals

**Goals:**
- Serve production and PR previews from the Cloudflare Worker, driven by Cloudflare's Git integration (Workers Builds).
- Cut over the canonical domain to `codjiflo.net`.
- Keep CI's deploy-gating + prod-mode E2E behavior (wait for deploy → run E2E against the deployed URL → verify commit via `/api/health`).
- Remove all Vercel coupling (config, CLI dep, env pull, `NEXT_PUBLIC_VERCEL_*`).
- Make a successful Cloudflare deployment a required check on `main`.

**Non-Goals:**
- Rewriting application behavior, auth flow logic, or the iteration/artifact pipeline.
- Changing the GitHub Action's iteration-**capture** logic. (The action's hardcoded "Review in CodjiFlo" link host `codjiflo.vza.net` → `codjiflo.net` IS in scope — it's part of the domain cutover.)
- Multi-region / edge-data architecture beyond what the Worker provides by default.
- Secretless local real-auth login. Deleting `.env.local` means local real-auth dev needs the secret supplied off-band. ~~A **future feature** will consider enabling **GitHub device-flow credentials** for local dev (client-id-only, no client secret on the developer's machine).~~ **Superseded:** local dev now auto-signs-in with the GitHub CLI's OAuth token via the dev-only `/api/auth/dev-token` route + `useDevAutoLogin` hook (no client secret on the developer's machine), so the device-flow idea is no longer needed. See [authentication/architecture.md](../../specs/authentication/architecture.md).

## Decisions

### Next.js on Workers via OpenNext Cloudflare adapter
Use `@opennextjs/cloudflare` with a `wrangler` config (`wrangler.jsonc` + `open-next.config.ts`). The app uses App Router server routes, so the adapter (full Node-compatible server on Workers) is required.
- *Alternatives*: `@cloudflare/next-on-pages` (Pages-oriented, weaker App Router/runtime coverage, and we want Workers per the pre-created Worker); static export (impossible — needs server routes). OpenNext is the current Cloudflare-recommended path for App Router on Workers.

### Default Cloudflare Git release process (Workers Builds), not a custom deploy workflow
Connect the repo in the Cloudflare dashboard so Cloudflare builds on push and manages production + non-production (preview) deployments, posting GitHub deployment statuses. This mirrors the prior Vercel GitHub-App model, so CI keeps gating on GitHub deployment statuses rather than calling `wrangler deploy` from Actions.
- *Alternatives*: `wrangler deploy` from a GitHub Actions job (more moving parts, secrets/token management, must re-implement previews + status posting). The user explicitly asked for the default Cloudflare git release process.

### Domain cutover to `codjiflo.net`
Production = `https://codjiflo.net`. Replace `codjiflo.vza.net` in CI health checks, `E2E_BASE_URL`, auth `KNOWN_BASE_DOMAIN` (→ `.codjiflo.net`), GitHub App homepage + callback URLs, and `architecture.md`.
- **PR previews:** the custom `*.codjiflo.net` preview domain proved **impossible** — Cloudflare hard-locks preview URLs to `*.workers.dev` (task 2.6 WONTFIX). On a `workers.dev` origin OAuth doesn't complete (host-only PKCE cookies + `isValidReturnOrigin()` rejects the origin), so previews authenticate via the **origin-independent PAT field** instead (paste `gh auth token`); unauthenticated public-PR review also works. CI reads the preview URL from the Workers Builds check output, so it stays scheme-agnostic.
- The old domain gets a **301 redirect** `codjiflo.vza.net → codjiflo.net`. `vza.net` lives in a **different Cloudflare account**, so this redirect is configured there, not in the app's account — it requires switching/re-logging into that account (a manual, off-band step that needs the user to authorize the account change).

### Commit SHA source for `/api/health`
Replace `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` with `NEXT_PUBLIC_APP_COMMIT_SHA`, sourced from Cloudflare Workers Builds' default build-time variable **`WORKERS_CI_COMMIT_SHA`**. Caveat: Workers Builds build variables are **not** available at runtime, so the build command must inline it into the bundle — `NEXT_PUBLIC_APP_COMMIT_SHA=$WORKERS_CI_COMMIT_SHA <opennext build>` — and `route.ts` reads `process.env.NEXT_PUBLIC_APP_COMMIT_SHA` (Next inlines `NEXT_PUBLIC_*` at build, same mechanism Vercel used).

### Secrets in Cloudflare Secret Store, never downloaded
Cloudflare Secret Store does not allow secret values to leave the store. The **only** app runtime secret is `GITHUB_APP_CLIENT_SECRET`; the client id is not sensitive and is a plain Worker **variable**. So: create a Secret Store for `codjiflo`, upload `GITHUB_APP_CLIENT_SECRET` into it, and **bind** the store to the Worker — the Worker reads the secret at runtime via the binding. Once the secret is confirmed in the store, **delete the entire `.env.local`** (a Vercel artifact that holds the plaintext secret) so the secret no longer lives on disk. Remove `vercel env pull` and every secret-download path from `scripts/ensure-env.js`; it must not fetch secrets from any provider. When `.env.local` is missing locally, `ensure-env` only prints off-band setup guidance (keep the `CI` short-circuit). Non-secret config (client id, `NEXT_PUBLIC_*`, app URL) is set as plain Worker/build env vars. Update help text and `AGENTS.md`.

The **E2E GitHub token is not an app secret** and is not bound to the Worker: the app never reads it — only Playwright does. CI already injects the built-in `github.token` as `GITHUB_TOKEN` for prod-mode E2E (`ci-cd-pr.yml`/`ci-cd-main.yml`); locally it's a developer PAT in `.env.local`. `CODJIFLO_E2E_GITHUB_TOKEN` (the Vercel-stored name) is currently unwired — code reads `GITHUB_TOKEN` — so the migration either drops it or maps it locally.
- *Alternatives*: auto-pulling secrets into `.env.local` (rejected — Secret Store won't export, and it contradicts the required off-band handling).

### `pedrovezzadev` (org admin) for the Cloudflare↔GitHub link
The Cloudflare GitHub integration and the `main` branch-protection required check are configured using the `pedrovezzadev` org-admin account, which holds the org/repo-admin rights needed to connect Workers Builds and enable the required deployment check. This is a standing role, not a temporary grant: regular code commits continue to be authored by `pedropaulovc`; `pedrovezzadev` is used only for org-admin operations (Cloudflare connection, branch protection).

## Risks / Trade-offs

- **Preview hostname scheme differs from Vercel's `pr-{n}` pattern** → CI already reads `target_url` from the GitHub deployment status, so it stays scheme-agnostic; only auth's `KNOWN_BASE_DOMAIN` needs the new apex.
- **Cross-subdomain cookie auth breaks if previews are not under `*.codjiflo.net`** → confirmed: Cloudflare can't map a custom preview domain (task 2.6 WONTFIX), so previews land on `*.workers.dev` and OAuth doesn't complete there. Resolved by the origin-independent PAT path (paste `gh auth token`) for preview auth.
- **OpenNext adapter incompatibility with current `next.config.ts` (webpack/turbopack WASM for SQL.js)** → validate the OpenNext build locally before cutover; SQL.js runs client-side, so server build should be unaffected, but verify.
- **DNS/SSL cutover gap on `codjiflo.net`** → stage DNS + Worker route before flipping CI health URLs; verify `/api/health` on the new domain first.
- **Required check wedges merges if misconfigured** → enable the required Cloudflare check only after a green deploy is observed on a test PR.
- **Hard cutover removes Vercel** → keep the Vercel project paused (not deleted) until the Worker has served a few green main deploys, for fast rollback.

## Migration Plan

1. Land app/build config on a branch: add `@opennextjs/cloudflare` + `wrangler` config + `open-next.config.ts`; update `package.json` build/deploy scripts; verify `npm run build` (OpenNext) and a local `wrangler dev`/preview.
2. In Cloudflare (via `pedrovezzadev`), connect the repo (Workers Builds), set production branch = `main`, configure env vars/secrets, and map `codjiflo.net` (DNS + route).
3. Open a test PR → confirm a Cloudflare preview deploys and posts a GitHub deployment status with a working `/api/health`.
4. Repoint code/config: health commit source, `KNOWN_BASE_DOMAIN` → `.codjiflo.net`, GitHub App homepage/callback URLs, `scripts/ensure-env.js`, `AGENTS.md`, auth `architecture.md`.
5. Repoint CI: rename/retarget `wait-for-vercel`/`wait-for-deployment` to the Cloudflare deployment environment, switch health URLs + `E2E_BASE_URL` to `codjiflo.net`/preview URLs.
6. Enforce deployment on GitHub: add the successful Cloudflare deployment status check as a **required status check** in the `main` branch-protection rule (via `pedrovezzadev`), so every PR targeting `main` is blocked from merge until its Cloudflare deployment reports success. Enable only after a green deploy is confirmed on a test PR (avoid wedging merges).
7. Remove Vercel: delete `vercel.json`, `.vercel/`, the `vercel` devDep, and `NEXT_PUBLIC_VERCEL_*` references.
8. **Rollback**: re-enable the paused Vercel project + GitHub App, revert CI/domain/env commits; DNS points back to Vercel.

## Open Questions

None outstanding.
