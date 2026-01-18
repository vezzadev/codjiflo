# Next.js 16.1.3 Issue - Minimal Reproduction

This directory contains a minimal reproduction case for an issue discovered when upgrading Next.js from 16.1.1 to 16.1.3.

## Issue Summary

The main CodjiFlo application uses a specific turbopack configuration in `next.config.ts`:

```typescript
turbopack: {
  root: import.meta.dirname,
  resolveAlias: {
    fs: { browser: './src/lib/empty-module.js' },
    path: { browser: './src/lib/empty-module.js' },
    crypto: { browser: './src/lib/empty-module.js' },
  },
}
```

This configuration works correctly with Next.js 16.1.1 but may cause issues with Next.js 16.1.3, particularly on certain platforms (possibly Windows-specific).

## Reproduction Case

A minimal, standalone reproduction has been created in the `nextjs-16.1.3-repro/` directory to isolate this issue.

### Quick Start

```bash
cd nextjs-16.1.3-repro/
npm install
npm run diagnose  # Check your environment
npm run dev       # Test the dev server
```

### Documentation

- **README.md** - Complete overview of the issue and reproduction steps
- **REPORTING.md** - Step-by-step guide to report this to the Next.js team
- **ISSUE_TEMPLATE.md** - Template for creating a GitHub issue
- **diagnose.mjs** - Environment diagnostic script
- **test-versions.mjs** - Compare behavior across Next.js versions

## Purpose

This reproduction serves multiple purposes:

1. **Isolated Testing** - Test the specific configuration independently from the main application
2. **Bug Reporting** - Provide a minimal, reproducible test case for Next.js developers
3. **Documentation** - Record the issue and potential workarounds
4. **Version Comparison** - Easy comparison between Next.js 16.1.1 and 16.1.3

## Current Status

- ✅ Works on Linux with both 16.1.1 and 16.1.3
- ❓ Status on Windows unknown (needs testing)
- ❓ Status on macOS unknown (needs testing)

## Next Steps

1. Test the reproduction on Windows (primary platform for this project)
2. Document exact error messages if the issue reproduces
3. Test with Next.js canary version
4. Report to Next.js team if issue persists
5. Implement workaround if necessary

## Context

This configuration is used in CodjiFlo to support SQL.js with WASM, which requires replacing Node.js built-in modules (fs, path, crypto) with empty modules in the browser environment.

## Workarounds

If the issue persists, potential workarounds include:

1. **Downgrade to Next.js 16.1.1** (temporary solution)
2. **Remove `root` configuration** (if not strictly necessary)
3. **Use `process.cwd()`** instead of `import.meta.dirname`
4. **Use custom `__dirname`** with `fileURLToPath` and `dirname`

See the reproduction's README.md for detailed workaround code examples.

## Related Files in Main Project

- `/next.config.ts` - Main Next.js configuration
- `/src/lib/empty-module.js` - Empty module replacement
- `/scripts/dev.js` - Custom dev server script (Windows-specific features)

## Links

- Next.js Issues: https://github.com/vercel/next.js/issues
- Next.js Turbopack Docs: https://nextjs.org/docs/architecture/turbopack
- import.meta.dirname: Node.js 20.11+ feature
