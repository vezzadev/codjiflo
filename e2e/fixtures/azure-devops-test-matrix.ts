/**
 * Azure DevOps Test Matrix Mock Data
 *
 * Pre-mocked PRs from spec/test/azure-devops-test-matrix.md
 * These fixtures simulate Azure DevOps PR scenarios for E2E testing.
 *
 * Note: CodjiFlo currently uses GitHub API, but these test cases are designed
 * to validate comment positioning, threading, and iteration behaviors that
 * are provider-agnostic. The mock data simulates equivalent GitHub structures.
 */

import type { MockPR, MockFile, MockComment, MockUser } from "./github-mocks";

// ============================================================================
// Test Repository Configuration
// ============================================================================

export const testRepository = {
  // GitHub test repository for E2E mock data
  owner: "pedropaulovc",
  repo: "codjiflo-e2e-test-repo",
};

/**
 * Get test config for a specific PR based on mode
 */
export function getTestConfig(prNumber: number) {
  return {
    owner: testRepository.owner,
    repo: testRepository.repo,
    prNumber,
  };
}

// ============================================================================
// Common Test Users
// ============================================================================

export const testUsers = {
  author: {
    id: 1001,
    login: "pedropaulovc",
    avatar_url: "https://avatars.githubusercontent.com/u/1001",
  } as MockUser,
  reviewer: {
    id: 1002,
    login: "reviewer-alice",
    avatar_url: "https://avatars.githubusercontent.com/u/1002",
  } as MockUser,
  reviewer2: {
    id: 1003,
    login: "reviewer-bob",
    avatar_url: "https://avatars.githubusercontent.com/u/1003",
  } as MockUser,
};

// ============================================================================
// PR #2: Comment Positioning (test/comment-positioning)
// Tests: CP-01 to CP-06 (S-2.1, S-5.1)
// ============================================================================

export const pr2CommentPositioning = {
  pr: {
    id: 1,
    number: 1,
    title: "test: Comment Positioning",
    body: "Test PR for validating line-level and character-level comment positions",
    state: "open",
    merged: false,
    draft: false,
    user: testUsers.author,
    head: { ref: "test/comment-positioning", sha: "cp-head-sha" },
    base: { ref: "main", sha: "cp-base-sha" },
    html_url: "https://github.com/pedropaulovc/codjiflo-e2e-test-repo/pull/1",
    created_at: "2024-06-01T10:00:00Z",
    updated_at: "2024-06-01T12:00:00Z",
  } as MockPR,

  files: [
    {
      filename: "src/positioning-test.ts",
      status: "modified",
      additions: 5,
      deletions: 2,
      changes: 7,
      patch: `@@ -1,10 +1,13 @@
 // Context line 1
 // Context line 2
 // Context line 3
-const oldValue = 'removed';
+const newValue = 'added on line 5';
 // Context line for CP-03
+const ABCDEFGHIJKLMNOPQRSTUVWXYZ = 'character-level test';
+const multiLineStart = 'line 6';
+const multiLineMiddle = 'line 7';
+const multiLineEnd = 'line 8 end';
+const partialLineStart = 'partial at offset 30';
+const partialLineEnd = 'ends here at 15';`,
      baseContent: `// Context line 1
// Context line 2
// Context line 3
const oldValue = 'removed';
// Context line for CP-03
`,
      headContent: `// Context line 1
// Context line 2
// Context line 3
const newValue = 'added on line 5';
// Context line for CP-03
const ABCDEFGHIJKLMNOPQRSTUVWXYZ = 'character-level test';
const multiLineStart = 'line 6';
const multiLineMiddle = 'line 7';
const multiLineEnd = 'line 8 end';
const partialLineStart = 'partial at offset 30';
const partialLineEnd = 'ends here at 15';
`,
    } as MockFile,
  ],

  comments: {
    // CP-01: Single-line comment on added line (rightFileStart)
    cp01: {
      id: 2001,
      body: "[CP-01] Comment on added line - should appear on RIGHT side of diff",
      user: testUsers.reviewer,
      created_at: "2024-06-01T11:00:00Z",
      updated_at: "2024-06-01T11:00:00Z",
      path: "src/positioning-test.ts",
      line: 5,
      side: "RIGHT",
      position: 5,
    } as MockComment,

    // CP-02: Single-line comment on deleted line (leftFileStart)
    cp02: {
      id: 2002,
      body: "[CP-02] Comment on deleted line - should appear on LEFT side of diff",
      user: testUsers.reviewer,
      created_at: "2024-06-01T11:01:00Z",
      updated_at: "2024-06-01T11:01:00Z",
      path: "src/positioning-test.ts",
      line: 4,
      side: "LEFT",
      position: 4,
    } as MockComment,

    // CP-03: Comment on context line (both leftFileStart and rightFileStart)
    cp03: {
      id: 2003,
      body: "[CP-03] Comment on context (unchanged) line - visible in both views",
      user: testUsers.reviewer,
      created_at: "2024-06-01T11:02:00Z",
      updated_at: "2024-06-01T11:02:00Z",
      path: "src/positioning-test.ts",
      line: 6,
      side: "RIGHT",
      position: 6,
    } as MockComment,
  },

  allComments(): MockComment[] {
    return [this.comments.cp01, this.comments.cp02, this.comments.cp03];
  },
};

