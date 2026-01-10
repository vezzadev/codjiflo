# Azure DevOps PR Test Matrix

This document defines the comprehensive test dataset for validating CodjiFlo's Azure DevOps integration. Tests are organized across 13 PRs in the `pedropaulovc/BasicAppServiceRecommender` repository.

## Test Repository

- **Organization**: `pedropaulovc`
- **Project**: `BasicAppServiceRecommender`
- **Repo**: `BasicAppServiceRecommender`
- **URL**: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender

---

## PR #2: Comment Positioning

**Branch**: `test/comment-positioning`
**Focus**: Line-level and character-level comment positions

| ID | Test Case | Thread Context | Expected Behavior | User Story |
|----|-----------|----------------|-------------------|------------|
| CP-01 | Single-line comment on added line | `rightFileStart: {line: 5, offset: 1}` | Comment appears on right side of diff | S-2.1 |
| CP-02 | Single-line comment on deleted line | `leftFileStart: {line: 4, offset: 1}` | Comment appears on left side of diff | S-2.1 |
| CP-03 | Comment on context line (unchanged) | Both `leftFileStart` and `rightFileStart` | Comment visible in both diff views | S-2.1 |
| CP-04 | Character-level comment | `rightFileStart: {line: 3, offset: 47}, rightFileEnd: {line: 3, offset: 73}` | Highlight specific characters (ABCDEF...) | S-5.1 |
| CP-05 | Multi-line range comment | `rightFileStart: {line: 6, offset: 1}, rightFileEnd: {line: 8, offset: 45}` | Comment spans lines 6-8 | S-5.1 |
| CP-06 | Comment spanning partial characters across 2 lines | `rightFileStart: {line: 9, offset: 30}, rightFileEnd: {line: 10, offset: 15}` | Cross-line character selection | S-5.1 |

---

## PR #3: Comment Threading & States

**Branch**: `test/comment-threading`
**Focus**: Thread status transitions and reply chains

| ID | Test Case | Status | Notes | User Story |
|----|-----------|--------|-------|------------|
| CT-01 | Active thread | `status: 1` | Default open state | S-2.1 |
| CT-02 | Resolved/Fixed thread | `status: 2` | Reviewer marked as resolved | S-2.5 |
| CT-03 | Won't Fix thread | `status: 3` | Acknowledged but won't change | |
| CT-04 | Closed thread | `status: 4` | Discussion ended | |
| CT-05 | By Design thread | `status: 5` | Intentional behavior | |
| CT-06 | Pending thread | `status: 6` | Awaiting response | |
| CT-07 | 3-level deep reply chain | Root → Reply 1 → Reply 2 | Uses `parentCommentId` | S-2.3 |
| CT-08 | Multiple parallel threads on same line | 2 threads at line 10 | Different thread IDs | S-2.1 |

### Reply Chain Structure (CT-07)

```
Thread 18:
├── Comment 1 (root): "[CT-07] ROOT COMMENT"
│   ├── Comment 2 (reply): "[CT-07] LEVEL 2 REPLY"
│   │   └── Comment 3 (reply to reply): "[CT-07] LEVEL 3 REPLY"
```

---

## PR #4: File Operations

**Branch**: `test/file-operations`
**Focus**: Comments on added/deleted/renamed files

| ID | Test Case | File State | Thread Context | User Story |
|----|-----------|------------|----------------|------------|
| FO-01 | Comment on newly added file | `new-file.txt` added | `rightFileStart` only (no left) | S-2.1 |
| FO-02 | Comment on deleted file | `file-to-delete.txt` removed | `leftFileStart` only (no right) | S-2.1 |
| FO-03 | Comment on renamed file | `old-name.txt` → `new-name.txt` | Track via `changeTrackingId` | S-4.8 |
| FO-04 | Comment on binary file change | `test-image.png` modified | File-level comment (no line) | |
| FO-05 | Comment on file moved to directory | `file-to-move.txt` → `subdir/file-to-move.txt` | Track as rename | S-4.8 |

---

## PR #5: Iteration Tracking & Cross-Iteration Diffs

**Branch**: `test/iteration-tracking`
**Focus**: Comments across multiple iterations with varying file deltas

### File State Matrix

| File | Iteration 1 | Iteration 2 | Iteration 3 (force-push) | Iteration 4 |
|------|-------------|-------------|--------------------------|-------------|
| fileA.txt | Modified | - | Unchanged | Unchanged |
| fileB.txt | - | Added (comment) | Deleted | - |
| fileC.txt | Unchanged | Unchanged | Modified | Unchanged |
| fileD.txt | - | - | Added | Modified |
| fileE.txt | Unchanged (comment) | Unchanged | **DELETED** (orphan) | - |
| fileF.txt | Unchanged | Modified | Unchanged | Unchanged |

