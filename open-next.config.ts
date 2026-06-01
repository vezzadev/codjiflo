import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Minimal OpenNext Cloudflare config: the Next.js App Router app is served by a
// full Node-compatible Worker. No incremental cache / queue overrides — the app
// has no ISR and stores iteration data as GitHub artifacts (see AGENTS.md §1.6).
const config = defineCloudflareConfig();

export default {
  ...config,
  // OpenNext builds the Next app by running this command (default: `npm run
  // build`). Cloudflare Workers Builds is configured to run `npm run build`,
  // and our `build` script IS `opennextjs-cloudflare build` — so point the
  // INNER Next build straight at `next build` to avoid infinite recursion
  // (npm run build -> opennext build -> npm run build -> ...).
  buildCommand: 'cross-env NODE_OPTIONS=--use-system-ca next build',
};