// ============================================================================
// PR #3: Comment Threading & States (test/comment-threading)
// Tests: CT-01 to CT-08 (S-2.1, S-2.3, S-2.5)
// ============================================================================

export const pr3CommentThreading = {
  pr: {
    id: 2,
    number: 2,
    title: "test: Comment Threading & States",
    body: "Test PR for thread status transitions and reply chains",
    state: "open",
    merged: false,
    draft: false,
    user: testUsers.author,
    head: { ref: "test/comment-threading", sha: "ct-head-sha" },
    base: { ref: "main", sha: "ct-base-sha" },
    html_url: "https://github.com/pedropaulovc/codjiflo-e2e-test-repo/pull/2",
    created_at: "2024-06-02T10:00:00Z",
    updated_at: "2024-06-02T14:00:00Z",
  } as MockPR,

  files: [
    {
      filename: "src/threading-test.ts",
      status: "modified",
      additions: 10,
      deletions: 0,
      changes: 10,
      patch: `@@ -1,5 +1,15 @@
 // Line 1: context
+// Line 2: added - CT-01 active thread here
+// Line 3: added
+// Line 4: added - CT-02 resolved thread here
+// Line 5: added
+// Line 6: added - CT-07 3-level reply chain here
+// Line 7: added
+// Line 8: added
+// Line 9: added
+// Line 10: added - CT-08 multiple parallel threads
 // Original line 5`,
      baseContent: `// Line 1: context
// Original line 5
`,
      headContent: `// Line 1: context
// Line 2: added - CT-01 active thread here
// Line 3: added
// Line 4: added - CT-02 resolved thread here
// Line 5: added
// Line 6: added - CT-07 3-level reply chain here
// Line 7: added
// Line 8: added
// Line 9: added
// Line 10: added - CT-08 multiple parallel threads
// Original line 5
`,
    } as MockFile,
  ],

  comments: {
    // CT-01: Active thread (status: 1)
    ct01: {
      id: 3001,
      body: "[CT-01] Active thread - status 1 (open discussion)",
      user: testUsers.reviewer,
      created_at: "2024-06-02T11:00:00Z",
      updated_at: "2024-06-02T11:00:00Z",
      path: "src/threading-test.ts",
      line: 2,
      side: "RIGHT",
      position: 2,
    } as MockComment,

    // CT-02: Resolved/Fixed thread (status: 2) - Simulated via reply indicating resolution
    ct02: {
      id: 3002,
      body: "[CT-02] This thread has been RESOLVED (status 2 - Fixed)",
      user: testUsers.reviewer,
      created_at: "2024-06-02T11:01:00Z",
      updated_at: "2024-06-02T11:01:00Z",
      path: "src/threading-test.ts",
      line: 4,
      side: "RIGHT",
      position: 4,
    } as MockComment,

    // CT-07: 3-level deep reply chain
    ct07Root: {
      id: 3007,
      body: "[CT-07] ROOT COMMENT - Starting discussion",
      user: testUsers.reviewer,
      created_at: "2024-06-02T12:00:00Z",
      updated_at: "2024-06-02T12:00:00Z",
      path: "src/threading-test.ts",
      line: 6,
      side: "RIGHT",
      position: 6,
    } as MockComment,

    ct07Reply1: {
      id: 3008,
      body: "[CT-07] LEVEL 2 REPLY - Responding to root",
      user: testUsers.author,
      created_at: "2024-06-02T12:30:00Z",
      updated_at: "2024-06-02T12:30:00Z",
      path: "src/threading-test.ts",
      line: 6,
      side: "RIGHT",
      position: 6,
      // in_reply_to would be 3007 in actual GitHub API
    } as MockComment,

    ct07Reply2: {
      id: 3009,
      body: "[CT-07] LEVEL 3 REPLY - Responding to level 2",
      user: testUsers.reviewer2,
      created_at: "2024-06-02T13:00:00Z",
      updated_at: "2024-06-02T13:00:00Z",
      path: "src/threading-test.ts",
      line: 6,
      side: "RIGHT",
      position: 6,
      // in_reply_to would be 3008 in actual GitHub API
    } as MockComment,

    // CT-08: Multiple parallel threads on same line
    ct08Thread1: {
      id: 3010,
      body: "[CT-08] Thread 1 on line 10 - First parallel thread",
      user: testUsers.reviewer,
      created_at: "2024-06-02T13:30:00Z",
      updated_at: "2024-06-02T13:30:00Z",
      path: "src/threading-test.ts",
      line: 10,
      side: "RIGHT",
      position: 10,
    } as MockComment,

    ct08Thread2: {
      id: 3011,
      body: "[CT-08] Thread 2 on line 10 - Second parallel thread (different concern)",
      user: testUsers.reviewer2,
      created_at: "2024-06-02T13:31:00Z",
      updated_at: "2024-06-02T13:31:00Z",
      path: "src/threading-test.ts",
      line: 10,
      side: "RIGHT",
      position: 10,
    } as MockComment,
  },

  allComments(): MockComment[] {
    return [
      this.comments.ct01,
      this.comments.ct02,
      this.comments.ct07Root,
      this.comments.ct07Reply1,
      this.comments.ct07Reply2,
      this.comments.ct08Thread1,
      this.comments.ct08Thread2,
    ];
  },
};