**Note on fileF.txt**: This file exists in the PR base but is NOT modified until iteration 2. Tests IT-11 through IT-13 validate that iteration-aware file status correctly shows "Modified" (not "Added") when the artifact only starts at the iteration where the file was first changed.

### Test Cases

| ID | Test Case | Iterations | Expected Behavior | User Story |
|----|-----------|------------|-------------------|------------|
| IT-01 | Comment on iteration 1, unchanged in 2 | 1 → 2 | Comment position preserved | S-4.9, S-5.4 |
| IT-02 | Comment on iteration 1, modified in 2 | 1 → 2 | Comment follows code movement | S-4.9, S-5.4 |
| IT-03 | Comment on iteration 1, code deleted in 2 | 1 → 2 | Comment shows on deleted line | S-4.9, S-5.4 |
| IT-04 | Comment on file deleted in later iteration | 1 → 3 | Comment orphaned, file gone | S-4.9, S-5.4 |
| IT-05 | Force-push: comment survives SHA change | 2 → 3 | Comment persists via iteration ID | S-4.2 |
| IT-06 | Compare iteration 1 vs iteration 3 | 1 → 3 | Skip iteration 2 in comparison | S-4.8 |
| IT-07 | Force-push deletes file with comment | 2 → 3 on fileE | Orphaned comment on deleted file | S-4.9 |
| IT-08 | Diff 1→2 file delta | 1 → 2 | A=modified, B=added, C=unchanged, F=modified | S-4.8 |
| IT-09 | Diff 2→3 file delta | 2 → 3 | A=unchanged, B=deleted, C=modified, D=added, E=deleted, F=unchanged | S-4.8 |
| IT-10 | Diff 1→3 cumulative delta | 1 → 3 | A=modified, B=no-op, C=modified, D=added, E=deleted, F=modified | S-4.8 |
| IT-11 | Late-modified file status (base→iter2) | base → 2 | F=**Modified** (not Added), base equivalence applies | S-4.8, AC-4.8.14 |
| IT-12 | Late-modified file hidden in earlier iteration | base → 1 | F=**not shown** (no changes in iteration 1) | S-4.8, AC-4.8.11 |
| IT-13 | Drag selection iter1→iter2 status | 1 → 2 | F=**Modified** (not Added), base equivalence for non-zero snapshots | S-4.8, AC-4.8.14 |

### Iteration Context API

```json
{
  "pullRequestThreadContext": {
    "changeTrackingId": 1,
    "iterationContext": {
      "firstComparingIteration": 1,
      "secondComparingIteration": 3
    }
  }
}
```

---

## PR #6: Code Suggestions

**Branch**: `test/code-suggestions`
**Focus**: Suggested changes via markdown syntax

| ID | Test Case | Content Format | Expected | User Story |
|----|-----------|----------------|----------|------------|
| CS-01 | Single-line suggestion | ` ```suggestion\ntotal += items[i].price;\n``` ` | "Apply change" button appears | |
| CS-02 | Multi-line suggestion | ` ```suggestion\nfunction validateInput(input) {\n    return input != null && input !== "";\n}\n``` ` | Multi-line replacement | |
| CS-03 | Suggestion to improve function | Suggest using Intl.NumberFormat | Better currency formatting | |
| CS-04 | Applied suggestion | `commentType: 2` (codeChange) | Shows as system comment | |

### Suggestion Markdown Format

    I suggest changing this to:
    ```suggestion
    const result = calculateValue(input);
    return result;
    ```
    This would improve readability.

---

## PR #7: Top-Level Comments (PR-Level)

**Branch**: `test/top-level-comments`
**Focus**: Comments without file context (general PR discussion)

| ID | Test Case | Content | Thread Context | User Story |
|----|-----------|---------|----------------|------------|
| TL-01 | Top-level comment - Active | "General feedback on PR" | None (omit `threadContext`) | |
| TL-02 | Top-level comment - Resolved | "Addressed in latest push" | None, `status: 2` | S-2.5 |
| TL-03 | Top-level reply thread | Root + 3 replies | Uses `parentCommentId` | S-2.3 |
| TL-04 | Markdown formatting | Headers, lists, code blocks | Renders properly | S-2.1 |
| TL-05 | @mention | "@pedropaulovc please review" | User notification | |
| TL-06 | Linked work item | "Fixes AB#1" | Work item integration | |

### API Request (No threadContext)

```json
{
  "comments": [{
    "parentCommentId": 0,
    "content": "This PR looks good overall. A few minor suggestions below.",
    "commentType": 1
  }],
  "status": 1
}
```

---

## PR #8: PR State Transitions

**Branch**: `test/pr-states`
**Focus**: PR lifecycle states and their effect on comments

