import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: import.meta.dirname,
    resolveAlias: {
      fs: { browser: './src/lib/empty-module.js' },
      path: { browser: './src/lib/empty-module.js' },
      crypto: { browser: './src/lib/empty-module.js' },
    },
  },
};

export default nextConfig;
