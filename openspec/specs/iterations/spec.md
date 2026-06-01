# iterations Specification

## Purpose
PR iteration tracking — iteration semantics, snapshot system, comment carry-across-versions, collapsed iterations, force-push resilience — across both stateful (GitHub Action + SQLite artifact) and stateless (Timeline API + Web Worker) modes, plus the mode-selection and fallback rules between them.

See [architecture.md](architecture.md) for implementation reference (full SQLite schema, algorithms, the Web Worker diagram, and the complex-git-scenario tables).

## Requirements
### Requirement: Iteration Definition and Immutability
The system SHALL model an iteration as an immutable PR revision consisting of a `before` snapshot and an `after` snapshot of the codebase, identified by a sequential 1-based revision number and a status of either `submitted` or `deleted`. Each iteration MUST be analyzable and comparable independently of the underlying git history.

#### Scenario: Iteration created on PR update
- **WHEN** a new revision is captured for a pull request
- **THEN** the system assigns it the next sequential revision number, records its author, description, submission timestamp, and `before`/`after` snapshots
- **AND** the iteration record is never mutated after creation

#### Scenario: Iteration granularity differs by mode
- **WHEN** capturing iterations in stateful mode
- **THEN** one iteration is created per push (multiple commits in a single push grouped into one iteration)
- **WHEN** capturing iterations in stateless mode
- **THEN** one iteration is created per commit (per-commit granularity)

### Requirement: Snapshot Index System
The system SHALL assign each iteration two snapshot indices: an even-numbered left snapshot representing the state before the iteration and an odd-numbered right snapshot representing the state after the iteration. The mapping MUST follow `leftSnapshot = (iteration - 1) * 2` and `rightSnapshot = (iteration - 1) * 2 + 1`.

#### Scenario: Snapshot indices for iteration 1
- **WHEN** iteration 1 is queried
- **THEN** its left snapshot index is 0 and its right snapshot index is 1

#### Scenario: Snapshot index invariants
- **WHEN** any iteration's snapshot indices are inspected
- **THEN** the left snapshot index is even and the right snapshot index is odd

### Requirement: Arbitrary Iteration Range Comparison
The system SHALL support comparing any two iterations, not only adjacent ones. The comparison MUST produce a `leftSnapshot`, `rightSnapshot`, per-file `FileComparison` entries, and an `isCrossIteration` flag set when the selected snapshots are not the adjacent left/right pair of a single iteration.

#### Scenario: User compares non-adjacent iterations
- **WHEN** the user selects "after iteration 1" through "after iteration 3"
- **THEN** the system compares snapshot 1 against snapshot 5
- **AND** the comparison is flagged as cross-iteration

#### Scenario: User compares adjacent iteration pair
- **WHEN** the user selects iteration N alone
- **THEN** the system compares snapshot `(N-1)*2` against snapshot `(N-1)*2 + 1`
- **AND** the comparison is NOT flagged as cross-iteration

#### Scenario: Cross-iteration diff in stateless mode
- **WHEN** the user selects iterations 1 through 3 in stateless mode
- **THEN** the diff view shows the cumulative changes across the selected range

### Requirement: Base Equivalence and Rebase Handling
The system SHALL treat all left (even) snapshots as containing equivalent content equal to the PR base when no rebase has occurred. When a rebase changes the base SHA, the system MUST use the latest iteration's left snapshot (not snapshot 0) as the base reference for the "full diff" view to avoid showing stale diffs against an outdated base.

#### Scenario: Full diff after rebase
- **WHEN** a PR has been rebased and the user selects "full diff"
- **THEN** the system uses the latest iteration's left snapshot as the base side of the comparison
- **AND** diffs reflect only the user's PR changes against the current base, not stale base content

#### Scenario: File first modified in later iteration
- **WHEN** a file exists in the PR base, is unchanged in iteration 1, and is first modified in iteration 2
- **THEN** the file is hidden from iteration 1's file list
- **AND** the file is marked as Modified (not Added) in iteration 2's file list

### Requirement: Iteration-Aware File List
The system SHALL display files in the file list only when content differs between the selected snapshot pair. Added/removed line counters and file status badges (Added, Modified, Deleted, Renamed) MUST reflect the selected iteration range, not the full PR diff.

#### Scenario: File unchanged in selected range
- **WHEN** the user selects an iteration range in which a file has identical content at both snapshots
- **THEN** the file is omitted from the file list

#### Scenario: Counters reflect range, not full PR
- **WHEN** the user views the range v5 to v6 for a file modified only in v6
- **THEN** the file's `+N -M` counters show only the lines changed between v5 and v6

### Requirement: File Artifact Tracking Across Renames
The system SHALL track each file as an artifact with a stable identifier (`changeTrackingId`) so that comments and history follow files across renames. The artifact MUST store the file's path at each snapshot index (or `null` if the file does not exist) and the inclusive snapshot range over which it exists.

