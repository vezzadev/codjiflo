# CodjiFlo

CodjiFlo is a code review tool inspired by Microsoft's CodeFlow, used by ~40,000 developers. It is especially tailored to power users of pull requests to improve contextual understanding and ease of code review and collaboration. 

## Features

### Advanced Commenting

- **Character-level precision** - Comment on specific characters within a line, not just entire lines
- **Region spanning** - Attach comments to multiple lines simultaneously
- **Floating bubbles** - Comments are visual objects with lasso connectors to code
- **Threading & states** - Organize discussions with status tracking (pending, won't fix, fixed, resolved)

### Iteration-Based Review

- **Before/During/After toggle** - Quickly switch between file states for context
- **Iteration comparison** - View changes between any two review versions
- **Comment persistence** - Comments follow code through iterations as lines move
- **Diff minimap** - Identify size and location of changes at a glance

### Multi-Platform Support

Backend abstraction layer supporting:
- GitHub (under development)
- Azure DevOps (future)
- GitLab (future)

### Build & CI Integration

- Improved build status and policy checks visibility for all reviewers
- Inline lint results
- Code coverage display

## Functional specification

Capability specs live under `openspec/specs/`. See [openspec/](openspec/) for the workflow ([changes](openspec/changes/), [archive](openspec/archive/), [test matrices](openspec/test-matrices/)).

| Capability | Description |
|-----------|-------------|
| [data-models](openspec/specs/data-models/spec.md) | Core TypeScript interfaces |
| [backend-abstraction](openspec/specs/backend-abstraction/spec.md) | Platform-agnostic API layer |
| [diff-viewing](openspec/specs/diff-viewing/spec.md) | Multi-mode diff with word-level highlighting |
| [comments](openspec/specs/comments/spec.md) | Bubble comment system |
| [iterations](openspec/specs/iterations/spec.md) | Cross-version tracking (stateful + stateless) |
| [review-lifecycle](openspec/specs/review-lifecycle/spec.md) | State machine & permissions |
| [ui-shell](openspec/specs/ui-shell/spec.md) | Dashboard, Explorer, Properties |
| [realtime-updates](openspec/specs/realtime-updates/spec.md) | Push notifications via WebSocket |
| [unauthenticated-access](openspec/specs/unauthenticated-access/spec.md) | Public PR review without login |

## Key Differentiators

1. **Comment precision** - Character-level vs line-level commenting
2. **Diff toggle** - Before/Both/After view switching
3. **Iteration tracking** - Comments persist through code movement
4. **Granular states** - Rich workflow states beyond approve/reject
5. **Build integration** - Automatic CI triggering and blocking
6. **Region commenting** - Multi-line comment spanning

## Project Name
CodjiFlo is a corrupted version (pt: [Corruptela](https://dicionario.priberam.org/corruptela)) of the word CodeFlow. Its pronunciation in English matches how a Brazilian with beginner level proficiency in English would say the word CodeFlow. It represents the fact that CodjiFlo is a "corrupted" version of the original CodeFlow and the author is Brazilian-American.

## Note
This project is not associated or endorsed by Microsoft Corp. The [CodjiFlo specification](./openspec/specs/) was produced following a clean-room approach: the desired behavior was codified from research articles, interviews published by Microsoft, blog posts, linked in the spec, and the author's memory of how CodeFlow works.
