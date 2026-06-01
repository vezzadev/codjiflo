import { existsSync } from "fs";

// Skip in CI — env is injected by the workflows (GITHUB_TOKEN for prod-mode E2E,
// build vars for Workers Builds). Never provision anything here.
if (process.env.CI) {
  process.exit(0);
}

// CodjiFlo does not download secrets from any provider. The only app secret,
// GITHUB_APP_CLIENT_SECRET, lives in the Cloudflare `codjiflo` Secret Store in
// production and is supplied off-band locally via .env.local.
if (existsSync(".env.local")) {
  process.exit(0);
}

console.warn(
  "\n⚠️  No .env.local found — starting without GitHub credentials.\n" +
    "   Unauthenticated (public-PR) review works; login/token exchange will not.\n\n" +
    "   To enable real auth locally, create .env.local in the project root:\n" +
    "     GITHUB_APP_CLIENT_ID=Iv23liUEkzCUSR78IkHn\n" +
    "     NEXT_PUBLIC_GITHUB_CLIENT_ID=Iv23liUEkzCUSR78IkHn\n" +
    "     NEXT_PUBLIC_APP_URL=http://localhost:3000\n" +
    "     GITHUB_APP_CLIENT_SECRET=<from the Cloudflare codjiflo Secret Store / a maintainer>\n" +
    "     # Optional, for prod-mode E2E: GITHUB_TOKEN=<a GitHub PAT>\n\n" +
    "   Secrets are never fetched from Vercel, Cloudflare, or any provider.\n"
);

// Non-blocking: the app still runs for unauthenticated access.
process.exit(0);
