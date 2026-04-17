# CodjiFlo GitHub Action

Captures PR iterations for force-push resilient code review.

## Quick Start

Add to your workflow (`.github/workflows/codjiflo.yml`):

```yaml
name: CodjiFlo Iteration Tracking

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  actions: write

jobs:
  capture:
    runs-on: ubuntu-latest
    steps:
      - uses: codjiflo/action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## How It Works

1. **On PR Event**: Action triggers when a PR is opened, updated, or reopened
2. **Capture**: Downloads previous artifact (if exists), captures new iteration
3. **Store**: Saves file contents and computes line mappings to SQLite
4. **Upload**: Uploads SQLite as GitHub artifact (90-day retention)
5. **Comment**: Posts/updates PR comment with artifact reference

## What Gets Captured

For each PR iteration:
- Iteration metadata (revision, SHAs, author, timestamp)
- File paths at each snapshot (handles renames)
- File content at base and head
- Precomputed SpanTrackers for comment tracking

## Outputs

| Output | Description |
|--------|-------------|
| `iteration-count` | Total number of iterations captured |
| `artifact-name` | Name of the uploaded artifact |

## Performance: Pre-bundled for Speed

**This action sits in the critical path for users receiving PR updates.** Every second of delay directly impacts developer experience, so we optimize for minimal execution time.

### Why Pre-bundling?

The action is pre-bundled with [@vercel/ncc](https://github.com/vercel/ncc) and committed to the repository:

| Approach | Execution Time | Notes |
|----------|----------------|-------|
| `npm ci` + `npx tsx` | ~60-120s | Downloads 80+ packages, compiles native modules |
| **Pre-bundled `dist/`** | **~1s** | Single `node dist/index.js` call |

### Build Process

The `dist/` directory contains:
- `bootstrap.js` - Loader that selects the correct native binary at runtime
- `index.js` - All TypeScript compiled and dependencies inlined (~1.5MB)
- `prebuilds/` - Native SQLite binaries for multiple Node.js versions (~2MB each)

**Multi-version support:** The action includes pre-built binaries for Node 20, 22, and 24. At runtime, `bootstrap.js` detects the Node.js version and loads the correct binary.

**Rebuilding after code changes:**

```bash
cd action
npm run build
rm -rf dist/build  # Remove ncc-generated binary (bootstrap.js handles this)
git add dist/
```

### Adding Support for New Node Versions

When a new Node.js version is released:

1. Find the ABI version: `node -p process.versions.modules`
2. Download the binary from [better-sqlite3 releases](https://github.com/WiseLibs/better-sqlite3/releases):
   ```bash
   curl -L -o dist/prebuilds/better_sqlite3-{ABI}.node \
     "https://github.com/WiseLibs/better-sqlite3/releases/download/v12.5.0/better-sqlite3-v12.5.0-node-v{ABI}-linux-x64.tar.gz"
   # Extract and rename the .node file
   ```
3. Update `dist/bootstrap.js` to include the new ABI in `SUPPORTED_ABIS`

| Node Version | ABI |
|--------------|-----|
| Node 20 | 115 |
| Node 22 | 127 |
| Node 24 | 137 |

## Development

```bash
# Install dependencies
npm install

# Build (required before committing changes)
# This also generates schema.generated.ts from schema.sql
npm run build

# Test
npm test

# Type check
npm run typecheck
```

### SQL Schema

The database schema is defined in `src/db/schema.sql`. This file is the source of truth for the SQLite schema.

- **Edit SQL**: Modify `src/db/schema.sql` directly
- **Auto-generated**: `src/db/schema.generated.ts` is generated from the SQL file by the build script
- **Build process**: `npm run build` automatically regenerates the TypeScript file before bundling

The SQL file uses `{{SCHEMA_VERSION}}` as a placeholder that gets replaced with the current version number during build.

## Architecture

```
src/
├── index.ts               # Entry point
├── db/
│   ├── schema.sql         # SQLite DDL (source of truth)
│   ├── schema.generated.ts # Auto-generated from schema.sql
│   ├── schema.ts          # Schema version and exports
│   └── database.ts        # Query operations
├── capture/
│   ├── iteration-capture.ts
│   └── file-fetcher.ts
├── spantracker/
│   ├── tracker.ts         # Computation logic
│   └── diff-engine.ts     # Line diff
└── comment/
    └── comment-manager.ts # PR comment updates
```

## License

MIT