| ID | Test Case | PR Status | Commands | Expected | User Story |
|----|-----------|-----------|----------|----------|------------|
| PS-01 | Active PR with comments | `active` | Default state | Full interactivity | |
| PS-02 | Abandoned PR | `abandoned` | `az repos pr update --status abandoned` | Comments still accessible | |
| PS-03 | Abandoned → Reactivated | `active` | `az repos pr update --status active` | Comments editable again | |

**Note**: PR #8 was abandoned then reactivated to test PS-02 and PS-03.

---

## PR #9: Draft PR

**Branch**: `test/draft-pr`
**Focus**: Draft PR state with comments

| ID | Test Case | Setup | Expected | User Story |
|----|-----------|-------|----------|------------|
| PS-05 | Draft PR with comments | `isDraft: true` | Comments allowed on draft | |

---

## PR #10: Edge Cases

**Branch**: `test/edge-cases`
**Focus**: Unusual but valid scenarios

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| EC-01 | Comment on empty file | `empty-file.txt` (0 bytes) | File-level comment, no line | |
| EC-02 | Comment on whitespace-only changes | `whitespace-test.txt` with trailing spaces/tabs | Comment on whitespace diff works | |
| EC-03 | Very long line (1000+ chars) | `long-line.txt` with 1000 X chars | Offset 500-550 works | |
| EC-04 | Unicode/emoji content | Comment: "🎉 修正済み Привет مرحبا" | UTF-8 rendering correct | S-2.1 |
| EC-05 | First character of file | `line: 1, offset: 0` | Boundary case works | S-2.1 |

---

## PR #11: Cross-Line-Type Comments

**Branch**: `test/cross-line-type`
**Focus**: Comments spanning different line types (added/unchanged/removed)

| ID | Test Case | Span | Expected Behavior | User Story |
|----|-----------|------|-------------------|------------|
| CLT-01 | Unchanged → Deleted | `leftFileStart` line 1 → line 2 | Comment spans context to deletion | S-5.1 |
| CLT-02 | Unchanged → Added | `rightFileStart` line 2 → line 3 | Comment spans context to addition | S-5.1 |
| CLT-03 | Added → Unchanged | `rightFileStart` line 4 → line 5 | Comment spans addition to context | S-5.1 |

### Diff Structure

```diff
 Line 1: unchanged (context)
-Line 2: deleted
-Line 3: deleted
 Line 4: unchanged (context)
+NEW LINE A: added
+NEW LINE B: added
 Line 5: unchanged (context)
+NEW LINE C: added
```

---

## PR #13: Comment Interactions

**Branch**: `test/comment-interactions`
**Focus**: Comment lifecycle operations

| ID | Test Case | Action | Expected | User Story |
|----|-----------|--------|----------|------------|
| CI-01 | Edited comment | PATCH to update content | `lastContentUpdatedDate` differs from `publishedDate` | S-2.4 |
| CI-02 | Deleted comment | DELETE comment | Comment removed from thread | S-2.4 |
| CI-03 | Comment for likes | Placeholder for Like API | Manual like via UI | S-5.5 |

### Edit Comment API

```bash
az rest --method patch \
  --uri ".../pullRequests/{prId}/threads/{threadId}/comments/{commentId}?api-version=7.1" \
  --body '{"content": "Updated content"}'
```

---

## PR #14: File Add then Edit+Rename

**Branch**: `test/add-rename-v2`
**Focus**: Comment tracking across file rename with content changes

| Iteration | Action | File State |
|-----------|--------|------------|
| 1 | Add file | `original-name.txt` created with comment on line 3 |
| 2 | Edit + Rename | Content modified, renamed to `renamed-file.txt` |

| ID | Test Case | Expected Behavior | User Story |
|----|-----------|-------------------|------------|
| FAR-01 | Comment on iteration 1 tracks to renamed file | Comment follows changeTrackingId to new filename | S-4.9 |

---

## Azure DevOps API Reference

### Thread Status Values

| Numeric | Name | Description |
|---------|------|-------------|
| 1 | Active | Open discussion |
| 2 | Fixed | Resolved by author |
| 3 | WontFix | Acknowledged, won't change |
| 4 | Closed | Discussion ended |
| 5 | ByDesign | Intentional behavior |
| 6 | Pending | Awaiting response |

### Comment Types

| Numeric | Name | Use Case |
|---------|------|----------|
| 1 | Text | Regular user comment |
| 2 | CodeChange | Applied suggestion |
| 3 | System | System-generated message |

### Position Fields

```typescript
interface CommentPosition {
  line: number;   // 1-indexed line number
  offset: number; // 1-indexed character position (1 = first character)
}

interface ThreadContext {
  filePath: string;
  leftFileStart?: CommentPosition;  // OLD file (deletions)
  leftFileEnd?: CommentPosition;
  rightFileStart?: CommentPosition; // NEW file (additions)
  rightFileEnd?: CommentPosition;
}
```