// ============================================================================
// PR #4: File Operations (test/file-operations)
// Tests: FO-01 to FO-05 (S-2.1, S-4.8)
// ============================================================================

export const pr4FileOperations = {
  pr: {
    id: 3,
    number: 3,
    title: "test: File Operations",
    body: "Test PR for comments on added/deleted/renamed files",
    state: "open",
    merged: false,
    draft: false,
    user: testUsers.author,
    head: { ref: "test/file-operations", sha: "fo-head-sha" },
    base: { ref: "main", sha: "fo-base-sha" },
    html_url: "https://github.com/pedropaulovc/codjiflo-e2e-test-repo/pull/3",
    created_at: "2024-06-03T10:00:00Z",
    updated_at: "2024-06-03T12:00:00Z",
  } as MockPR,

  files: [
    // FO-01: Newly added file
    {
      filename: "src/new-file.txt",
      status: "added",
      additions: 5,
      deletions: 0,
      changes: 5,
      patch: `@@ -0,0 +1,5 @@
+// This is a new file
+const greeting = 'Hello';
+const target = 'World';
+console.log(greeting, target);
+// End of new file`,
      headContent: `// This is a new file
const greeting = 'Hello';
const target = 'World';
console.log(greeting, target);
// End of new file
`,
    } as MockFile,

    // FO-02: Deleted file
    {
      filename: "src/file-to-delete.txt",
      status: "removed",
      additions: 0,
      deletions: 5,
      changes: 5,
      patch: `@@ -1,5 +0,0 @@
-// This file will be deleted
-const oldCode = 'legacy';
-function deprecated() {}
-// No longer needed
-export {};`,
      baseContent: `// This file will be deleted
const oldCode = 'legacy';
function deprecated() {}
// No longer needed
export {};
`,
    } as MockFile,

    // FO-03: Renamed file
    {
      filename: "src/new-name.txt",
      status: "renamed",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: `@@ -1,3 +1,4 @@
 // This file was renamed
 const content = 'preserved';
+const addedLine = 'after rename';
 export { content };`,
      baseContent: `// This file was renamed
const content = 'preserved';
export { content };
`,
      headContent: `// This file was renamed
const content = 'preserved';
const addedLine = 'after rename';
export { content };
`,
    } as MockFile,
  ],

  comments: {
    // FO-01: Comment on newly added file (rightFileStart only)
    fo01: {
      id: 4001,
      body: "[FO-01] Comment on NEW FILE - rightFileStart only (no left side)",
      user: testUsers.reviewer,
      created_at: "2024-06-03T11:00:00Z",
      updated_at: "2024-06-03T11:00:00Z",
      path: "src/new-file.txt",
      line: 2,
      side: "RIGHT",
      position: 2,
    } as MockComment,

    // FO-02: Comment on deleted file (leftFileStart only)
    fo02: {
      id: 4002,
      body: "[FO-02] Comment on DELETED FILE - leftFileStart only (no right side)",
      user: testUsers.reviewer,
      created_at: "2024-06-03T11:01:00Z",
      updated_at: "2024-06-03T11:01:00Z",
      path: "src/file-to-delete.txt",
      line: 3,
      side: "LEFT",
      position: 3,
    } as MockComment,

    // FO-03: Comment on renamed file
    fo03: {
      id: 4003,
      body: "[FO-03] Comment on RENAMED FILE - track via changeTrackingId",
      user: testUsers.reviewer,
      created_at: "2024-06-03T11:02:00Z",
      updated_at: "2024-06-03T11:02:00Z",
      path: "src/new-name.txt",
      line: 3,
      side: "RIGHT",
      position: 3,
    } as MockComment,
  },

  allComments(): MockComment[] {
    return [this.comments.fo01, this.comments.fo02, this.comments.fo03];
  },
};