#### Scenario: File renamed between iterations
- **WHEN** a file is renamed from `old/path.ts` to `new/path.ts` between iteration N and N+1
- **THEN** the same artifact stores `old/path.ts` at the left snapshot index and `new/path.ts` at the right snapshot index
- **AND** comments on the file continue to track to the new path

#### Scenario: File matching during comparison
- **WHEN** two snapshots are compared
- **THEN** files are matched by artifact ID; a file present only on the left is marked deleted, only on the right is marked added, and on both with differing content is marked edited or renamed

### Requirement: Comment Tracking via SpanTracker
The system SHALL provide a `SpanTracker` abstraction that maps a `TextSpan` from one snapshot to another in both directions (`trackSpanForward`, `trackSpanBackward`). Comment positions MUST be re-anchored across code changes using these mappings so that comments follow the code they reference even when lines shift, content changes, files are renamed, or code is deleted. See the `comments` capability for the comment data model.

#### Scenario: Comment on line that shifted due to insertion
- **WHEN** code is inserted above a commented line in a later iteration
- **THEN** the comment's display location is computed from the SpanTracker mapping and points to the new line number containing the original text

#### Scenario: Comment on deleted code
- **WHEN** the commented code is deleted in a later iteration and no equivalent content exists
- **THEN** the system attempts to anchor the comment to the nearest unchanged region
- **AND** if no anchor is available, the comment is marked as orphaned and floats to file level

#### Scenario: Unchanged content yields unchanged mappings
- **WHEN** SpanTracker mappings are computed between two identical file contents
- **THEN** every mapping has type `unchanged`

#### Scenario: Pure addition yields added mappings
- **WHEN** SpanTracker mappings are computed from an empty file to a non-empty file
- **THEN** every mapping has type `added`

#### Scenario: Pure deletion yields deleted mappings
- **WHEN** SpanTracker mappings are computed from a non-empty file to an empty file
- **THEN** every mapping has type `deleted`

#### Scenario: Mixed changes produce correct mapping types
- **WHEN** SpanTracker mappings are computed for a realistic diff combining additions, deletions, and unchanged context
- **THEN** each mapping has the correct type for its corresponding line span

#### Scenario: Line numbers accurate for single-line modification
- **WHEN** line 5 of a 10-line file is modified
- **THEN** the SpanTracker maps left line 5 to no corresponding right line and produces a separate `added` mapping for the new line 5

#### Scenario: Comment position tracked across iteration change
- **WHEN** a file contains a comment and the user switches to a different iteration
- **THEN** the comment is displayed at the position computed by the SpanTracker for the new iteration

### Requirement: Cross-Iteration Comment Tracking via Chained SpanTrackers
The system SHALL compute a comment's display position in a non-adjacent target iteration by chaining adjacent SpanTrackers from the comment's original iteration through each intermediate iteration up to the target.

#### Scenario: Comment displayed three iterations later
- **WHEN** a comment was created at iteration 1 and the user views iteration 4
- **THEN** the system chains SpanTrackers 1→2, 2→3, and 3→4 to compute the comment's display location at iteration 4

### Requirement: Comment Location Computation by View Context
The system SHALL compute a `CommentLocation` containing optional `leftContribution` and `rightContribution` based on the comment's view context: left-only for comments on deleted code, right-only for comments on added code, and both sides for comments on unchanged or context lines. When a comment originally on both sides maps to only one side after tracking, the system MUST degrade it to left-only or right-only.

#### Scenario: Comment on added code
- **WHEN** a comment was created on a newly added line
- **THEN** the `CommentLocation` has only `rightContribution` populated and `leftContribution` is `null`

### Requirement: SpanTracker Cache with Identity Optimization
The system SHALL cache computed SpanTrackers keyed by snapshot pair (e.g., `"2-3"`) and reuse them across requests. When the file content is identical between the two snapshots, the system MUST use a trivial tracker that returns spans unchanged rather than computing a full diff.

#### Scenario: Cache hit on repeat request
- **WHEN** a SpanTracker for snapshot pair `2-3` has already been computed and a second request for the same pair arrives
- **THEN** the cached tracker is returned without recomputation

#### Scenario: Identical file content
- **WHEN** a file has byte-identical content at the left and right snapshots
- **THEN** a trivial SpanTracker is used that returns input spans unchanged

### Requirement: Iteration Range Selection Persistence
The system SHALL persist the user's selected iteration range per PR in `localStorage` (via Zustand persist middleware) keyed by the GitHub PR URL, retaining at most 50 PRs with LRU eviction. On PR load, cached ranges MUST be validated and discarded if (a) `fromSnapshot` or `toSnapshot` is out of bounds, (b) `fromSnapshot >= toSnapshot`, or (c) `fromSnapshot === 0` while the latest iteration's left snapshot is greater than 0 (rebase detection).

