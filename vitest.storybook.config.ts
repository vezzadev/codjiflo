import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import { playwright } from '@vitest/browser-playwright';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    storybookTest({
      configDir: path.join(dirname, '.storybook'),
      storybookScript: 'npm run storybook -- --ci --no-open',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['@storybook/react-vite'],
    exclude: ['playwright-core', 'playwright', '@playwright/test'],
  },
  test: {
    name: 'storybook',
    browser: {
      enabled: true,
      provider: playwright({}),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    setupFiles: ['./.storybook/vitest.setup.ts'],
  },
});
