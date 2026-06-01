import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Minimal OpenNext Cloudflare config: the Next.js App Router app is served by a
// full Node-compatible Worker. No incremental cache / queue overrides — the app
// has no ISR and stores iteration data as GitHub artifacts (see AGENTS.md §1.6).
export default defineCloudflareConfig();
