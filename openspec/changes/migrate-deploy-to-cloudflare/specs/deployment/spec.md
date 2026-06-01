## ADDED Requirements

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
- **AND** a deployment status with the preview URL is posted to the PR's head commit on GitHub

#### Scenario: Preview serves the PR's commit

- **WHEN** the preview URL's `/api/health` is requested
- **THEN** the `commit` field equals the PR head SHA

#### Scenario: Preview shares the auth cookie domain

- **WHEN** a preview is served under the custom `*.codjiflo.net` preview domain
- **THEN** it shares the `.codjiflo.net` cookie domain so cross-subdomain auth works without a separate login

### Requirement: CI gates on successful deployment

CI SHALL wait for the Cloudflare deployment to reach a successful state before running prod-mode E2E tests, and SHALL fail fast if the deployment reports failure. The successful Cloudflare deployment SHALL be configured as a required status check on the `main` branch.

#### Scenario: Prod E2E waits for the preview deploy

- **WHEN** the PR CI workflow runs
- **THEN** the prod-mode E2E job waits for the Cloudflare preview deployment status to be `success`
- **AND** runs against the preview URL via `E2E_BASE_URL`

#### Scenario: Failed deployment fails CI

- **WHEN** the Cloudflare deployment reports a `failure` or `error` state
- **THEN** the deploy-gating CI job exits non-zero

#### Scenario: Deployment required on main

- **WHEN** a PR is evaluated for merge into `main`
- **THEN** branch protection requires the Cloudflare deployment check to be successful

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

Local development tooling SHALL NOT fetch secrets from any provider. `scripts/ensure-env.js` SHALL skip provisioning in CI, and when `.env.local` is absent locally it SHALL print off-band setup guidance rather than downloading secret values.

#### Scenario: Missing local env prints guidance, downloads nothing

- **WHEN** `npm run dev` runs locally without an existing `.env.local`
- **THEN** the env bootstrap prints off-band setup guidance
- **AND** it does not fetch secrets from Vercel, Cloudflare, or any provider

#### Scenario: CI skips env bootstrap

- **WHEN** the env bootstrap runs with `CI` set
- **THEN** it exits without attempting any provisioning