// ============================================================================
// PR #7: Top-Level Comments (test/top-level-comments)
// Tests: TL-01 to TL-06 (S-2.1, S-2.3, S-2.5)
// ============================================================================

export const pr7TopLevelComments = {
  pr: {
    id: 7,
    number: 7,
    title: "test: Top-Level Comments",
    body: "Test PR for PR-level comments without file context",
    state: "open",
    merged: false,
    draft: false,
    user: testUsers.author,
    head: { ref: "test/top-level-comments", sha: "tl-head-sha" },
    base: { ref: "main", sha: "tl-base-sha" },
    html_url: "https://github.com/pedropaulovc/codjiflo-e2e-test-repo/pull/7",
    created_at: "2024-06-07T10:00:00Z",
    updated_at: "2024-06-07T14:00:00Z",
  } as MockPR,

  files: [
    {
      filename: "src/sample-change.ts",
      status: "modified",
      additions: 2,
      deletions: 1,
      changes: 3,
      patch: `@@ -1,3 +1,4 @@
 const sample = 'test';
-const old = 'removed';
+const new1 = 'added';
+const new2 = 'also added';`,
      baseContent: `const sample = 'test';
const old = 'removed';
`,
      headContent: `const sample = 'test';
const new1 = 'added';
const new2 = 'also added';
`,
    } as MockFile,
  ],

  // Note: Top-level comments in GitHub are issue comments, not review comments
  // These mock structures simulate the concept for testing
  comments: {
    // TL-04: Markdown formatting
    tl04: {
      id: 7004,
      body: `[TL-04] **Markdown Formatting Test**

# Header 1
## Header 2

- Bullet point 1
- Bullet point 2
  - Nested bullet

\`\`\`typescript
const code = 'block';
\`\`\`

> Blockquote text

[Link text](https://example.com)`,
      user: testUsers.reviewer,
      created_at: "2024-06-07T12:00:00Z",
      updated_at: "2024-06-07T12:00:00Z",
      path: "src/sample-change.ts",
      line: 3,
      side: "RIGHT",
      position: 3,
    } as MockComment,
  },

  allComments(): MockComment[] {
    return [this.comments.tl04];
  },
};

// ============================================================================
// PR #10: Edge Cases (test/edge-cases)
// Tests: EC-01 to EC-05 (S-2.1)
// ============================================================================