---

## PR #15: Multi-Commit Push

**Branch**: `test/multi-commit-push`
**Focus**: Multiple commits pushed in a single push operation

### Iteration Structure

| Iteration | Commits | Files Changed |
|-----------|---------|---------------|
| 1 | Commits 1-4 (pushed together) | `multi-commit-file.txt` created, `second-file.txt` added |
| 2 | Commits 5-7 (pushed together) | Both files extended |

| ID | Test Case | Iteration | Expected Behavior | User Story |
|----|-----------|-----------|-------------------|------------|
| MC-01 | Comment on line from first commit | 1 | Line 6 from Commit 1 | S-4.2 |
| MC-02 | Comment on line from last file (Commit 4) | 1 | `second-file.txt` line 5 | S-4.2 |
| MC-03 | Comment on iteration 2 content | 2 | Line added in Commits 5-7 | S-4.7 |

---

## PR #16: Completed (Merged) PR

**Branch**: `test/completed-pr` (merged to main)
**Focus**: Comments on completed/merged PRs

| ID | Test Case | Setup | Expected | User Story |
|----|-----------|-------|----------|------------|
| PS-04 | Completed (merged) PR | PR completed then comment added | Comments can be added to merged PRs (positive test) | |

---

## PR #17: Scale - Many Files

**Branch**: `test/scale-many-files`
**Focus**: PR with large number of changed files

### File Distribution

| Category | File Count | Purpose |
|----------|------------|---------|
| Source files | 150 | `.ts`, `.tsx` files across directories |
| Config files | 20 | Various config formats |
| Test files | 80 | Corresponding test files |
| Documentation | 10 | Markdown files |

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| MF-01 | Load PR with 260 files | All files in single iteration | File list loads without timeout | S-4.8 |
| MF-02 | File list pagination | Scroll through full list | Virtualized rendering, smooth scroll | S-4.8 |
| MF-03 | Comment on file 200+ | Add comment deep in file list | Comment persists, file navigable | S-2.1 |
| MF-04 | Cross-iteration with many files | Compare iteration 1 → 2 | Delta computed correctly for all files | S-4.8 |
| MF-05 | Search within many files | Filter file list by name | Instant filtering, no lag | S-4.8 |

---

## PR #18: Scale - Large Code Changes

**Branch**: `test/scale-large-changes`
**Focus**: PR with extensive line modifications

### Change Volume

| Metric | Value |
|--------|-------|
| Total lines added | ~15,000 |
| Total lines removed | ~8,000 |
| Net change | +7,000 lines |
| Files modified | 25 |

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| LC-01 | Load PR with 23K line changes | Single large iteration | Diff computes without browser freeze | S-4.8 |
| LC-02 | Navigate large diff file | File with 5000+ line changes | Smooth scrolling, responsive UI | S-4.8 |
| LC-03 | Word-level diff on large file | 2000 line file with many edits | Word highlighting renders correctly | S-4.8 |
| LC-04 | Comment on line 3000+ | Deep in large file | Comment positions correctly | S-2.1 |
| LC-05 | Minimap accuracy | Large file overview | Minimap reflects actual diff regions | S-4.8 |

---

## PR #19: Scale - Very Large Files

**Branch**: `test/scale-large-files`
**Focus**: PR containing individual files exceeding normal size thresholds

### File Sizes

| File | Size | Purpose |
|------|------|---------|
| `large-data.json` | 5 MB | Large JSON data file |
| `huge-log.txt` | 15 MB | Log file (line-level diff only) |
| `generated-code.ts` | 2 MB | Generated TypeScript |
| `binary-asset.dat` | 50 MB | Binary file (no diff) |

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| LF-01 | Load 5 MB JSON file | Modified JSON file | Line-level diff, may skip word highlighting | S-4.8 |
| LF-02 | Load 15 MB text file | Modified log file | "Large file" warning, truncated view option | S-4.8 |
| LF-03 | Comment on large file | Comment on 5 MB file | Comment persists, line tracking works | S-2.1 |
| LF-04 | Binary file display | 50 MB binary changed | Metadata shown, no content diff | S-4.8 |
| LF-05 | Memory usage stable | Navigate between large files | No memory leak, GC works | S-4.8 |

---

## PR #20: Merge Commit (2 Parents)

**Branch**: `test/merge-commit`
**Focus**: PR with merge commits from integrating main branch

### Git History

```
main:   A - B - C - D (main advanced)
branch: A - B - X - Y - M (M is merge of D into branch)
                      ↑
               Merge commit (2 parents: Y and D)
```

### Iteration Structure