#### Scenario: Cached range invalidated by rebase
- **WHEN** the cached range has `fromSnapshot = 0` and the latest iteration's left snapshot is 2 (indicating a rebase)
- **THEN** the cached range is discarded
- **AND** the default range becomes `{ fromSnapshot: 2, toSnapshot: latestRight }`

#### Scenario: Cache eviction when full
- **WHEN** a 51st PR's range is stored
- **THEN** the least recently used PR range is evicted

### Requirement: Force-Push Resilience
The system SHALL preserve iteration history and comment anchoring across force-pushes. Comments MUST be tracked by `(artifact_id, snapshot_index)` rather than by commit SHA so they remain valid when SHAs are rewritten.

#### Scenario: Force-push amends last commit
- **WHEN** the author amends the last commit and force-pushes
- **THEN** the previous iteration's snapshots remain accessible
- **AND** comments persist via artifact ID, with span trackers recomputed from the captured `before` SHA to the new head

### Requirement: Rebase Iteration Tracking
The system SHALL create a new iteration with the post-rebase head when a PR is rebased, preserve file identity across rebase via `changeTrackingId`, and capture the new base SHA so that the new iteration's left snapshot reflects the new base content rather than the old base.

#### Scenario: PR rebased onto updated base
- **WHEN** the PR branch is rebased and pushed
- **THEN** a new iteration is created with a new `base_sha` reflecting the new base content at the left snapshot
- **AND** files modified before the rebase still resolve to the same artifact ID

### Requirement: Orphaned Comment Handling
The system SHALL mark comments as orphaned and float them to file level when the originally commented code is deleted and no nearby unchanged anchor region can be located. Comments placed across a changed region MUST be flagged with `isOfUncertainOrigin = true`.

#### Scenario: Commented code deleted with no anchor
- **WHEN** all referenced code and surrounding context are deleted in a later iteration
- **THEN** the comment is orphaned and displayed at the file level rather than at a specific line

### Requirement: Mode Selection
The system SHALL default to stateful mode when the PR contains a comment carrying the `<!-- codjiflo-data -->` marker and SHALL fall back to stateless mode otherwise. The system MUST honor the `?mode=stateless` query parameter to force stateless mode even when an artifact exists.

#### Scenario: PR has artifact pointer comment
- **WHEN** the frontend loads a PR whose comments include `<!-- codjiflo-data -->`
- **THEN** the system enters stateful mode and downloads the referenced artifact

#### Scenario: PR has no artifact pointer comment
- **WHEN** the frontend loads a PR with no `<!-- codjiflo-data -->` comment
- **THEN** the system enters stateless mode and builds iterations from GitHub APIs

#### Scenario: Forced stateless override
- **WHEN** the URL includes `?mode=stateless`
- **THEN** the system uses stateless mode regardless of any artifact pointer comment

#### Scenario: Iteration selector visible in stateless mode
- **WHEN** a PR is loaded in stateless mode with one or more iterations
- **THEN** the iteration selector is visible and lists each iteration

#### Scenario: Force-push surfaces new iteration in selector
- **WHEN** the timeline contains a `head_ref_force_pushed` event for the loaded PR
- **THEN** the iteration selector displays the new iteration produced by that force-push

### Requirement: Stateful Mode — GitHub Action Capture
The system SHALL provide a GitHub Action that, on `pull_request` events (`opened`, `synchronize`, `reopened`), downloads the previous SQLite artifact (if any), captures `head_sha`, `base_sha`, and the workflow event's `before` SHA, fetches changed file contents via the GitHub API, appends a new iteration to the SQLite database, uploads the updated database as a new artifact, and posts or updates a PR comment containing the artifact pointer.

#### Scenario: Action triggered on synchronize
- **WHEN** a contributor pushes new commits and the workflow fires `pull_request.synchronize`
- **THEN** the action appends the new iteration to the SQLite database
- **AND** uploads the database as an artifact
- **AND** updates the PR comment with the new artifact ID and `Last updated` timestamp

#### Scenario: Force-push captured via before SHA
- **WHEN** the `pull_request.synchronize` event payload includes a `before` SHA that differs from the previous head
- **THEN** the action records that `before` SHA on the new iteration row to preserve force-push history

### Requirement: Stateful Mode — PR Comment Pointer Format
The system SHALL post a PR comment beginning with `<!-- codjiflo-data -->` containing the iteration count, last-updated timestamp, artifact ID, and workflow run ID. While an upload is in progress, the artifact ID MAY be the literal string `pending`, in which case the frontend MUST fall back to stateless mode and retry on the next load.

#### Scenario: Pending artifact during workflow run
- **WHEN** the PR comment contains `**Artifact**: \`pending\``
- **THEN** the frontend falls back to stateless mode for the current load

#### Scenario: Comment updated rather than duplicated
- **WHEN** the action runs a second time on the same PR
- **THEN** the existing `<!-- codjiflo-data -->` comment is updated in place rather than a new one being posted

