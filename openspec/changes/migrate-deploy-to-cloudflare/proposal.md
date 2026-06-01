## Why

CodjiFlo's hosting, preview deployments, and environment variables are all coupled to Vercel today. We are moving production and preview hosting to a Cloudflare Worker (already scaffolded) to consolidate on Cloudflare, use its native Git release process, and serve the app from a new apex domain `codjiflo.net`. Vercel-specific glue (env pull, `NEXT_PUBLIC_VERCEL_*`, CI deployment-status polling tuned to Vercel) becomes dead weight once the Worker is live.

## What Changes

- **BREAKING** Production and PR-preview hosting move from Vercel to a Cloudflare Worker. The Vercel project, `vercel.json`, `.vercel/`, and the `vercel` CLI dependency are removed.
- The canonical app domain changes from `codjiflo.vza.net` to **`codjiflo.net`**. PR previews move from `pr-{number}.codjiflo.vza.net` to Cloudflare's preview hostnames under `codjiflo.net` (custom preview domain) / the Worker's `*.workers.dev` alias.
- Releases use the **default Cloudflare Git release process** (Workers Builds connected to the GitHub repo): push to `main` → production deploy; PR/branch push → preview deploy, with deployment status posted back to GitHub.
- Next.js is built/served on Workers via the OpenNext Cloudflare adapter; a `wrangler` config and `@opennextjs/cloudflare` build step replace the Vercel build.
- The only app runtime **secret**, `GITHUB_APP_CLIENT_SECRET`, lives in a **Cloudflare Secret Store** bound to the Worker and is never exported/downloaded; the client id is a plain Worker **variable**, not a secret. `vercel env pull` and all secret-download code are removed; `scripts/ensure-env.js` no longer fetches secrets from any provider. Once `GITHUB_APP_CLIENT_SECRET` is in the Secret Store, the local `.env.local` (a Vercel artifact holding the plaintext secret) is **deleted entirely**. The E2E GitHub token is a **test-time** credential, not a Worker secret: CI injects the built-in `github.token` as `GITHUB_TOKEN` — it does not go into the Secret Store.
- CI: `wait-for-vercel` (PR) and `wait-for-deployment` (main) jobs are repointed to gate on the **Cloudflare deployment status** and the new domain's `/api/health`. The health endpoint's commit source moves off `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`.
- Repo/deploy ownership: the Cloudflare GitHub integration and `main` branch-protection are configured using the **`pedrovezzadev`** org-admin account (regular commits stay on `pedropaulovc`), so the **successful Cloudflare deployment** can be added as a **required status check** on `main`.

## Capabilities

### New Capabilities
- `deployment`: Hosting platform, Git-based release process, production + PR-preview deployments, CI deploy-gating, and build-time commit/version reporting for the app.

### Modified Capabilities
None at the requirement level. `authentication` has no requirement-level `spec.md` (only `architecture.md`); the base-domain / callback-URL / preview-hostname change from `*.codjiflo.vza.net` to `codjiflo.net` is a config + architecture-doc update captured in tasks, not a behavior-scenario change.

## Impact

- **Config/infra**: remove `vercel.json`, `.vercel/`; add `wrangler` config + `@opennextjs/cloudflare`; update `package.json` scripts (`build`, deploy) and remove `vercel` devDep.
- **Code**: `src/app/api/health/route.ts` (commit SHA source), `scripts/ensure-env.js`, `scripts/dev.js` (env bootstrap), `src/features/auth/utils/cookies.ts` (`KNOWN_BASE_DOMAIN`).
- **CI**: `.github/workflows/ci-cd-pr.yml`, `.github/workflows/ci-cd-main.yml` (deploy-wait jobs + health URLs + `E2E_BASE_URL`).
- **Docs/specs**: `openspec/specs/authentication/architecture.md`, `AGENTS.md` (env setup), new `openspec/specs/deployment/`.
- **External**: GitHub App OAuth callback URLs, DNS for `codjiflo.net`, Cloudflare Workers Builds connection (via `pedrovezzadev`), `main` branch-protection required check.
