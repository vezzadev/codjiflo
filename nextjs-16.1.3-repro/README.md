# Next.js 16.1.3 Turbopack Issue Reproduction

This is a minimal reproduction case for an issue with Next.js 16.1.3 when using `import.meta.dirname` in the turbopack configuration.

## Issue Description

When upgrading from Next.js 16.1.1 to 16.1.3, running `npm run dev` with turbopack may fail or exhibit unexpected behavior when the `next.config.ts` uses `import.meta.dirname` in the turbopack root configuration.

**Note**: This issue may be platform-specific and might primarily affect Windows environments.

## Configuration

The issue appears to be related to the following configuration in `next.config.ts`:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: import.meta.dirname,  // <-- Potential issue here
    resolveAlias: {
      fs: { browser: './src/lib/empty-module.js' },
      path: { browser: './src/lib/empty-module.js' },
      crypto: { browser: './src/lib/empty-module.js' },
    },
  },
};

export default nextConfig;
```

## Steps to Reproduce

1. Install dependencies:
   ```bash
   npm install
   ```

2. (Optional) Run diagnostics to check your environment:
   ```bash
   npm run diagnose
   ```
   This will show path handling and version information.

3. Run the dev server with turbopack:
   ```bash
   npm run dev
   ```

4. Observe any errors or unexpected behavior

## Expected Behavior

The dev server should start successfully with turbopack, as it does with Next.js 16.1.1.

## Actual Behavior

**On Linux/macOS**: The dev server appears to work correctly.

**On Windows**: [To be documented - the issue may manifest differently on Windows due to path handling differences]

Potential issues:
- Path separator handling (backslashes vs forward slashes)
- Module resolution failures
- Turbopack configuration errors

## Environment

- Next.js: 16.1.3
- Node.js: v20+ (ESM with import.meta.dirname support)
- OS: **Primarily affects Windows**
- Package Manager: npm

## Testing on Different Platforms

### Linux/macOS
```bash
npm install
npm run dev
npm run build
```

### Windows
```bash
npm install
npm run dev
npm run build
```

Pay special attention to:
- Console error messages
- Path-related warnings
- Module resolution errors

## Potential Root Causes

1. **Path Separator Issue**: `import.meta.dirname` returns paths with forward slashes on Unix but backslashes on Windows. This may cause issues with turbopack's path resolution.

2. **Relative Path Resolution**: The `resolveAlias` uses relative paths (`./src/lib/empty-module.js`) which may resolve differently when combined with `import.meta.dirname` on Windows.

3. **Turbopack Changes**: Changes in turbopack between 16.1.1 and 16.1.3 may have affected how the `root` option is processed.

## Workarounds

### Option 1: Downgrade to Next.js 16.1.1

```bash
npm install next@16.1.1
```

### Option 2: Remove the root configuration

If the root configuration is not strictly necessary:

```typescript
turbopack: {
  // root: import.meta.dirname,  // Remove this line
  resolveAlias: {
    fs: { browser: './src/lib/empty-module.js' },
    path: { browser: './src/lib/empty-module.js' },
    crypto: { browser: './src/lib/empty-module.js' },
  },
}
```

### Option 3: Use process.cwd() instead

```typescript
turbopack: {
  root: process.cwd(),
  // ... rest of config
}
```

### Option 4: Use absolute paths for resolveAlias

```typescript
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
    resolveAlias: {
      fs: { browser: join(__dirname, 'src/lib/empty-module.js') },
      path: { browser: join(__dirname, 'src/lib/empty-module.js') },
      crypto: { browser: join(__dirname, 'src/lib/empty-module.js') },
    },
  },
};
```

## Additional Context

This configuration is used to replace Node.js built-in modules (fs, path, crypto) with empty modules in the browser environment when using SQL.js with WASM support.

The same configuration works fine with Next.js 16.1.1 but may fail with 16.1.3, particularly on Windows.

## Files Structure

```
nextjs-16.1.3-repro/
├── next.config.ts          # Configuration with import.meta.dirname
├── package.json            # Next.js 16.1.3 dependency
├── tsconfig.json
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── lib/
│       └── empty-module.js # Empty module for Node.js replacement
└── README.md
```

## How to Report This to Next.js

If you can reproduce this issue:

1. Test with both Next.js 16.1.1 and 16.1.3
2. Document the exact error message
3. Note your operating system and Node.js version
4. Open an issue at: https://github.com/vercel/next.js/issues
5. Include this minimal reproduction
6. Tag with: `area: turbopack` and `area: configuration`