### Requirement: Stateful Mode — SQLite Schema and Content Deduplication
The system SHALL store iteration data in a SQLite database with tables for iterations, file artifacts, content blobs keyed by SHA-1 hash, artifact snapshots (combining path and content reference per snapshot index), comment anchors with optional character-level columns, and precomputed span trackers. Each unique file content MUST be stored exactly once in `content_blobs` and referenced by hash from `artifact_snapshots`.

#### Scenario: Identical file content reused across iterations
- **WHEN** a file's content is identical at multiple snapshots
- **THEN** the content appears once in `content_blobs` and is referenced by the same `content_hash` from each relevant `artifact_snapshots` row

#### Scenario: Deleted file representation
- **WHEN** a file does not exist at a snapshot index
- **THEN** the corresponding `artifact_snapshots` row has `file_path = NULL` and `content_hash = NULL`

### Requirement: Stateful Mode — Precomputed SpanTrackers
The system SHALL precompute and store SpanTrackers for all adjacent snapshot pairs (0→1, 2→3, 4→5, ...) and for the latest iteration's left-to-right snapshot pair (used for the "full diff" view). Cross-iteration trackers MUST be derived client-side by chaining adjacent trackers.

#### Scenario: Adjacent tracker served from artifact
- **WHEN** the frontend requests the SpanTracker for snapshots 2→3
- **THEN** it is loaded directly from `span_trackers` in the SQLite artifact without runtime computation

#### Scenario: Cross-iteration tracker chained client-side
- **WHEN** the frontend needs a SpanTracker for snapshots 0→5
- **THEN** the trackers 0→1, 2→3, and 4→5 are chained on the client

### Requirement: Stateful Mode — Character-Level Comment Anchors
The system SHALL support character-level comment precision in stateful mode by storing optional `column_start` and `column_end` fields in `comment_anchors` alongside line numbers and the source `github_comment_id`.

#### Scenario: Character-range comment
- **WHEN** a comment anchors to characters 5 through 20 of line 42
- **THEN** the anchor row stores `line_start = line_end = 42`, `column_start = 5`, `column_end = 20`

### Requirement: Stateful Mode — Artifact Download and Parsing
The system SHALL, on frontend load, fetch PR comments, locate the `<!-- codjiflo-data -->` marker, download the referenced SQLite artifact, parse it in the browser via WASM SQLite, load iterations, load precomputed SpanTrackers, and compute any non-precomputed SpanTrackers on demand by chaining.

#### Scenario: Artifact downloaded and parsed
- **WHEN** the frontend finds an artifact pointer with a numeric artifact ID
- **THEN** it downloads the artifact, opens the SQLite database in the browser, and loads iterations and precomputed trackers

#### Scenario: Artifact reference not found
- **WHEN** no `<!-- codjiflo-data -->` comment is present
- **THEN** the system falls back to stateless mode

### Requirement: Stateful Mode — Artifact Caching in IndexedDB
The system SHALL cache downloaded SQLite artifacts in the `codjiflo-artifacts` IndexedDB database keyed by `{owner}/{repo}/{prNumber}` along with the `Last updated` timestamp from the PR comment. On subsequent loads the cached artifact MUST be reused when its timestamp matches the comment and re-downloaded when the timestamp differs.

#### Scenario: Cache hit by matching timestamp
- **WHEN** the cached artifact's stored timestamp equals the PR comment's `Last updated` value
- **THEN** the cached artifact is used without re-downloading

#### Scenario: Cache miss after new iteration captured
- **WHEN** the PR comment's `Last updated` timestamp is newer than the cached value
- **THEN** the artifact is re-downloaded and the cache entry is replaced

### Requirement: Stateful Mode — GC Resilience via Stored Content
The system SHALL preserve full diff and comment functionality even after GitHub garbage-collects the original commits, by serving file content from the SQLite artifact rather than the live git history.

#### Scenario: Force-pushed commit GC'd but artifact retained
- **WHEN** an iteration's underlying commit has been garbage-collected but the SQLite artifact still contains the snapshot
- **THEN** file content, diffs, and comments for that iteration remain fully viewable

### Requirement: Stateless Mode — Commit-Based Iteration Detection
The system SHALL build iteration history from the GitHub PR Commits API supplemented by the Issues Timeline API, mapping each PR commit to one iteration whose diff is `base...commit_sha`. Force-push events MUST be detected via `head_ref_force_pushed` timeline entries and turned into collapsed iteration groups.

#### Scenario: Each commit becomes one iteration
- **WHEN** a PR has 5 commits and no force-pushes
- **THEN** the system creates 5 live iterations, one per commit, numbered sequentially

#### Scenario: Force-push produces collapsed group
- **WHEN** the timeline contains a `head_ref_force_pushed` event with `before_commit.sha` and `after_commit.sha`
- **THEN** the system creates a collapsed iteration group containing the discarded commits discovered via the Compare API