| Iteration | Action | Head Commit |
|-----------|--------|-------------|
| 1 | Initial PR (X, Y) | Y |
| 2 | Merge main into branch | M (merge commit) |

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| MC2-01 | Load PR with merge commit | Iteration 2 is merge | File list shows correct changes | S-4.2 |
| MC2-02 | Diff iteration 1 → 2 (across merge) | Compare pre/post merge | Changes from main visible in delta | S-4.8 |
| MC2-03 | Comment survives merge | Comment on iter 1, view iter 2 | Comment tracks to post-merge position | S-4.9 |
| MC2-04 | Conflict resolution visibility | File with merge conflict resolved | Shows resolved content, not conflict markers | S-4.8 |
| MC2-05 | Parent commit metadata | View merge commit details | Shows both parent SHAs | S-4.2 |

---

## PR #21: Octopus Merge (3+ Parents)

**Branch**: `test/octopus-merge`
**Focus**: PR with merge commit having more than 2 parents

### Git History

```
feature-a: A - B - X
feature-b: A - B - Y
feature-c: A - B - Z
branch:    A - B - M (octopus merge of X, Y, Z)
                  ↑
           Merge commit (3 parents)
```

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| OM-01 | Load octopus merge PR | 3-parent merge commit | PR loads without error | S-4.2 |
| OM-02 | File list from octopus | Changes from all 3 branches | Union of all changes shown | S-4.8 |
| OM-03 | Comment on merged content | Comment on code from feature-b | Comment persists and displays | S-2.1 |
| OM-04 | Iteration comparison | Base → octopus merge | Cumulative diff correct | S-4.8 |

---

## PR #22: Multiple Merges

**Branch**: `test/multiple-merges`
**Focus**: PR with multiple merge commits in history

### Git History

```
main:   A - B - C - D - E - F
branch: A - B - X - M1 - Y - M2 - Z - M3
                 ↑       ↑       ↑
            Merge C  Merge E  Merge F
```

### Iteration Structure

| Iteration | Action | Merges Included |
|-----------|--------|-----------------|
| 1 | Initial (X) | None |
| 2 | First merge | M1 (includes C) |
| 3 | More work + merge | M2 (includes E) |
| 4 | Final merge | M3 (includes F) |

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| MM-01 | Load PR with 3 merges | 4 iterations, 3 merges | All iterations accessible | S-4.2 |
| MM-02 | Diff across multiple merges | Iteration 1 → 4 | Cumulative changes correct | S-4.8 |
| MM-03 | Comment tracking through merges | Comment on iter 1, view iter 4 | Comment follows code through merges | S-4.9 |
| MM-04 | Per-iteration merge visibility | View each iteration separately | Each shows appropriate merge delta | S-4.8 |
| MM-05 | File added via merge | File from main appears in merge | Correct "added" status in iteration | S-4.8 |

---

## PR #23: Rebase Operation

**Branch**: `test/rebase-operation`
**Focus**: PR where branch is rebased onto updated main

### Git History

```
Before rebase (iteration 1-2):
  main:   A - B
  branch: A - B - C - D

After rebase (iteration 3):
  main:   A - B - E - F (main advanced)
  branch: A - B - E - F - C' - D' (rebased, new SHAs)
```

### Iteration Structure

| Iteration | Head SHA | Before SHA | Notes |
|-----------|----------|------------|-------|
| 1 | C | - | Initial commit |
| 2 | D | C | Added more changes |
| 3 | D' | D | Rebase (D' ≠ D, different SHA) |

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| RB-01 | Rebase creates new iteration | Force push after rebase | New iteration with D' as head | S-4.2 |
| RB-02 | `before_sha` captured | Check iteration 3 metadata | `before_sha = D` (pre-rebase) | S-4.2 |
| RB-03 | Comment survives rebase | Comment on C, view after rebase | Comment visible on C' | S-4.9 |
| RB-04 | Diff 2 → 3 (across rebase) | Compare pre/post rebase | Shows delta from rebase (E, F integrated) | S-4.8 |
| RB-05 | Content unchanged tracking | File unchanged by rebase | No spurious changes shown | S-4.8 |
| RB-06 | Line shift from rebase | New lines from E, F shift positions | Comments re-anchor correctly | S-4.9, S-5.4 |

---

## PR #24: Force Push Scenarios

**Branch**: `test/force-push-scenarios`
**Focus**: Various force push types and their effects

### Force Push Types Tested

