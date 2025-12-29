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

## Development

```bash
# Install dependencies
npm install

# Build
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