#### Scenario: Initial iteration extracted from PR opened event
- **WHEN** the loader processes a PR's `opened` event
- **THEN** iteration 1 is created with the PR's head SHA as its `after` snapshot

#### Scenario: Multiple force-pushes produce multiple iterations
- **WHEN** the timeline contains three `head_ref_force_pushed` events
- **THEN** the loader produces four iterations: the initial iteration plus one per force-push, each with the corresponding `before`/`after` SHAs

#### Scenario: Regular push without force-push event
- **WHEN** the loader processes a push that does not produce a `head_ref_force_pushed` timeline event
- **THEN** no new iteration is created from the timeline traversal

#### Scenario: Empty timeline yields initial iteration
- **WHEN** the timeline contains no events
- **THEN** the loader produces a single initial iteration for the PR's head SHA

#### Scenario: Merge-only timeline yields single iteration
- **WHEN** the timeline contains only a `merged` event and no force-push events
- **THEN** the loader produces a single iteration

#### Scenario: Loaded iterations populate the iterations store
- **WHEN** the loader processes a timeline response
- **THEN** the discovered iterations are inserted into the iterations store

### Requirement: Stateless Mode — Discarded Commit Discovery
The system SHALL discover discarded commits by calling `GET /repos/{owner}/{repo}/compare/{after}...{before}` for each force-push event. If the call returns 404 or 410, the system MUST mark the collapsed group with `unknownCount: true` and omit individual commit details.

#### Scenario: Successful discovery
- **WHEN** the Compare API returns commits unique to the pre-force-push history
- **THEN** each discarded commit is added to the collapsed group with its SHA, message, author, and date

#### Scenario: Before SHA GC'd before discovery
- **WHEN** the Compare API returns 404 or 410 for the `before` SHA
- **THEN** the collapsed group is marked `unknownCount: true` with no individual commit details and cannot be expanded

### Requirement: Stateless Mode — Iteration Ordering and ID Assignment
The system SHALL sort all live and collapsed iterations chronologically by `createdAt`, reassign sequential 1-based revision numbers after sorting, and assign each stateless iteration a deterministic ID equal to the negation of its revision (`id = -revision`) so IDs are stable across reloads and distinguishable from server-assigned stateful IDs.

#### Scenario: Iteration ID stability
- **WHEN** the same PR is loaded twice
- **THEN** each iteration receives the same negative ID on both loads

#### Scenario: Chronological ordering of out-of-order events
- **WHEN** the timeline events arrive in non-chronological order
- **THEN** the loader sorts iterations by `createdAt` before assigning sequential revision numbers

### Requirement: Stateless Mode — Collapsed Iteration UI
The system SHALL render each collapsed iteration group as a single grayed-out tab using the Lucide `Eraser` icon with a hover tooltip "N iterations discarded". Clicking the tab MUST display a history view listing each discarded iteration's number and commit message and offering an "Include discarded iterations" action that expands the group into individual grayed tabs. Expanded collapsed iterations MAY participate in iteration range diffs.

#### Scenario: Default collapsed display
- **WHEN** a collapsed group exists in stateless mode
- **THEN** it appears as a single grayed-out tab with the Eraser icon and tooltip "N iterations discarded"

#### Scenario: User expands collapsed group
- **WHEN** the user activates "Include discarded iterations"
- **THEN** the collapsed tab expands into individual grayed tabs that can be selected in range diffs using `base...discarded_commit_sha`

#### Scenario: Collapsed group skipped in default range
- **WHEN** the user selects an iteration range without expanding the collapsed group
- **THEN** the collapsed iterations are skipped during range traversal

### Requirement: Stateless Mode — Collapsed Iteration `beforeSha`
The system SHALL set the `beforeSha` field of every collapsed iteration to its force-push event's `before_commit.sha` and SHALL leave `beforeSha` null for live iterations.

#### Scenario: beforeSha set for collapsed
- **WHEN** a collapsed iteration belongs to a discovered force-push group
- **THEN** its `beforeSha` equals that event's `before_commit.sha`

### Requirement: Stateless Mode — Pagination of GitHub APIs
The system SHALL fetch all pages of the Commits and Timeline APIs using `per_page=100`, incrementing `page` until a response contains fewer than 100 items.

#### Scenario: Multi-page commits
- **WHEN** a PR has 250 commits
- **THEN** the loader issues three requests with `per_page=100` to fetch all commits before building iterations

### Requirement: Stateless Mode — Diff Computation via Compare API
The system SHALL compute diffs using GitHub's Compare API: 3-dot (`{base}...{head}`) for default PR diffs and 2-dot (`{sha1}..{sha2}`) for iteration-to-iteration comparisons. File content MUST be fetched via `GET /repos/{owner}/{repo}/contents/{path}?ref={sha}` when needed for span tracking.

