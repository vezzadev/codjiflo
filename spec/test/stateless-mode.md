# Stateless Mode Test Specification

This document defines the test matrix for validating CodjiFlo's Stateless Mode (M4.2). Tests cover timeline-based iteration detection, Web Worker diff computation, priority scheduling, and SpanTracker precomputation.

---

## Unit Tests

### TimelineLoader

| ID | Test Case | Input | Expected Output | Story |
|----|-----------|-------|-----------------|-------|
| TL-U01 | Extract initial iteration from PR | PR opened event | Iteration 1 with head SHA | S-4.2.1 |
| TL-U02 | Detect force-push from timeline | `head_ref_force_pushed` event | New iteration with before/after SHAs | S-4.2.1 |
| TL-U03 | Multiple force-pushes | 3 `head_ref_force_pushed` events | 4 iterations (initial + 3) | S-4.2.1 |
| TL-U04 | Chronological ordering | Events in random order | Iterations sorted by timestamp | S-4.2.1 |
| TL-U05 | Regular push (no force) | Push without `head_ref_force_pushed` event | No new iteration created | S-4.2.1 |
| TL-U06 | Handle empty timeline | No events | Single initial iteration | S-4.2.1 |
| TL-U07 | Handle PR with only merges | `merged` event | Single iteration | S-4.2.1 |

### DiffScheduler

| ID | Test Case | Setup | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| DS-U01 | Schedule task at priority | Task with High priority | Task added to queue | S-4.2.3 |
| DS-U02 | Priority ordering | Tasks at Low, High, Medium | Process High → Medium → Low | S-4.2.3 |
| DS-U03 | Same priority, different comment counts | 3 tasks, comments: 5, 2, 10 | Process 10 → 5 → 2 | S-4.2.3 |
| DS-U04 | Same priority and comments, different UI order | 3 tasks, UI order: 3, 1, 2 | Process 1 → 2 → 3 | S-4.2.3 |
| DS-U05 | Prioritize existing task | Task in queue, then prioritized | Task moved to Highest | S-4.2.3 |
| DS-U06 | Cancel in-progress on prioritize | Task running, new task prioritized | Running task cancelled | S-4.2.3 |
| DS-U07 | Clear queue | Tasks in queue, then clear() | All tasks removed | S-4.2.3 |
| DS-U08 | Get cached result | Task completed, then getResult() | Returns cached result | S-4.2.3 |
| DS-U09 | Duplicate task handling | Same taskId scheduled twice | Only one instance in queue | S-4.2.3 |

### DiffComputeWorker

| ID | Test Case | Input | Expected Output | Story |
|----|-----------|-------|-----------------|-------|
| DW-U01 | Compute line diff | Two file contents | diffLines with additions/deletions | S-4.2.2 |
| DW-U02 | Compute word diff | Modified line pair | Word-level changes | S-4.2.2 |
| DW-U03 | Compute alignment | Line diff | Aligned lines for side-by-side | S-4.2.2 |
| DW-U04 | Handle cancellation | AbortController abort | status: 'cancelled' | S-4.2.2 |
| DW-U05 | Handle fetch error | 500 from content API | status: 'error' with message | S-4.2.2 |
| DW-U06 | Handle GC'd commit | 404/410 from content API | status: 'unavailable' | S-4.2.2 |
| DW-U07 | Empty file diff | Empty string vs content | All lines as additions | S-4.2.2 |
| DW-U08 | Binary file detection | Binary content | status: 'error', reason: 'binary' | S-4.2.2 |

### StatelessStorage (IndexedDB)

| ID | Test Case | Operation | Expected Behavior | Story |
|----|-----------|-----------|-------------------|-------|
| SS-U01 | Store last seen | setLastSeen() | Data persisted to IndexedDB | S-4.2.5 |
| SS-U02 | Retrieve last seen | getLastSeen() | Returns stored data | S-4.2.5 |
| SS-U03 | Store discovered iteration | addDiscoveredIteration() | Iteration persisted | S-4.2.5 |
| SS-U04 | Iteration immutability | addDiscoveredIteration() twice with same revision | First value preserved | S-4.2.5 |
| SS-U05 | Mark unavailable | markUnavailable() | Unavailable status persisted | S-4.2.5 |
| SS-U06 | Get unavailable | getUnavailable() | Returns unavailable iterations | S-4.2.5 |
| SS-U07 | Handle IndexedDB unavailable | Private browsing mode | Graceful fallback, no crash | S-4.2.5 |

### SpanTrackerCompute

