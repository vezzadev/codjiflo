import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Vercel platform regression (started 2026-05-13): lambda bundler omits
  // @swc/helpers/esm/* from serverless trace, producing runtime
  // `Cannot find module '/var/task/node_modules/@swc/helpers/esm/...'`.
  // Confirmed still broken on next@16.2.6 + @swc/helpers@0.5.21 (2026-05-20).
  // Tracked: vercel/next.js#93852 and Vercel Community thread 41956.
  outputFileTracingIncludes: {
    '/**/*': ['./node_modules/@swc/helpers/**'],
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