#### Scenario: Default PR diff
- **WHEN** the user views the default "full diff" in stateless mode
- **THEN** the system calls `GET /compare/{base}...{head}` to obtain the diff

#### Scenario: Iteration-to-iteration diff
- **WHEN** the user selects iterations A and B for comparison
- **THEN** the system calls `GET /compare/{sha_A}..{sha_B}` to obtain the diff

### Requirement: Stateless Mode — Web Worker Diff Computation with Priority Queue
The system SHALL offload diff and SpanTracker computation to a Web Worker driven by a priority queue with four levels: 0 (user clicked file), 1 (user selected iteration range), 2 (current → latest), 3 (other on-demand). Within a priority level the secondary ordering MUST be comment count descending, then UI order ascending, then FIFO. The scheduler MUST cancel an in-progress lower-priority task when a higher-priority task arrives, returning the cancelled task to the queue at its original priority.

#### Scenario: User clicks file during background computation
- **WHEN** a low-priority background SpanTracker task is running and the user clicks a different file
- **THEN** the running task is cancelled via `AbortController` and re-queued at its original priority
- **AND** the priority-0 task for the clicked file starts immediately

#### Scenario: Tie-break by comment count
- **WHEN** two priority-1 tasks are queued
- **THEN** the file with more comments is processed first

#### Scenario: Task scheduled at specified priority
- **WHEN** a task is scheduled with High priority
- **THEN** it is inserted into the High-priority bucket of the queue

#### Scenario: Cross-priority ordering
- **WHEN** tasks at Low, High, and Medium priorities are queued together
- **THEN** they are processed in the order High, Medium, Low

#### Scenario: Tie-break by UI order
- **WHEN** three queued tasks share priority and comment count but have UI order positions 3, 1, 2
- **THEN** they are processed in the order 1, 2, 3

#### Scenario: Prioritize an already-queued task
- **WHEN** a queued task is prioritized
- **THEN** it is moved to the Highest priority bucket

#### Scenario: Prioritize cancels in-progress lower-priority task
- **WHEN** a task is running and a different task is prioritized to Highest
- **THEN** the running task is cancelled and the newly prioritized task starts

#### Scenario: Clearing the queue removes all tasks
- **WHEN** `clear()` is invoked on a queue containing pending tasks
- **THEN** every pending task is removed from the queue

#### Scenario: Cached result returned without recomputation
- **WHEN** `getResult()` is called for a task that already completed
- **THEN** the cached result is returned without scheduling new work

#### Scenario: Duplicate task identifiers deduplicated
- **WHEN** the same `taskId` is scheduled twice
- **THEN** only one instance of the task exists in the queue

#### Scenario: End-to-end diff computation via worker
- **WHEN** a diff task is scheduled and the worker fetches content via the GitHub API
- **THEN** the worker returns a diff result that the scheduler delivers to the caller

#### Scenario: Higher-priority task preempts running lower-priority task
- **WHEN** a Low-priority diff task is running and a High-priority task is scheduled
- **THEN** the High-priority task completes before the Low-priority task

#### Scenario: Multiple files processed in priority order
- **WHEN** five files are scheduled across mixed priorities
- **THEN** all five complete in strict priority order, with ties broken by comment count and UI order

### Requirement: Stateless Mode — Background SpanTracker Precomputation
The system SHALL, after the selected file's diff completes, identify files containing comments via the GitHub PR review comments API and enqueue Low-priority SpanTracker computation tasks for each such file. Results MUST be cached in memory keyed by `${filePath}:${leftSha}:${rightSha}` for the session and MUST NOT be persisted to IndexedDB.

#### Scenario: Comments-containing files precomputed
- **WHEN** the selected file's diff finishes computing in stateless mode
- **THEN** the scheduler enqueues Low-priority SpanTracker tasks for every other file that contains review comments

#### Scenario: In-session cache hit
- **WHEN** a SpanTracker for `${filePath}:${leftSha}:${rightSha}` already exists in the memory cache
- **THEN** the cached value is returned without recomputation

#### Scenario: Background SpanTracker runs after diff completes
- **WHEN** a selected file's diff completes and another file containing a review comment exists
- **THEN** a Low-priority SpanTracker task is scheduled in the background for that file

### Requirement: Stateless Mode — Cross-Iteration SpanTracker Chaining
The system SHALL compute non-adjacent SpanTrackers in stateless mode by chaining adjacent trackers in sequence (e.g., 1→3 derived as 1→2 then 2→3).

#### Scenario: Three-iteration chain
- **WHEN** the user views a comment created at iteration 1 on iteration 3
- **THEN** the system chains tracker 1→2 with tracker 2→3 to compute the display position

### Requirement: Stateless Mode — Unavailable Iteration Detection
The system SHALL treat any 404 or 410 response when fetching commit content or computing diffs as evidence that the iteration is unavailable (reason `gc` or `deleted`). Unavailable status MUST be persisted to IndexedDB under `${owner}/${repo}/${prNumber}/${revision}` to avoid repeated API calls.