| ID | Test Case | Input | Expected Mappings | Story |
|----|-----------|-------|-------------------|-------|
| ST-U01 | Unchanged lines | Identical content | All 'unchanged' mappings | S-4.2.6 |
| ST-U02 | Addition only | Empty → content | All 'added' mappings | S-4.2.6 |
| ST-U03 | Deletion only | Content → empty | All 'deleted' mappings | S-4.2.6 |
| ST-U04 | Mixed changes | Realistic diff | Correct mapping types | S-4.2.6 |
| ST-U05 | Line number accuracy | 10-line file, line 5 modified | Left line 5 → Right null | S-4.2.6 |

---

## Integration Tests

### Timeline + Store Integration

| ID | Test Case | Setup | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| TLS-I01 | Load iterations into store | Mock timeline API response | Store populated with iterations | S-4.2.1 |
| TLS-I02 | Merge persisted + fresh iterations | IndexedDB has 2, API has 3 | Store has 3 (union) | S-4.2.5 |
| TLS-I03 | Last seen → default range | IndexedDB has last seen = 2, API has 4 | Default range: 2 → 4 | S-4.2.5 |
| TLS-I04 | First visit default range | No IndexedDB data | Default range: base → latest | S-4.2.5 |

### Scheduler + Worker Integration

| ID | Test Case | Setup | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| SW-I01 | End-to-end diff computation | Schedule task, mock GitHub API | Diff result returned | S-4.2.2, S-4.2.3 |
| SW-I02 | Priority preemption | Low task running, High scheduled | High completes first | S-4.2.3 |
| SW-I03 | Background SpanTracker | File with comment, diff completes | SpanTracker computed in background | S-4.2.6 |
| SW-I04 | Multiple files queued | 5 files scheduled | All complete in priority order | S-4.2.3 |

### Pipeline Integration

| ID | Test Case | Setup | Expected Behavior | Story |
|----|-----------|-------|-------------------|-------|
| PI-I01 | useDiffSource in stateless mode | Stateless store, file selected | Schedules task, returns result | S-4.2.4 |
| PI-I02 | Loading state while computing | File selected, diff not ready | Returns loading state | S-4.2.4 |
| PI-I03 | Result from cache | Diff already computed | Returns cached immediately | S-4.2.4 |
| PI-I04 | File list immediate display | PR loaded | File list shown before diffs ready | S-4.2.4 |

---

## E2E Tests

### Directory Structure

```
e2e/
├── common/stateless-mode/     # Run in both mock and prod modes
├── mock/stateless-mode/       # Mock mode only (Playwright route interception)
└── prod/stateless-mode/       # Prod mode only (real GitHub API)
```

### Mock Mode Tests (`e2e/mock/stateless-mode/`)

| ID | Test File | Test Case | Setup | Expected Behavior | Story |
|----|-----------|-----------|-------|-------------------|-------|
| SM-E01 | `iteration-selector.spec.ts` | Iteration selector shows in stateless mode | Mock PR without artifact | Selector visible with iterations | S-4.2.1 |
| SM-E02 | `iteration-selector.spec.ts` | Force-push creates new iteration | Mock timeline with head_ref_force_pushed | New iteration in selector | S-4.2.1 |
| SM-E03 | `diff-loading.spec.ts` | Diff shows loading state | Select file before diff ready | "Computing diff..." message | S-4.2.4 |
| SM-E04 | `diff-loading.spec.ts` | Diff appears after computation | Wait for worker to complete | Diff lines visible | S-4.2.4 |
| SM-E05 | `file-list.spec.ts` | File list appears immediately | PR loads | File list visible before diffs | S-4.2.4 |
| SM-E06 | `priority-queue.spec.ts` | Selected file loads first | Select file, others queued | Selected file diff appears first | S-4.2.3 |
| SM-E07 | `unavailable-iteration.spec.ts` | Unavailable badge shows | Mock 404 for commit | "Unavailable" badge on iteration | S-4.2.7 |
| SM-E08 | `unavailable-iteration.spec.ts` | Cannot select unavailable | Click unavailable iteration | Selection disabled | S-4.2.7 |
| SM-E09 | `force-stateless.spec.ts` | Query param forces stateless | PR with artifact, `?mode=stateless` | Stateless mode active | S-4.2.8 |
| SM-E10 | `comment-tracking.spec.ts` | Comment position tracked | File with comment, change iteration | Comment at correct position | S-4.2.6 |

### Common Mode Tests (`e2e/common/stateless-mode/`)

| ID | Test File | Test Case | Setup | Expected Behavior | Story |
|----|-----------|-----------|-------|-------------------|-------|
| SM-E11 | `terminology.spec.ts` | No "degraded" in UI | Any stateless PR | Term "stateless" used, not "degraded" | S-4.2.0 |
| SM-E12 | `no-banner.spec.ts` | No degraded mode banner | PR without artifact | Banner not visible | S-4.2.0 |
| SM-E13 | `iteration-range.spec.ts` | Cross-iteration diff works | Select iteration 1 → 3 | Diff shows changes across range | S-4.2.4 |
| SM-E14 | `iteration-range.spec.ts` | Default range for returning user | IndexedDB has last seen | Range starts from last seen | S-4.2.5 |