export const pr10EdgeCases = {
  pr: {
    id: 4,
    number: 4,
    title: "test: Edge Cases",
    body: "Test PR for unusual but valid scenarios",
    state: "open",
    merged: false,
    draft: false,
    user: testUsers.author,
    head: { ref: "test/edge-cases", sha: "ec-head-sha" },
    base: { ref: "main", sha: "ec-base-sha" },
    html_url: "https://github.com/pedropaulovc/codjiflo-e2e-test-repo/pull/4",
    created_at: "2024-06-10T10:00:00Z",
    updated_at: "2024-06-10T12:00:00Z",
  } as MockPR,

  files: [
    // EC-01: Empty file
    {
      filename: "src/empty-file.txt",
      status: "added",
      additions: 0,
      deletions: 0,
      changes: 0,
      patch: "",
      headContent: "",
    } as MockFile,

    // EC-03: Very long line (1000+ chars)
    {
      filename: "src/long-line.txt",
      status: "added",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: `@@ -0,0 +1 @@
+${"X".repeat(1000)}`,
      headContent: "X".repeat(1000) + "\n",
    } as MockFile,

    // EC-04: Unicode/emoji content
    {
      filename: "src/unicode-test.ts",
      status: "modified",
      additions: 3,
      deletions: 0,
      changes: 3,
      patch: `@@ -1,2 +1,5 @@
 const regular = 'ascii';
+const japanese = '修正済み';
+const russian = 'Привет';
+const arabic = 'مرحبا';
+const emoji = '🎉✨🚀';`,
      baseContent: `const regular = 'ascii';
`,
      headContent: `const regular = 'ascii';
const japanese = '修正済み';
const russian = 'Привет';
const arabic = 'مرحبا';
const emoji = '🎉✨🚀';
`,
    } as MockFile,
  ],

  comments: {
    // EC-04: Unicode/emoji comment content
    ec04: {
      id: 10004,
      body: "[EC-04] 🎉 修正済み Привет مرحبا - Unicode/emoji rendering test",
      user: testUsers.reviewer,
      created_at: "2024-06-10T11:00:00Z",
      updated_at: "2024-06-10T11:00:00Z",
      path: "src/unicode-test.ts",
      line: 3,
      side: "RIGHT",
      position: 3,
    } as MockComment,

    // EC-05: First character of file
    ec05: {
      id: 10005,
      body: "[EC-05] Comment at first character of file (line 1, offset 0)",
      user: testUsers.reviewer,
      created_at: "2024-06-10T11:01:00Z",
      updated_at: "2024-06-10T11:01:00Z",
      path: "src/unicode-test.ts",
      line: 1,
      side: "RIGHT",
      position: 1,
    } as MockComment,
  },

  allComments(): MockComment[] {
    return [this.comments.ec04, this.comments.ec05];
  },
};

// ============================================================================
// PR #13: Comment Interactions (test/comment-interactions)
// Tests: CI-01 to CI-03 (S-2.4)
// ============================================================================

export const pr13CommentInteractions = {
  pr: {
    id: 13,
    number: 13,
    title: "test: Comment Interactions",
    body: "Test PR for comment lifecycle operations (edit/delete)",
    state: "open",
    merged: false,
    draft: false,
    user: testUsers.author,
    head: { ref: "test/comment-interactions", sha: "ci-head-sha" },
    base: { ref: "main", sha: "ci-base-sha" },
    html_url: "https://github.com/pedropaulovc/codjiflo-e2e-test-repo/pull/13",
    created_at: "2024-06-13T10:00:00Z",
    updated_at: "2024-06-13T12:00:00Z",
  } as MockPR,

  files: [
    {
      filename: "src/interaction-test.ts",
      status: "modified",
      additions: 3,
      deletions: 0,
      changes: 3,
      patch: `@@ -1,2 +1,5 @@
 const base = 'unchanged';
+const line2 = 'for edited comment';
+const line3 = 'for deleted comment';
+const line4 = 'for like test';`,
      baseContent: `const base = 'unchanged';
`,
      headContent: `const base = 'unchanged';
const line2 = 'for edited comment';
const line3 = 'for deleted comment';
const line4 = 'for like test';
`,
    } as MockFile,
  ],

  comments: {
    // CI-01: Edited comment (lastContentUpdatedDate differs from publishedDate)
    ci01: {
      id: 13001,
      body: "[CI-01] UPDATED CONTENT - This comment was edited after initial post",
      user: testUsers.author, // User's own comment (can edit)
      created_at: "2024-06-13T11:00:00Z",
      updated_at: "2024-06-13T11:30:00Z", // Different from created_at = edited
      path: "src/interaction-test.ts",
      line: 2,
      side: "RIGHT",
      position: 2,
    } as MockComment,

    // CI-02: Comment that will be deleted (initially present, then removed)
    ci02: {
      id: 13002,
      body: "[CI-02] This comment will be DELETED",
      user: testUsers.author, // User's own comment (can delete)
      created_at: "2024-06-13T11:01:00Z",
      updated_at: "2024-06-13T11:01:00Z",
      path: "src/interaction-test.ts",
      line: 3,
      side: "RIGHT",
      position: 3,
    } as MockComment,
  },

  allComments(): MockComment[] {
    return [this.comments.ci01, this.comments.ci02];
  },
};