| Iteration | Force Push Type | Git Command |
|-----------|-----------------|-------------|
| 1 → 2 | Amend last commit | `git commit --amend` |
| 2 → 3 | Interactive rebase (squash) | `git rebase -i` |
| 3 → 4 | Reset and recommit | `git reset --soft HEAD~2 && git commit` |

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| FP-01 | Amend commit | Iteration 2 is amended iter 1 | Comment persists via artifact tracking | S-4.2, S-4.9 |
| FP-02 | Squash via rebase | Iter 3 squashes commits from iter 2 | Comments on squashed commits re-anchor | S-4.9 |
| FP-03 | Reset and recommit | Iter 4 resets iter 3 history | Previous content preserved in artifact | S-4.2 |
| FP-04 | Before SHA accuracy | All iterations | Each `before_sha` matches pre-force-push HEAD | S-4.2 |
| FP-05 | Orphaned comment handling | Comment on deleted code via force push | Comment marked as orphaned, still viewable | S-4.9 |
| FP-06 | Iteration continuity | View all 4 iterations | All iterations accessible despite SHA changes | S-4.2 |

---

## PR #25: Many Iterations

**Branch**: `test/many-iterations`
**Focus**: PR with large number of iterations

### Iteration Count

| Phase | Iterations | Notes |
|-------|------------|-------|
| Initial development | 1-20 | Regular commits |
| Review feedback | 21-35 | Addressing comments |
| Force pushes | 36-45 | Rebases, amends |
| Final polish | 46-60 | Minor fixes |

**Total: 60 iterations**

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| MI-01 | Load PR with 60 iterations | Full iteration history | PR loads, iteration selector works | S-4.2 |
| MI-02 | Iteration selector UI | 60 items in dropdown | Grouped/paginated display, not overwhelming | S-4.8 |
| MI-03 | Compare iteration 1 → 60 | Full range comparison | Diff computes (may take time) | S-4.8 |
| MI-04 | Comment on iteration 30 | Mid-history comment | Comment trackable forward to 60 | S-4.9 |
| MI-05 | Iteration search/filter | Find specific iteration | Quick lookup by number or date | S-4.8 |
| MI-06 | SpanTracker chain performance | Track comment 1 → 60 | Completes within reasonable time | S-4.9 |

---

## PR #26: Git LFS Files

**Branch**: `test/git-lfs`
**Focus**: PR with Git Large File Storage tracked files

### LFS Configuration

```
# .gitattributes
*.psd filter=lfs diff=lfs merge=lfs -text
*.zip filter=lfs diff=lfs merge=lfs -text
*.bin filter=lfs diff=lfs merge=lfs -text
models/*.onnx filter=lfs diff=lfs merge=lfs -text
```

### LFS Files in PR

| File | Size | Type |
|------|------|------|
| `assets/design.psd` | 25 MB | Photoshop (binary) |
| `data/archive.zip` | 100 MB | Archive |
| `models/model.onnx` | 50 MB | ML model |
| `resources/large-text.bin` | 10 MB | Binary but text-like |

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| LFS-01 | Load PR with LFS files | LFS pointers in tree | LFS files identified, metadata shown | S-4.8 |
| LFS-02 | LFS file diff display | Modified LFS file | Shows "LFS file changed", size delta | S-4.8 |
| LFS-03 | LFS pointer vs content | View LFS file | Shows actual content (not pointer) if fetchable | S-4.8 |
| LFS-04 | Comment on LFS file | File-level comment | Comment persists on LFS-tracked file | S-2.1 |
| LFS-05 | Mixed LFS and regular files | PR with both types | Regular files diff normally, LFS shows metadata | S-4.8 |
| LFS-06 | LFS file added | New LFS file in PR | Correct "added" status, size shown | S-4.8 |
| LFS-07 | LFS file deleted | LFS file removed | Correct "deleted" status | S-4.8 |

---

## PR #27: Submodules

**Branch**: `test/submodules`
**Focus**: PR modifying git submodules

### Submodule Structure

```
repo/
├── src/                    # Regular files
├── vendor/
│   ├── lib-a/             # Submodule → github.com/org/lib-a
│   └── lib-b/             # Submodule → github.com/org/lib-b
└── external/
    └── shared-utils/      # Submodule → internal repo
```

### Submodule Changes in PR

| Iteration | Submodule Action |
|-----------|------------------|
| 1 | Add new submodule `vendor/lib-c` |
| 2 | Update `vendor/lib-a` to new commit |
| 3 | Update `.gitmodules` URL for `lib-b` |
| 4 | Remove submodule `external/shared-utils` |

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| SM-01 | Submodule addition | New submodule in iter 1 | Shows submodule path, target repo, commit | S-4.8 |
| SM-02 | Submodule commit update | Changed commit SHA | Shows old → new commit SHA | S-4.8 |
| SM-03 | Submodule URL change | `.gitmodules` modified | Shows URL change in gitmodules diff | S-4.8 |
| SM-04 | Submodule removal | Submodule deleted | Shows removal, path no longer exists | S-4.8 |
| SM-05 | Comment on submodule change | Comment on submodule entry | Comment persists on gitlink change | S-2.1 |
| SM-06 | Nested submodule display | Submodule tree structure | Correct hierarchy in file list | S-4.8 |
| SM-07 | Cross-iteration submodule tracking | Update same submodule twice | Iteration diff shows correct delta | S-4.8 |

