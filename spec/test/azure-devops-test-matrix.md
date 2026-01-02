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

**Total: 62 test cases across 14 PRs**

---

## PR URLs

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