// ============================================================================
// PR #5: Iteration Tracking (test/iteration-tracking)
// Tests: IT-01 to IT-10 (S-4.2, S-4.8, S-4.9)
// ============================================================================

export const pr5IterationTracking = {
  pr: {
    id: 6,
    number: 6,
    title: "test: Iteration Tracking",
    body: "Test PR for comments across multiple iterations with varying file deltas",
    state: "open",
    merged: false,
    draft: false,
    user: testUsers.author,
    head: { ref: "test/iteration-tracking", sha: "it-head-sha-v4" },
    base: { ref: "main", sha: "it-base-sha" },
    html_url: "https://github.com/pedropaulovc/codjiflo-e2e-test-repo/pull/6",
    created_at: "2024-06-05T10:00:00Z",
    updated_at: "2024-06-05T18:00:00Z",
  } as MockPR,

  // Files represent state at iteration 4 (final)
  files: [
    // fileA.txt: Modified in iter 1, unchanged in 2-4
    {
      filename: "src/fileA.txt",
      status: "modified",
      additions: 2,
      deletions: 1,
      changes: 3,
      patch: `@@ -1,3 +1,4 @@
 // fileA.txt
-const original = 'base';
+const modified = 'iteration 1';
+const extra = 'added in iter 1';`,
      baseContent: `// fileA.txt
const original = 'base';
`,
      headContent: `// fileA.txt
const modified = 'iteration 1';
const extra = 'added in iter 1';
`,
    } as MockFile,

    // fileC.txt: Unchanged in 1-2, modified in 3, unchanged in 4
    {
      filename: "src/fileC.txt",
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: `@@ -1,2 +1,3 @@
 // fileC.txt
 const stable = 'preserved';
+const addedInIter3 = 'force-push change';`,
      baseContent: `// fileC.txt
const stable = 'preserved';
`,
      headContent: `// fileC.txt
const stable = 'preserved';
const addedInIter3 = 'force-push change';
`,
    } as MockFile,

    // fileD.txt: Added in iter 3, modified in iter 4
    {
      filename: "src/fileD.txt",
      status: "added",
      additions: 3,
      deletions: 0,
      changes: 3,
      patch: `@@ -0,0 +1,3 @@
+// fileD.txt - added in iteration 3
+const newFile = 'iter 3';
+const modifiedInIter4 = 'updated';`,
      headContent: `// fileD.txt - added in iteration 3
const newFile = 'iter 3';
const modifiedInIter4 = 'updated';
`,
    } as MockFile,
  ],

  // Mock iteration data for frontend consumption
  iterations: [
    {
      id: 1,
      revision: 1,
      head_sha: "it-head-sha-v1",
      base_sha: "it-base-sha",
      author: testUsers.author.login,
      created_at: "2024-06-05T10:00:00Z",
    },
    {
      id: 2,
      revision: 2,
      head_sha: "it-head-sha-v2",
      base_sha: "it-base-sha",
      author: testUsers.author.login,
      created_at: "2024-06-05T12:00:00Z",
    },
    {
      id: 3,
      revision: 3,
      head_sha: "it-head-sha-v3", // Force-push
      base_sha: "it-base-sha",
      before_sha: "it-head-sha-v2", // Previous head before force-push
      author: testUsers.author.login,
      created_at: "2024-06-05T14:00:00Z",
    },
    {
      id: 4,
      revision: 4,
      head_sha: "it-head-sha-v4",
      base_sha: "it-base-sha",
      author: testUsers.author.login,
      created_at: "2024-06-05T16:00:00Z",
    },
  ],

  comments: {
    // IT-01: Comment on iteration 1, unchanged in 2 (position preserved)
    it01: {
      id: 5001,
      body: "[IT-01] Comment on iter 1, file unchanged in iter 2 - position should be preserved",
      user: testUsers.reviewer,
      created_at: "2024-06-05T10:30:00Z",
      updated_at: "2024-06-05T10:30:00Z",
      path: "src/fileA.txt",
      line: 2,
      side: "RIGHT",
      position: 2,
    } as MockComment,

    // IT-05: Force-push: comment survives SHA change
    it05: {
      id: 5005,
      body: "[IT-05] Comment survives force-push (iter 2 → 3 SHA change)",
      user: testUsers.reviewer,
      created_at: "2024-06-05T12:30:00Z",
      updated_at: "2024-06-05T12:30:00Z",
      path: "src/fileC.txt",
      line: 2,
      side: "RIGHT",
      position: 2,
    } as MockComment,
  },

  allComments(): MockComment[] {
    return [this.comments.it01, this.comments.it05];
  },
};

