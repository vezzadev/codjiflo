## Verify canary release

- [ ] I verified that the issue exists in the latest Next.js canary release

## Provide environment information

Operating System:
  Platform: Windows/macOS/Linux
  Version: 
Node: [version]
Package Manager: npm [version]
Relevant Packages:
  next: 16.1.3
  react: 19.2.1
  react-dom: 19.2.1
  typescript: 5.x

## Which area(s) are affected? (Select all that apply)

- [ ] Turbopack
- [ ] Configuration (next.config.ts)

## Which stage(s) are affected? (Select all that apply)

- [x] next dev (local)
- [ ] next build (local)
- [ ] next start (local)
- [ ] Vercel (Deployed)

## Link to the code that reproduces this issue

https://github.com/[your-username]/nextjs-16.1.3-repro

## To Reproduce

1. Clone the reproduction repository
2. Run `npm install`
3. Run `npm run dev`
4. Observe the error (may be Windows-specific)

## Current vs. Expected behavior

### With Next.js 16.1.1
The dev server starts successfully using the following configuration:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
```

### With Next.js 16.1.3
The dev server fails to start or exhibits unexpected behavior with the same configuration.

**Error Message**: [Insert actual error message here]

## Describe the Bug

When upgrading from Next.js 16.1.1 to 16.1.3, using `import.meta.dirname` in the `turbopack.root` configuration option causes issues when running `npm run dev`.

The configuration is used to replace Node.js built-in modules (fs, path, crypto) with empty modules in the browser environment for SQL.js WASM support.

This issue may be related to:
- Path handling differences between versions
- Changes in how turbopack processes the root option
- Platform-specific path resolution (particularly on Windows)

## Additional Context

The same application works correctly with Next.js 16.1.1, suggesting a regression between 16.1.1 and 16.1.3.

Potential workarounds:
1. Downgrade to Next.js 16.1.1
2. Remove the `root` configuration
3. Use `process.cwd()` instead of `import.meta.dirname`
4. Use a custom `__dirname` implementation with fileURLToPath

## Related Issues

- [Link to any related issues if found]
