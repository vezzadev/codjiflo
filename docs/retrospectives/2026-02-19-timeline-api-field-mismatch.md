# Retrospective: Timeline API Field Mismatch Bug

**Date:** 2026-02-19
**Feature:** S-4.2.1 Commit-Based Iteration Loader / S-4.2.2 Collapsed Iterations UI
**Bug:** `TimelineLoader` expected `before_commit.sha`/`after_commit.sha` on force-push events, but the real GitHub Timeline API only provides `commit_id`
**Impact:** Collapsed iteration groups never appeared with real GitHub data — only with mocked test data
**Fix:** Commits `dde70c9`, `2d2dcbc`, `551aef3`

---

## What Happened

The `TimelineLoader` was designed and implemented around an incorrect assumption about the GitHub Timeline API response shape. The code expected `head_ref_force_pushed` events to include nested `before_commit` and `after_commit` objects:

```json
// ASSUMED (wrong)
{
  "event": "head_ref_force_pushed",
  "before_commit": { "sha": "abc123" },
  "after_commit": { "sha": "def456" }
}
```

The real API only provides a flat `commit_id` field:

```json
// ACTUAL
{
  "event": "head_ref_force_pushed",
  "commit_id": "def456",
  "commit_url": "https://api.github.com/repos/.../commits/def456"
}
```

This caused the filter at `timeline-loader.ts:155-160` to silently drop ALL force-push events (since `before_commit` and `after_commit` were always `undefined`), resulting in zero collapsed iteration groups with real data.

## Root Cause Chain

### 1. Design doc assumed API shape without verification

`docs/plans/2026-02-17-s-4.2.1-commit-based-iteration-loader-design.md` explicitly specified the wrong interface:

```typescript
interface TimelineEvent {
  before_commit?: { sha: string };
  after_commit?: { sha: string };
}
```

This was the source of truth for all downstream work. **Nobody verified this against the actual GitHub API documentation or a real API call.**

### 2. Spec propagated the wrong assumption

`spec/functional/iterations-stateless.md` documented force-push events as providing `before_commit.sha` and `after_commit.sha`. This was cited as the authoritative reference.

### 3. Test plan used the wrong mock shape

`spec/test/stateless-mode.md` contained mock data with the wrong fields:

```javascript
mockTimelineWithForcePush = [
  { event: 'head_ref_force_pushed', before_commit: { sha: 'abc123' }, after_commit: { sha: 'def456' } }
]
```

### 4. All tests — unit and E2E — used mocks based on the wrong spec

- `timeline-loader.test.ts`: 28 unit tests with wrong mock shapes
- `force-push-helpers.ts`: E2E mock helpers with wrong fields
- `github-mocks.ts`: `MockTimelineEvent` interface with wrong fields
- `iteration-stateless-mode.spec.ts`: inline mocks with wrong fields

### 5. TDD was followed — but mocks were wrong

The development process was textbook TDD:
1. Tester wrote failing tests (RED)
2. Implementer made them pass (GREEN)
3. Code reviewer approved

But the tester's mocks were derived from the wrong spec, so the tests validated incorrect behavior. TDD only catches bugs when the tests themselves are correct.

### 6. No real-API validation existed

There were zero tests that hit the real GitHub Timeline API. All testing (unit + mock-mode E2E) used synthetic responses that matched the assumed shape. The bug was invisible to the entire test suite.

## Why It Wasn't Caught

| Safety Net | Why It Failed |
|-----------|---------------|
| Design review | API shape was assumed, not verified against docs |
| Spec review | Spec codified the assumption as fact |
| TDD (tester) | Tester wrote mocks from spec, which was wrong |
| TDD (implementer) | Implemented against wrong mocks, code "worked" |
| Code review | Reviewer checked code against spec — both were consistent but wrong |
| Unit tests | All mocked with wrong shape |
| E2E tests (mock mode) | All mocked with wrong shape |
| E2E tests (prod mode) | No prod-mode E2E test for force-push detection existed |
| Manual testing | Not performed until demo phase |

**The entire chain was internally consistent.** Spec, design, code, and tests all agreed — they were just all wrong about the external API.

## Lessons Learned

### 1. Verify external API shapes with real data BEFORE writing specs

Any feature that integrates with an external API must start with a real API call to capture the actual response shape. This should be a mandatory step in the design phase, not deferred to testing.

**Action:** Add to AGENTS.md design checklist: "For external API integrations, capture real API responses and include them in the design doc."

### 2. Prod-mode E2E tests are essential for API integration features

Mock-mode E2E tests verify that the UI works with the expected data shape. Prod-mode E2E tests verify that the expected data shape actually matches reality. Both are needed.

**Action:** For any feature that parses external API responses, at minimum one prod-mode E2E test should verify the API shape matches expectations.

### 3. Mocks are a liability when they're not validated against reality

Mocks make tests fast and deterministic, but they encode assumptions about external systems. When those assumptions are wrong, mocks hide bugs instead of finding them.

**Action:** Consider adding runtime type assertions (e.g., Zod schemas) for external API responses that would fail fast in development if the response shape doesn't match.

### 4. The demo phase caught what testing didn't

The bug was discovered by the demo-presenter when they tried to use the feature with a real PR. This validates the demo phase as a critical quality gate — it's the first time the feature touches real data end-to-end.

### 5. "All tests pass" is not the same as "it works"

1477 unit tests and 130 E2E tests all passed. Zero tests used real GitHub API data for force-push detection. Test count is not a proxy for correctness.

## Remaining Cleanup

The following files still contain the wrong `before_commit`/`after_commit` fields and should be updated to reflect reality:

- `spec/functional/iterations-stateless.md` (lines 65, 170)
- `spec/test/stateless-mode.md` (lines 159-167)
- `docs/plans/2026-02-17-s-4.2.1-commit-based-iteration-loader-design.md` (lines 97-98, 128)
