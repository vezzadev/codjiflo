# Quick Reference

## TL;DR

This is a minimal reproduction for a potential Next.js 16.1.3 issue with `import.meta.dirname` in turbopack configuration.

## Quick Commands

```bash
# Install
npm install

# Diagnose environment
npm run diagnose

# Test dev server
npm run dev

# Test build
npm run build
```

## The Issue

Using this in `next.config.ts`:
```typescript
turbopack: {
  root: import.meta.dirname,  // <-- May cause issues
  // ...
}
```

## Status

- ✅ Works on Linux (tested)
- ❓ Unknown on Windows (needs testing)
- ❓ Unknown on macOS (needs testing)

## Quick Links

- [Full README](./README.md) - Complete documentation
- [Reporting Guide](./REPORTING.md) - How to report to Next.js
- [Issue Template](./ISSUE_TEMPLATE.md) - GitHub issue template
- [Next.js Issues](https://github.com/vercel/next.js/issues) - Report here

## Files Included

```
nextjs-16.1.3-repro/
├── README.md              # Main documentation
├── REPORTING.md           # How to report the issue
├── ISSUE_TEMPLATE.md      # GitHub issue template
├── QUICK_START.md         # This file
├── diagnose.mjs           # Environment diagnostics
├── test-versions.mjs      # Version comparison script
├── next.config.ts         # Config with the issue
├── package.json
├── tsconfig.json
└── src/
    ├── app/
    │   ├── layout.tsx
    │   └── page.tsx
    └── lib/
        └── empty-module.js
```

## Quick Test

Compare Next.js versions:

```bash
# Test 16.1.1
npm install next@16.1.1
npm run dev

# Test 16.1.3
npm install next@16.1.3
npm run dev
```

## Common Workarounds

### 1. Downgrade
```bash
npm install next@16.1.1
```

### 2. Use process.cwd()
```typescript
turbopack: {
  root: process.cwd(),
  // ...
}
```

### 3. Remove root
```typescript
turbopack: {
  // No root specified
  resolveAlias: { /* ... */ }
}
```

## Need Help?

1. Read [README.md](./README.md) for details
2. Run `npm run diagnose` to check your environment
3. Check existing Next.js issues
4. Ask in Next.js Discord #help-forum

## Reporting Checklist

Before reporting to Next.js:

- [ ] Tested with both 16.1.1 and 16.1.3
- [ ] Ran `npm run diagnose`
- [ ] Documented error messages
- [ ] Created public repo with reproduction
- [ ] Tested on the platform where issue occurs

See [REPORTING.md](./REPORTING.md) for complete guide.
