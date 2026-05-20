import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Force-include @swc/helpers ESM files in serverless trace.
  // Vercel's lambda bundler omits them otherwise, producing runtime
  // `Cannot find module '/var/task/node_modules/@swc/helpers/esm/...'` errors.
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