### Prod Mode Tests (`e2e/prod/stateless-mode/`)

| ID | Test File | Test Case | Setup | Expected Behavior | Story |
|----|-----------|-----------|-------|-------------------|-------|
| SM-E15 | `real-timeline.spec.ts` | Real PR timeline loads | Prod PR without workflow | Iterations from real timeline | S-4.2.1 |
| SM-E16 | `real-diff.spec.ts` | Real diff computation | Prod PR, select file | Diff computed from real content | S-4.2.4 |

---

## Test Data Requirements

### Mock Timeline Data

```typescript
// fixtures/mock-timeline.ts
export const mockTimelineWithForcePush = [
  {
    event: 'head_ref_force_pushed',
    before_commit: { sha: 'abc123' },
    after_commit: { sha: 'def456' },
    created_at: '2025-01-15T10:00:00Z',
    actor: { login: 'testuser' },
  },
  {
    event: 'head_ref_force_pushed',
    before_commit: { sha: 'def456' },
    after_commit: { sha: 'ghi789' },
    created_at: '2025-01-16T14:30:00Z',
    actor: { login: 'testuser' },
  },
];

export const mockPRData = {
  number: 42,
  head: { sha: 'ghi789' },
  base: { sha: 'base000' },
  created_at: '2025-01-14T09:00:00Z',
  user: { login: 'testuser' },
};
```

### Mock Compare API Response

```typescript
// fixtures/mock-compare.ts
export const mockCompareResponse = {
  status: 'ahead',
  ahead_by: 3,
  behind_by: 0,
  total_commits: 3,
  files: [
    {
      filename: 'src/app.ts',
      status: 'modified',
      additions: 10,
      deletions: 5,
      patch: '@@ -1,5 +1,10 @@\n context\n-deleted\n+added\n context',
    },
  ],
};
```

### Mock Content API Response

```typescript
// fixtures/mock-content.ts
export const mockFileContent = {
  name: 'app.ts',
  path: 'src/app.ts',
  sha: 'content123',
  content: btoa('// File content here\n'),
  encoding: 'base64',
};
```

---

## Test GitHub Repository

For prod mode tests, use a test repository without the CodjiFlo workflow installed:

- **Repository**: `codjiflo/test-stateless-mode`
- **PRs**:
  - PR #1: Simple PR with 2 files, 1 force-push
  - PR #2: PR with 5 force-pushes for iteration testing
  - PR #3: PR with old commits (may be GC'd for unavailable testing)

---

## Performance Requirements

| Metric | Threshold | Story |
|--------|-----------|-------|
| Initial iteration load | < 500ms | S-4.2.1 |
| First diff computation | < 2s | S-4.2.4 |
| File switch (cached) | < 100ms | S-4.2.3 |
| Background SpanTracker (per file) | < 500ms | S-4.2.6 |
| Priority preemption latency | < 200ms | S-4.2.3 |

---

## Accessibility Tests

| ID | Test Case | Expected Behavior | Story |
|----|-----------|-------------------|-------|
| A11Y-01 | Loading state announced | Screen reader announces "Computing diff" | S-4.2.4 |
| A11Y-02 | Unavailable iteration announced | Screen reader announces unavailable status | S-4.2.7 |
| A11Y-03 | Iteration selector keyboard nav | Tab/Enter navigates iterations | S-4.2.1 |

---

## Test Execution Summary

| Category | Test Count | Location |
|----------|------------|----------|
| Unit: TimelineLoader | 7 | `src/features/iterations/loaders/timeline-loader.test.ts` |
| Unit: DiffScheduler | 9 | `src/features/diff/scheduler/diff-scheduler.test.ts` |
| Unit: DiffComputeWorker | 8 | `src/features/diff/workers/diff-compute.worker.test.ts` |
| Unit: StatelessStorage | 7 | `src/features/iterations/storage/stateless-storage.test.ts` |
| Unit: SpanTrackerCompute | 5 | `src/features/iterations/workers/span-tracker-compute.test.ts` |
| Integration | 8 | `src/features/iterations/__tests__/integration/` |
| E2E Mock | 10 | `e2e/mock/stateless-mode/` |
| E2E Common | 4 | `e2e/common/stateless-mode/` |
| E2E Prod | 2 | `e2e/prod/stateless-mode/` |
| Accessibility | 3 | Integrated in E2E tests |

**Total: 63 test cases**