---

## PR #28: Unreachable Commits (Post-GC)

**Branch**: `test/unreachable-commits`
**Focus**: Behavior when referenced commits become unreachable after remote GC

### Scenario

```
Timeline:
1. Iteration 1: Commit A (comment placed)
2. Iteration 2: Force push to Commit B (A becomes unreachable)
3. Remote GC runs: Commit A garbage collected
4. User tries to view iteration 1 or comment on A
```

### Test Conditions

| Phase | State | Commits Available |
|-------|-------|-------------------|
| Before force push | Normal | A reachable |
| After force push | Dangling | A unreachable but exists |
| After remote GC | Missing | A deleted from remote |

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| UC-01 | View iteration with GC'd commit | Iteration 1 commit is gone | Graceful error: "Commit no longer available" | S-4.2 |
| UC-02 | Comment on GC'd code | Comment references deleted commit | Comment shows with warning, content from artifact | S-4.9 |
| UC-03 | Diff spanning GC'd commit | Iter 1→2 where iter 1 commit is GC'd | Uses artifact snapshot, not live git | S-4.8 |
| UC-04 | Iteration metadata preserved | View iteration list | Iteration entry shows even if commit missing | S-4.2 |
| UC-05 | Artifact resilience | Full scenario | Artifact preserves content despite GC | S-4.2 |
| UC-06 | Partial GC (some commits available) | Iter 1 GC'd, iter 2-3 available | Available iterations work, GC'd shows warning | S-4.2 |

---

## PR #29: Shallow Clone Effects

**Branch**: `test/shallow-clone`
**Focus**: Behavior when repository is shallow cloned

### Shallow Clone Scenarios

| Scenario | Depth | Missing History |
|----------|-------|-----------------|
| CI shallow clone | depth=1 | All parent commits |
| Partial clone | depth=50 | Commits > 50 back |
| Treeless clone | filter=tree:0 | Tree objects (directories) |

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| SC-01 | Base commit outside shallow | Base SHA not in clone | Fallback to API fetch for base content | S-4.8 |
| SC-02 | Iteration in shallow range | Recent iteration | Normal behavior | S-4.2 |
| SC-03 | Iteration outside shallow range | Old iteration | API fallback or artifact lookup | S-4.2 |
| SC-04 | Diff computation with missing blobs | Blobless clone | Fetch blobs on-demand | S-4.8 |

---

## PR #30: Symlinks and Special Files

**Branch**: `test/special-files`
**Focus**: Handling of symlinks, executable bits, and special file modes

### Special Files in PR

| File | Type | Mode |
|------|------|------|
| `bin/run.sh` | Executable script | 100755 |
| `link-to-config` | Symlink → `config/main.json` | 120000 |
| `broken-link` | Broken symlink | 120000 |
| `empty-dir/.gitkeep` | Empty file (directory marker) | 100644 |

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| SF-01 | Executable file display | Script with +x bit | Shows executable indicator | S-4.8 |
| SF-02 | Mode change only | chmod +x, no content change | Shows mode change in diff | S-4.8 |
| SF-03 | Symlink display | Valid symlink | Shows link target | S-4.8 |
| SF-04 | Symlink target change | Symlink retargeted | Shows old → new target | S-4.8 |
| SF-05 | Broken symlink | Link to non-existent target | Warning indicator, no crash | S-4.8 |
| SF-06 | Comment on symlink | Comment on link file | File-level comment works | S-2.1 |
| SF-07 | Symlink to regular file conversion | Symlink replaced with regular file | Shows type change | S-4.8 |

---

## PR #31: Merge Conflict Artifacts

**Branch**: `test/merge-conflicts`
**Focus**: PRs where merge conflicts were resolved

### Conflict Resolution History

| File | Conflict Type | Resolution |
|------|---------------|------------|
| `config.json` | Both modified same lines | Manual merge |
| `README.md` | Concurrent additions | Keep both |
| `version.txt` | Divergent changes | Theirs (main) |

### Iteration Structure

| Iteration | State |
|-----------|-------|
| 1 | Pre-merge (conflicts exist) |
| 2 | Post-merge (conflicts resolved) |

| ID | Test Case | Setup | Expected Behavior | User Story |
|----|-----------|-------|-------------------|------------|
| MCF-01 | View resolved conflict | Post-merge iteration | Shows resolved content, no markers | S-4.8 |
| MCF-02 | Diff pre→post conflict | Iter 1→2 | Shows resolution changes | S-4.8 |
| MCF-03 | Comment on conflict resolution | Comment on resolved lines | Comment tracks correctly | S-2.1, S-4.9 |
| MCF-04 | Multiple conflicts in file | File with 3 conflict regions | All regions show resolved | S-4.8 |

