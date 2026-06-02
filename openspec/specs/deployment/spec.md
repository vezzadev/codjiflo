# deployment Specification

## Purpose
Hosting and release on Cloudflare Workers (OpenNext adapter): Git-driven production deploys to `https://codjiflo.net`, per-PR previews on `*.workers.dev` (gated in CI via the `Workers Builds: codjiflo` check run), the `/api/health` commit contract, runtime secrets via the bound Cloudflare Secret Store, and the no-secret/no-`.env.local` local-dev model (GitHub-CLI auto-login). See [authentication/architecture.md](../authentication/architecture.md) for the preview-auth (PAT) details.

## Requirements
### Requirement: Git-based production release

The system SHALL deploy production from `main` using Cloudflare's default Git release process (Workers Builds connected to the GitHub repository). A push to `main` SHALL trigger a build of the Next.js app (OpenNext Cloudflare adapter) and deploy the resulting Worker to the production environment served at `https://codjiflo.net`.

#### Scenario: Push to main deploys production

- **WHEN** a commit is pushed to the `main` branch
- **THEN** Cloudflare builds and deploys the Worker to production
- **AND** `https://codjiflo.net` serves the built commit

#### Scenario: Health endpoint reports the deployed commit

- **WHEN** a client requests `https://codjiflo.net/api/health` after a deploy completes
- **THEN** the response `commit` field equals the Git SHA that was built (sourced from the Cloudflare/Worker build commit, not `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`)

### Requirement: Pull-request preview deployments

The system SHALL create an isolated preview deployment for each pull request via the Cloudflare Git integration, reachable at a stable per-PR preview URL, so reviewers can exercise the PR's build before merge.

#### Scenario: Opening a PR produces a preview

- **WHEN** a pull request is opened or updated against `main`
- **THEN** Cloudflare builds and deploys a preview for the PR's head commit
- **AND** a `Workers Builds: codjiflo` check run carrying the version-pinned preview URL is posted to the PR's head commit on GitHub (Cloudflare posts no GitHub deployment object)

#### Scenario: Preview is reachable at its version-pinned URL

- **WHEN** the preview URL's `/api/health` is requested after the build succeeds
- **THEN** it responds `200` (the URL is pinned to the exact build, so CI gates on liveness rather than a commit match)

#### Scenario: Preview authentication uses the origin-independent PAT path

- **WHEN** a reviewer opens a `*.workers.dev` preview (Cloudflare does not support a custom `*.codjiflo.net` preview domain, so cross-subdomain OAuth cannot complete on a preview origin)
- **THEN** they can authenticate by pasting a GitHub token (e.g. the output of `gh auth token`) into the Personal Access Token field, which validates directly against the GitHub API and depends on neither cookies, the OAuth callback, nor production
- **AND** unauthenticated public-PR review works on the preview with no token at all

### Requirement: CI gates on a successful Cloudflare build

CI SHALL wait for the Cloudflare Workers Builds check run (`Workers Builds: codjiflo`) to reach a successful state before running prod-mode E2E tests, and SHALL fail fast if that build reports failure. The `Workers Builds: codjiflo` check SHALL be configured as a required status check on the `main` branch. Cloudflare posts no GitHub deployment environment, so the gate is the check run — not a deployment status, and not the permanently-unsatisfiable `required_deployments: ["Preview"]` rule (which was removed).

#### Scenario: Prod E2E waits for the preview build

- **WHEN** the PR CI workflow runs
- **THEN** the prod-mode E2E job polls the `Workers Builds: codjiflo` check run until it succeeds, parsing the version-pinned preview URL from its output
- **AND** runs against that preview URL via `E2E_BASE_URL`

#### Scenario: Failed build fails CI

- **WHEN** the `Workers Builds: codjiflo` check run reports a `failure` state
- **THEN** the deploy-gating CI job exits non-zero

#### Scenario: Successful build required on main

- **WHEN** a PR is evaluated for merge into `main`
- **THEN** branch protection requires the `Workers Builds: codjiflo` check run to be successful

### Requirement: Runtime secrets via Cloudflare Secret Store

The app's only runtime secret, `GITHUB_APP_CLIENT_SECRET`, SHALL be stored in a Cloudflare Secret Store bound to the Worker and read at runtime through that binding; its value SHALL NOT be exported from the store, downloaded by tooling, or written into client-side bundles. Non-secret config (the client id, `NEXT_PUBLIC_*`, app URL) SHALL be plain Worker/build variables, not Secret Store entries. Test-time credentials such as the E2E GitHub token are NOT app secrets and SHALL NOT be bound to the Worker (CI injects the built-in `github.token`; local runs use a developer PAT).

#### Scenario: Worker reads the secret from the bound store

- **WHEN** a server route needs `GITHUB_APP_CLIENT_SECRET`
- **THEN** it reads the value from the bound Cloudflare Secret Store at runtime
- **AND** the value is never emitted to the client bundle or a deployment log

#### Scenario: Client id is a non-secret variable

- **WHEN** the build or Worker needs the GitHub client id
- **THEN** it reads it from a plain env var, not from the Secret Store

### Requirement: No tooling downloads secrets

Local development tooling SHALL NOT fetch secrets from any provider, and local dev SHALL require neither `GITHUB_APP_CLIENT_SECRET` nor a `.env.local` file. Running `npm run dev` (`NODE_ENV==='development'`) SHALL auto-sign-in by serving the dev-only `GET /api/auth/dev-token` route — which returns the GitHub CLI's OAuth token (`gh auth token`) — and consuming it in the `useDevAutoLogin` hook. The client-secret OAuth exchange SHALL therefore be exercised only in PR previews and production (where the secret is read from the bound Cloudflare Secret Store).

#### Scenario: Local dev signs in via the GitHub CLI, downloads no secret

- **WHEN** `npm run dev` runs locally with the developer logged into the GitHub CLI
- **THEN** the app auto-signs-in using the token from `gh auth token`, served by the dev-only `/api/auth/dev-token` route and consumed by `useDevAutoLogin`
- **AND** it fetches no secrets from Vercel, Cloudflare, or any provider, and needs no `.env.local`

#### Scenario: The dev-token route is development-only

- **WHEN** `/api/auth/dev-token` is reached in any non-development build (PR preview, production, or an E2E production build)
- **THEN** it returns `404` and never shells out to `gh`, so a deployed Worker can neither run `gh` nor leak a token

