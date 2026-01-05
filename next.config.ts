import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Configure SWC to target modern browsers (Baseline features)
  // This reduces unnecessary polyfills and transforms for widely supported features
  compiler: {
    // Remove React properties (e.g., data-testid) in production
    reactRemoveProperties: process.env.NODE_ENV === 'production',
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
