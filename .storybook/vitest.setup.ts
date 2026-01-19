import { beforeAll } from 'vitest';
import { setProjectAnnotations } from '@storybook/react-vite';
import * as previewAnnotations from './preview';

// Mock process.env for browser environment in Storybook tests
if (typeof process === 'undefined') {
  (globalThis as any).process = {
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_GITHUB_CLIENT_ID: '',
      NEXT_PUBLIC_APP_URL: '',
    },
  };
}

const project = setProjectAnnotations([previewAnnotations]);

beforeAll(project.beforeAll);