#### Scenario: Commit GC detected on content fetch
- **WHEN** the contents API returns 404 for an iteration's commit SHA
- **THEN** the iteration is marked `status: 'unavailable'` with `reason: 'gc'` and the status is written to IndexedDB

#### Scenario: Unavailable iteration in selector
- **WHEN** an iteration has been marked unavailable
- **THEN** the iteration selector displays an "Unavailable" badge, disables selection, and shows the tooltip "This iteration's commit data is no longer available on GitHub" with a link to the Stateful Mode documentation

#### Scenario: Unavailable badge shown when content API returns 404
- **WHEN** the contents API returns 404 for an iteration's commit SHA
- **THEN** the iteration selector displays an "Unavailable" badge for that iteration

#### Scenario: Cannot select unavailable iteration
- **WHEN** the user attempts to click an iteration tagged as unavailable
- **THEN** the selection is rejected and the iteration remains non-active

### Requirement: Stateless Mode — IndexedDB Persistence of Discovered State
The system SHALL persist three stores in the `codjiflo-stateless` IndexedDB database: `lastSeen` (last seen iteration per PR), `discoveredIterations` (immutable iteration records), and `unavailable` (iterations known to be GC'd or deleted). These stores MUST be keyed by `${owner}/${repo}/${prNumber}` (or that key plus `/${revision}` for per-iteration entries).

#### Scenario: Returning user default range
- **WHEN** a returning user opens a PR with a `lastSeen` entry
- **THEN** the default iteration range is "last seen → latest"

#### Scenario: First visit default range
- **WHEN** a user opens a PR for the first time with no `lastSeen` entry
- **THEN** the default iteration range is "base → latest"

#### Scenario: Persist last seen iteration
- **WHEN** `setLastSeen()` is called for a PR
- **THEN** the value is persisted to the `lastSeen` IndexedDB store

#### Scenario: Retrieve last seen iteration
- **WHEN** `getLastSeen()` is called for a previously persisted PR
- **THEN** the stored value is returned

#### Scenario: Persist discovered iteration
- **WHEN** `addDiscoveredIteration()` is called for a new revision
- **THEN** the iteration is persisted to the `discoveredIterations` store

#### Scenario: Discovered iteration immutability
- **WHEN** `addDiscoveredIteration()` is called twice with the same revision number
- **THEN** the first stored value is preserved and the second call does not overwrite it

#### Scenario: Persist unavailable iteration
- **WHEN** `markUnavailable()` is called for an iteration
- **THEN** the unavailable status is persisted to the `unavailable` store

#### Scenario: Retrieve unavailable iterations
- **WHEN** `getUnavailable()` is called for a PR
- **THEN** all unavailable iterations for that PR are returned

#### Scenario: IndexedDB unavailable (private browsing)
- **WHEN** IndexedDB is unavailable (e.g., private browsing mode)
- **THEN** the storage layer falls back gracefully without crashing the application

#### Scenario: Merging persisted and freshly fetched iterations
- **WHEN** IndexedDB contains 2 discovered iterations and the API returns 3 iterations
- **THEN** the store is populated with the union (3 iterations) deduplicated by revision

#### Scenario: Default range derived from last seen
- **WHEN** IndexedDB has `lastSeen = 2` and the API returns 4 iterations
- **THEN** the default iteration range is `2 → 4`

### Requirement: Stateless Mode — Progressive UI Rendering
The system SHALL render the file list immediately upon iteration discovery in stateless mode, before per-file diffs have been computed, and SHALL display a "Computing diff..." loading state for files whose diff has not yet been produced by the Web Worker.

#### Scenario: File selected before diff is ready
- **WHEN** the user clicks a file whose diff has not yet been computed
- **THEN** a "Computing diff..." loading state is shown until the worker delivers the result

#### Scenario: File list appears before diffs are ready
- **WHEN** a PR loads in stateless mode
- **THEN** the file list is visible before any per-file diff has been computed

#### Scenario: Diff appears after worker completes
- **WHEN** the Web Worker finishes computing a selected file's diff
- **THEN** the diff lines become visible and replace the loading state

#### Scenario: useDiffSource schedules and returns result in stateless mode
- **WHEN** `useDiffSource` is invoked in stateless mode for a selected file
- **THEN** a diff task is scheduled and the eventual result is returned to the caller

#### Scenario: useDiffSource returns cached result immediately
- **WHEN** `useDiffSource` is invoked for a file whose diff is already cached
- **THEN** the cached result is returned without scheduling new work

#### Scenario: Selected file diff completes before background tasks
- **WHEN** the user selects a file while other files are queued in the background
- **THEN** the selected file's diff is delivered first

### Requirement: Stateful-to-Stateless Fallback
The system SHALL automatically fall back to stateless mode when the artifact pointer comment is missing, when the artifact ID is `pending`, or when the artifact download fails.

#### Scenario: Pending artifact triggers fallback
- **WHEN** the PR comment shows `**Artifact**: \`pending\``
- **THEN** the frontend operates in stateless mode for the current page load and retries on the next load

#### Scenario: Artifact download error
- **WHEN** the artifact download fails (e.g., expired, unauthorized, network error)
- **THEN** the frontend falls back to stateless mode and surfaces a user-visible notice

### Requirement: Artifact Retention Window
The system SHALL accept GitHub's default 90-day artifact retention for stateful mode and SHALL fall back to stateless mode for any iteration whose artifact has expired.

#### Scenario: Artifact expired after 90 days
- **WHEN** the artifact referenced by the PR comment is no longer available because retention has elapsed
- **THEN** the frontend falls back to stateless mode and displays the available iterations from GitHub APIs

### Requirement: Stateless Mode — Diff Worker Computation Outputs
The Web Worker that computes diffs in stateless mode SHALL emit line-level diff results (additions, deletions, unchanged context), word-level changes for modified line pairs, and side-by-side alignment data derived from the line diff. The worker MUST honor cancellation, surface fetch failures, and distinguish unavailable content from generic errors.

#### Scenario: Line-level diff produced from two file contents
- **WHEN** the worker is invoked with two file contents
- **THEN** it returns a `diffLines` result containing additions, deletions, and unchanged context

#### Scenario: Word-level diff for modified line pair
- **WHEN** the worker computes the diff of a modified line pair
- **THEN** the result includes word-level change spans

#### Scenario: Alignment data for side-by-side rendering
- **WHEN** the worker computes a line diff
- **THEN** it also returns aligned line pairs suitable for side-by-side display

#### Scenario: Worker honors cancellation
- **WHEN** the worker's `AbortController` is aborted while a task is in flight
- **THEN** the task resolves with `status: 'cancelled'`

#### Scenario: Worker surfaces fetch error
- **WHEN** the content API returns a 500 response while the worker is fetching file content
- **THEN** the task resolves with `status: 'error'` and an error message

#### Scenario: Worker reports unavailable for GC'd commit
- **WHEN** the content API returns 404 or 410 for an iteration's commit SHA
- **THEN** the task resolves with `status: 'unavailable'`

#### Scenario: Empty file diff treats all lines as additions
- **WHEN** the worker compares an empty file to a non-empty file
- **THEN** every line in the right file is reported as an addition

#### Scenario: Binary file detection
- **WHEN** the worker is asked to diff binary content
- **THEN** the task resolves with `status: 'error'` and `reason: 'binary'`

### Requirement: Stateless Mode — UI Terminology
The user-facing UI SHALL refer to the no-artifact mode as "stateless mode" and MUST NOT display the term "degraded" anywhere in copy, labels, tooltips, or messages. No banner SHALL be shown in stateless mode merely to indicate the absence of an artifact.

#### Scenario: Stateless terminology used in UI
- **WHEN** the user views any UI surface in stateless mode
- **THEN** the term "stateless" is used and the term "degraded" does not appear

#### Scenario: No stateless-mode banner
- **WHEN** a PR is loaded in stateless mode
- **THEN** no banner is displayed announcing the absence of an artifact

### Requirement: Stateless Mode — Renamed File Handling
The file list and diff view SHALL render renamed files with a distinct "R" status badge (not "A" for added) and SHALL display a usable diff page for both pure renames (no content changes) and rename-plus-edit cases. A pure rename MUST NOT produce a "No diff available" empty state.

#### Scenario: Renamed file shows R badge
- **WHEN** the file list contains a renamed file
- **THEN** the file's status badge reads "R" rather than "A"

#### Scenario: Pure rename renders diff page
- **WHEN** the user opens a renamed file whose content is unchanged
- **THEN** the diff page renders with toolbar and header visible and does NOT show a "No diff available" empty state

#### Scenario: Renamed and edited file renders diff with changes
- **WHEN** the user opens a renamed file whose content has also been edited
- **THEN** the diff page renders the CodeMirror editor showing the line-level changes

### Requirement: Stateless Mode — Accessibility
Stateless-mode UI elements that change state asynchronously SHALL be accessible to assistive technologies. Loading states, unavailable iteration status, and the iteration selector MUST surface their meaning through screen-reader announcements and full keyboard navigation.

#### Scenario: Loading state announced to screen readers
- **WHEN** a diff is being computed and the loading state is visible
- **THEN** a screen reader announces "Computing diff"

#### Scenario: Unavailable iteration status announced
- **WHEN** an iteration's selector entry has been marked unavailable
- **THEN** a screen reader announces the unavailable status

#### Scenario: Iteration selector keyboard navigation
- **WHEN** the user navigates the iteration selector via keyboard
- **THEN** Tab moves focus between iterations and Enter activates the focused iteration

