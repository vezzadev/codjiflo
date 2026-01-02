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
- `index.js` - All TypeScript compiled and dependencies inlined (~1.5MB)
- `build/Release/better_sqlite3.node` - Linux x64 native SQLite binding for Node 20 (~2MB)

**Important:** When modifying action source code, you must rebuild before committing:

```bash
cd action

# Download Linux binary for Node 20 (ABI 115) used by GitHub Actions runners
curl -L -o linux-binary.tar.gz "https://github.com/WiseLibs/better-sqlite3/releases/download/v12.5.0/better-sqlite3-v12.5.0-node-v115-linux-x64.tar.gz"
tar -xzf linux-binary.tar.gz
cp build/Release/better_sqlite3.node node_modules/better-sqlite3/build/Release/

# Rebuild bundle
npm run build
rm -rf build linux-binary.tar.gz

git add dist/
```

### When GitHub Updates Node

If GitHub Actions runners update to a new Node.js version, the action will fail with:
```
was compiled against a different Node.js version using NODE_MODULE_VERSION X
```

To fix: Download the binary matching the new Node ABI version from [better-sqlite3 releases](https://github.com/WiseLibs/better-sqlite3/releases) and rebuild.

| Node Version | ABI |
|--------------|-----|
| Node 18 | 108 |
| Node 20 | 115 |
| Node 22 | 127 |
| Node 24 | 137 |

## Development

```bash
# Install dependencies
npm install

# Build (required before committing changes)
npm run build

# Test
npm test

# Type check
npm run typecheck
```

## Architecture

```
src/
├── index.ts               # Entry point
├── db/
│   ├── schema.ts          # SQLite DDL
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
