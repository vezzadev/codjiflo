import type { NextConfig } from 'next';
import { execSync } from 'node:child_process';

/**
 * Build commit SHA for /api/health. Inlined at build time via Next's `env`
 * (server-only — never read in the browser, so no NEXT_PUBLIC_ prefix).
 * Cloudflare Workers Builds provides WORKERS_CI_COMMIT_SHA; locally fall back
 * to git; 'unknown' if neither is available.
 */
function resolveCommitSha(): string {
  if (process.env.WORKERS_CI_COMMIT_SHA) return process.env.WORKERS_CI_COMMIT_SHA;
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Build-time constants inlined into the bundle. All non-secret. NEXT_PUBLIC_APP_URL
  // and NEXT_PUBLIC_GITHUB_CLIENT_ID are identical for production AND every preview
  // (OAuth callbacks always funnel through the canonical codjiflo.net domain — see
  // openspec/specs/authentication/architecture.md), so they live here with in-repo
  // defaults instead of Cloudflare dashboard build vars. Any value can still be
  // overridden by setting the matching env var at build time.
  env: {
    APP_COMMIT_SHA: resolveCommitSha(),
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.NODE_ENV === 'production' ? 'https://codjiflo.net' : 'http://localhost:3000'),
    NEXT_PUBLIC_GITHUB_CLIENT_ID:
      process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ?? 'Iv23liUEkzCUSR78IkHn',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  turbopack: {
    root: import.meta.dirname,
    // Resolve Node.js modules as empty for browser - SQL.js WASM support
    resolveAlias: {
      fs: { browser: './src/lib/empty-module.js' },
      path: { browser: './src/lib/empty-module.js' },
      crypto: { browser: './src/lib/empty-module.js' },
    },
  },
  // Webpack configuration for SQL.js WASM support (M4 Iteration Management)
  webpack: (config, { isServer }) => {
    // Fallback for Node.js modules not available in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Enable async WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },
};

export default nextConfig;
