# Knip Configuration

This project uses [Knip](https://knip.dev/) to detect unused files, dependencies, and exports.

## Running Knip

```bash
# Run knip and fail on issues (for CI)
npm run knip

# Run knip without failing (for local development)
npm run knip:check
```

## Configuration

Knip is configured in `knip.json` to handle the monorepo structure:

- **Main workspace (`.`)**: Next.js application with E2E tests
- **action**: GitHub Action for iteration tracking
- **packages/diff-engine**: Shared diff computation library

## Ignored Items

### Dependencies
- `@codemirror/commands` - Used indirectly through CodeMirror ecosystem
- `@codjiflo/diff-engine` - Workspace dependency
- `playwright-core` - Required by custom Playwright fork
- `pino` - Used in action workspace, not main app
- `@vercel/ncc` (action) - Used in build script
- `node-gyp` (action) - Required for native module compilation
- `tsx` (action) - Mentioned in documentation

### Files
- `src/lib/empty-module.js` - Intentional empty module for bundler
- `src/tests/mocks/**` - Test mocks that may not be directly imported

## Current Status

Knip reports the following intentional exports:

### Unused Exports (Intentional)
These are exported for API completeness or future use:
- `isBinaryFile` - Utility function in action
- `updatePRComment` - Comment manager function for future features
- `getE2EGitHubToken` - E2E test utility
- `diffGutter` - Backward compatibility alias
- `calculateVisibleLineRanges` - Public API for minimap calculations

### Unused Exported Types (Intentional)
Type definitions that are part of the public API:
- `ArtifactSnapshotRow`, `SpanTrackerRow` - Database types
- `IterationStatus`, `IterationComparison`, `IterationState` - Iteration types
- `ShortcutConfig` - Keyboard shortcut configuration
- `SQLiteRow` - SQLite utility type

### Duplicate Exports (Intentional)
Backward compatibility aliases:
- `createDiffGutter|diffGutter`
- `createDiffKeymap|diffKeymap`
- `createScrollSync|scrollSync`

These duplicate exports allow consumers to use either the factory function name (`create*`) or the shorter alias.

## Maintenance

When adding new dependencies or creating new entry points, update `knip.json` accordingly. The configuration uses glob patterns to automatically detect files in standard locations.