// ============================================================================
// PR #15: Multi-Commit Push (test/multi-commit-push)
// Tests: MC-01 to MC-03 (S-4.2, S-4.7)
// ============================================================================

export const pr15MultiCommitPush = {
  pr: {
    id: 5,
    number: 5,
    title: "test: Multi-Commit Push",
    body: "Test PR for multiple commits pushed in a single push operation",
    state: "open",
    merged: false,
    draft: false,
    user: testUsers.author,
    head: { ref: "test/multi-commit-push", sha: "mc-head-sha-iter2" },
    base: { ref: "main", sha: "mc-base-sha" },
    html_url: "https://github.com/pedropaulovc/codjiflo-e2e-test-repo/pull/5",
    created_at: "2024-06-15T10:00:00Z",
    updated_at: "2024-06-15T14:00:00Z",
  } as MockPR,

  files: [
    // multi-commit-file.txt: Created in commit 1, extended in commits 2-7
    {
      filename: "src/multi-commit-file.txt",
      status: "added",
      additions: 14,
      deletions: 0,
      changes: 14,
      patch: `@@ -0,0 +1,14 @@
+// Multi-commit file
+// Line 2: Commit 1
+// Line 3: Commit 1
+// Line 4: Commit 2
+// Line 5: Commit 2
+// Line 6: Commit 3 (MC-01 comment here)
+// Line 7: Commit 3
+// Line 8: Commit 4
+// Line 9: Commit 5 (iter 2)
+// Line 10: Commit 5
+// Line 11: Commit 6
+// Line 12: Commit 6
+// Line 13: Commit 7 (MC-03 comment here)
+// Line 14: Commit 7`,
      headContent: `// Multi-commit file
// Line 2: Commit 1
// Line 3: Commit 1
// Line 4: Commit 2
// Line 5: Commit 2
// Line 6: Commit 3 (MC-01 comment here)
// Line 7: Commit 3
// Line 8: Commit 4
// Line 9: Commit 5 (iter 2)
// Line 10: Commit 5
// Line 11: Commit 6
// Line 12: Commit 6
// Line 13: Commit 7 (MC-03 comment here)
// Line 14: Commit 7
`,
    } as MockFile,

    // second-file.txt: Added in commit 4 (iter 1)
    {
      filename: "src/second-file.txt",
      status: "added",
      additions: 10,
      deletions: 0,
      changes: 10,
      patch: `@@ -0,0 +1,10 @@
+// Second file - added in Commit 4
+// Line 2
+// Line 3
+// Line 4
+// Line 5 (MC-02 comment here)
+// Line 6
+// Line 7 (iter 2 content)
+// Line 8
+// Line 9
+// Line 10`,
      headContent: `// Second file - added in Commit 4
// Line 2
// Line 3
// Line 4
// Line 5 (MC-02 comment here)
// Line 6
// Line 7 (iter 2 content)
// Line 8
// Line 9
// Line 10
`,
    } as MockFile,
  ],

  iterations: [
    {
      id: 1,
      revision: 1,
      head_sha: "mc-head-sha-iter1",
      base_sha: "mc-base-sha",
      commits: ["commit1", "commit2", "commit3", "commit4"], // 4 commits pushed together
      author: testUsers.author.login,
      created_at: "2024-06-15T10:00:00Z",
    },
    {
      id: 2,
      revision: 2,
      head_sha: "mc-head-sha-iter2",
      base_sha: "mc-base-sha",
      commits: ["commit5", "commit6", "commit7"], // 3 commits pushed together
      author: testUsers.author.login,
      created_at: "2024-06-15T12:00:00Z",
    },
  ],

  comments: {
    // MC-01: Comment on line from first commit (iter 1)
    mc01: {
      id: 15001,
      body: "[MC-01] Comment on line 6 from Commit 3 (iteration 1)",
      user: testUsers.reviewer,
      created_at: "2024-06-15T10:30:00Z",
      updated_at: "2024-06-15T10:30:00Z",
      path: "src/multi-commit-file.txt",
      line: 6,
      side: "RIGHT",
      position: 6,
    } as MockComment,

    // MC-02: Comment on last file of iter 1 (Commit 4)
    mc02: {
      id: 15002,
      body: "[MC-02] Comment on second-file.txt line 5 (Commit 4, iteration 1)",
      user: testUsers.reviewer,
      created_at: "2024-06-15T10:45:00Z",
      updated_at: "2024-06-15T10:45:00Z",
      path: "src/second-file.txt",
      line: 5,
      side: "RIGHT",
      position: 5,
    } as MockComment,

    // MC-03: Comment on iteration 2 content
    mc03: {
      id: 15003,
      body: "[MC-03] Comment on line 13 from Commit 7 (iteration 2)",
      user: testUsers.reviewer,
      created_at: "2024-06-15T12:30:00Z",
      updated_at: "2024-06-15T12:30:00Z",
      path: "src/multi-commit-file.txt",
      line: 13,
      side: "RIGHT",
      position: 13,
    } as MockComment,
  },

  allComments(): MockComment[] {
    return [this.comments.mc01, this.comments.mc02, this.comments.mc03];
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all test PRs from the Azure DevOps test matrix
 */
export function getAllTestPRs() {
  return {
    pr2: pr2CommentPositioning,
    pr3: pr3CommentThreading,
    pr4: pr4FileOperations,
    pr5: pr5IterationTracking,
    pr7: pr7TopLevelComments,
    pr10: pr10EdgeCases,
    pr13: pr13CommentInteractions,
    pr15: pr15MultiCommitPush,
  };
}

/**
 * Base interface for test PR data
 */
interface TestPRData {
  pr: MockPR;
  files: MockFile[];
  allComments(): MockComment[];
}

/**
 * User story to test case mapping
 */
export const storyTestMapping: Record<string, { prNumber: number; testCases: string[] }[]> = {
  "S-2.1": [
    { prNumber: 2, testCases: ["CP-01", "CP-02", "CP-03"] },
    { prNumber: 3, testCases: ["CT-01", "CT-08"] },
    { prNumber: 4, testCases: ["FO-01", "FO-02"] },
    { prNumber: 7, testCases: ["TL-04"] },
    { prNumber: 10, testCases: ["EC-04", "EC-05"] },
  ],
  "S-2.3": [{ prNumber: 3, testCases: ["CT-07"] }],
  "S-2.4": [{ prNumber: 13, testCases: ["CI-01", "CI-02"] }],
  "S-2.5": [{ prNumber: 3, testCases: ["CT-02"] }],
  "S-4.2": [
    { prNumber: 5, testCases: ["IT-05"] },
    { prNumber: 15, testCases: ["MC-01", "MC-02"] },
  ],
  "S-4.7": [{ prNumber: 15, testCases: ["MC-03"] }],
  "S-4.8": [
    { prNumber: 4, testCases: ["FO-03"] },
    { prNumber: 5, testCases: ["IT-06", "IT-08", "IT-09", "IT-10"] },
  ],
  "S-4.9": [
    { prNumber: 5, testCases: ["IT-01", "IT-02", "IT-03", "IT-04", "IT-07"] },
  ],
};

/**
 * Get test data for a specific PR number
 */
export function getTestPRByNumber(prNumber: number): TestPRData | undefined {
  const prMap: Record<number, TestPRData> = {
    1: pr2CommentPositioning,
    2: pr3CommentThreading,
    3: pr4FileOperations,
    4: pr10EdgeCases,
    5: pr15MultiCommitPush,
    6: pr5IterationTracking,
    // Legacy PR numbers for reference (not in test repo):
    // 7: pr7TopLevelComments,
    // 13: pr13CommentInteractions,
  };
  return prMap[prNumber];
}
