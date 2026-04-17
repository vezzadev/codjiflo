# Iteration Management Specification

This specification has been split into three documents for better organization:

| Document | Description |
|----------|-------------|
| [iterations-common.md](./iterations-common.md) | Shared concepts: iteration semantics, snapshot system, comment tracking, artifact tracking, edge cases, complex git scenarios |
| [iterations-stateful.md](./iterations-stateful.md) | Stateful Mode: GitHub Action + SQLite artifact approach |
| [iterations-stateless.md](./iterations-stateless.md) | Stateless Mode: Timeline API + Web Worker approach |

---

## Quick Reference

### Mode Selection

| Mode | Trigger | Data Source |
|------|---------|-------------|
| **Stateful** | `<!-- codjiflo-data -->` comment found | SQLite artifact from GitHub Action |
| **Stateless** | No artifact comment OR `?mode=stateless` query param | GitHub Timeline + Compare APIs |

### Capability Matrix

| Feature | Azure DevOps | GitHub + Workflow (stateful) | GitHub (stateless) |
|---------|--------------|------------------------------|-------------------|
| Iteration ID stability | ✓ Server-assigned | ✓ Artifact-stored | ✓ Timeline-based |
| Character-level comments | ✓ | ✓ (in artifact) | ✗ Line-level |
| Force-push handling | ✓ | ✓ (before SHA in artifact) | ✓ (timeline events) |
| Cross-iteration compare | ✓ | ✓ | ✓ |
| SpanTracker (comment tracking) | ✓ | ✓ (precomputed) | ✓ (runtime computed) |
| GC resilience | ✓ | ✓ (content in artifact) | ✗ (commits may be lost) |
| Requires setup | ✗ | Workflow install | ✗ |

---

## Key Concepts

- **Iteration**: A PR revision that authors want reviewers to inspect (force-push creates new iteration)
- **Snapshot**: Each iteration has two snapshots (left=before, right=after)
- **SpanTracker**: Maps comment positions across code changes
- **Artifact**: Tracks file identity across renames

See [iterations-common.md](./iterations-common.md) for detailed explanations.