---

## Test Execution Summary

| PR | Category | Test Cases | Branch |
|----|----------|------------|--------|
| #2 | Comment Positioning | CP-01 to CP-06 | `test/comment-positioning` |
| #3 | Threading & States | CT-01 to CT-08 | `test/comment-threading` |
| #4 | File Operations | FO-01 to FO-05 | `test/file-operations` |
| #5 | Iteration Tracking | IT-01 to IT-13 | `test/iteration-tracking` |
| #6 | Code Suggestions | CS-01 to CS-04 | `test/code-suggestions` |
| #7 | Top-Level Comments | TL-01 to TL-06 | `test/top-level-comments` |
| #8 | PR State Transitions | PS-01 to PS-03 | `test/pr-states` |
| #9 | Draft PR | PS-05 | `test/draft-pr` |
| #10 | Edge Cases | EC-01 to EC-05 | `test/edge-cases` |
| #11 | Cross-Line-Type | CLT-01 to CLT-03 | `test/cross-line-type` |
| #13 | Comment Interactions | CI-01 to CI-03 | `test/comment-interactions` |
| #14 | File Add+Rename | FAR-01 | `test/add-rename-v2` |
| #15 | Multi-Commit Push | MC-01 to MC-03 | `test/multi-commit-push` |
| #16 | Completed (Merged) PR | PS-04 | `test/completed-pr` |
| #17 | Scale - Many Files | MF-01 to MF-05 | `test/scale-many-files` |
| #18 | Scale - Large Changes | LC-01 to LC-05 | `test/scale-large-changes` |
| #19 | Scale - Large Files | LF-01 to LF-05 | `test/scale-large-files` |
| #20 | Merge Commit (2 Parents) | MC2-01 to MC2-05 | `test/merge-commit` |
| #21 | Octopus Merge (3+ Parents) | OM-01 to OM-04 | `test/octopus-merge` |
| #22 | Multiple Merges | MM-01 to MM-05 | `test/multiple-merges` |
| #23 | Rebase Operation | RB-01 to RB-06 | `test/rebase-operation` |
| #24 | Force Push Scenarios | FP-01 to FP-06 | `test/force-push-scenarios` |
| #25 | Many Iterations | MI-01 to MI-06 | `test/many-iterations` |
| #26 | Git LFS Files | LFS-01 to LFS-07 | `test/git-lfs` |
| #27 | Submodules | SM-01 to SM-07 | `test/submodules` |
| #28 | Unreachable Commits (Post-GC) | UC-01 to UC-06 | `test/unreachable-commits` |
| #29 | Shallow Clone Effects | SC-01 to SC-04 | `test/shallow-clone` |
| #30 | Symlinks & Special Files | SF-01 to SF-07 | `test/special-files` |
| #31 | Merge Conflict Artifacts | MCF-01 to MCF-04 | `test/merge-conflicts` |

**Total: 144 test cases across 29 PRs**

---

## PR URLs

### Existing PRs (Created)
- PR #2: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender/pullrequest/2
- PR #3: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender/pullrequest/3
- PR #4: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender/pullrequest/4
- PR #5: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender/pullrequest/5
- PR #6: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender/pullrequest/6
- PR #7: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender/pullrequest/7
- PR #8: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender/pullrequest/8
- PR #9: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender/pullrequest/9
- PR #10: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender/pullrequest/10
- PR #11: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender/pullrequest/11
- PR #13: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender/pullrequest/13
- PR #14: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender/pullrequest/14
- PR #15: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender/pullrequest/15
- PR #16: https://dev.azure.com/pedropaulovc/BasicAppServiceRecommender/_git/BasicAppServiceRecommender/pullrequest/16

### Planned PRs (To Be Created)
- PR #17: `test/scale-many-files` - Scale: Many Files
- PR #18: `test/scale-large-changes` - Scale: Large Code Changes
- PR #19: `test/scale-large-files` - Scale: Very Large Files
- PR #20: `test/merge-commit` - Merge Commit (2 Parents)
- PR #21: `test/octopus-merge` - Octopus Merge (3+ Parents)
- PR #22: `test/multiple-merges` - Multiple Merges
- PR #23: `test/rebase-operation` - Rebase Operation
- PR #24: `test/force-push-scenarios` - Force Push Scenarios
- PR #25: `test/many-iterations` - Many Iterations
- PR #26: `test/git-lfs` - Git LFS Files
- PR #27: `test/submodules` - Submodules
- PR #28: `test/unreachable-commits` - Unreachable Commits (Post-GC)
- PR #29: `test/shallow-clone` - Shallow Clone Effects
- PR #30: `test/special-files` - Symlinks & Special Files
- PR #31: `test/merge-conflicts` - Merge Conflict Artifacts
