/**
 * Tests for iteration database builder
 */

import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { buildIterationDb, createIterationDbBuilder } from "./iteration-db-builder";

describe("buildIterationDb", () => {
  it("creates a valid SQLite database with schema", () => {
    const result = buildIterationDb({
      initialFiles: {
        "src/app.ts": "const x = 1;\n",
      },
      patches: [
        `From abc123 Mon Sep 17 00:00:00 2001
From: Test User <test@example.com>
Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: [PATCH] Update value

diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1 +1 @@
-const x = 1;
+const x = 2;
`,
      ],
    });

    // Load the database
    const db = new Database(Buffer.from(result.buffer));

    // Verify schema exists
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("iterations");
    expect(tableNames).toContain("file_artifacts");
    expect(tableNames).toContain("content_blobs");
    expect(tableNames).toContain("artifact_snapshots");
    expect(tableNames).toContain("span_trackers");
    expect(tableNames).toContain("span_mappings");

    db.close();
  });

  it("creates iteration records with correct metadata", () => {
    const result = buildIterationDb({
      initialFiles: {},
      patches: [
        `From abc123 Mon Sep 17 00:00:00 2001
From: Alice <alice@example.com>
Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: [PATCH] First change

diff --git a/file.ts b/file.ts
new file mode 100644
--- /dev/null
+++ b/file.ts
@@ -0,0 +1 @@
+const a = 1;
`,
        `From def456 Mon Sep 17 00:00:00 2001
From: Bob <bob@example.com>
Date: Tue, 2 Jan 2024 11:00:00 +0000
Subject: [PATCH] Second change

diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1 +1,2 @@
 const a = 1;
+const b = 2;
`,
      ],
    });

    const db = new Database(Buffer.from(result.buffer));

    const iterations = db
      .prepare("SELECT * FROM iterations ORDER BY revision")
      .all() as {
      revision: number;
      head_sha: string;
      author: string | null;
    }[];

    expect(iterations).toHaveLength(2);
    expect(iterations[0]?.revision).toBe(1);
    expect(iterations[0]?.head_sha).toBe("abc123");
    expect(iterations[0]?.author).toBe("Alice <alice@example.com>");

    expect(iterations[1]?.revision).toBe(2);
    expect(iterations[1]?.head_sha).toBe("def456");
    expect(iterations[1]?.author).toBe("Bob <bob@example.com>");

    expect(result.meta.iterationCount).toBe(2);

    db.close();
  });

  it("stores file content with deduplication", () => {
    // Test that the same content appearing in multiple places is only stored once
    const result = buildIterationDb({
      initialFiles: {
        "file.ts": "const x = 1;\n",
      },
      patches: [
        // First patch: modify file
        `From abc123 Mon Sep 17 00:00:00 2001
From: Test <test@example.com>
Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: [PATCH] Modify file

diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-const x = 1;
+const x = 2;
`,
        // Second patch: revert to original content (should reuse existing hash)
        `From def456 Mon Sep 17 00:00:00 2001
From: Test <test@example.com>
Date: Tue, 2 Jan 2024 10:00:00 +0000
Subject: [PATCH] Revert file

diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-const x = 2;
+const x = 1;
`,
      ],
    });

    const db = new Database(Buffer.from(result.buffer));

    const blobs = db.prepare("SELECT * FROM content_blobs").all() as {
      content: string;
    }[];

    // "const x = 1;\n" appears in iteration 1 (base) and iteration 2 (after revert)
    // but should only be stored ONCE due to deduplication
    const originalContentCount = blobs.filter(
      (b) => b.content === "const x = 1;\n"
    ).length;
    expect(originalContentCount).toBe(1);

    // "const x = 2;\n" should also be stored exactly once
    const modifiedContentCount = blobs.filter(
      (b) => b.content === "const x = 2;\n"
    ).length;
    expect(modifiedContentCount).toBe(1);

    db.close();
  });

  it("creates artifact snapshots with correct indices", () => {
    const result = buildIterationDb({
      initialFiles: {
        "file.ts": "original\n",
      },
      patches: [
        `From abc123 Mon Sep 17 00:00:00 2001
From: Test <test@example.com>
Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: [PATCH] Modify file

diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-original
+modified
`,
      ],
    });

    const db = new Database(Buffer.from(result.buffer));

    // Iteration 1: snapshot 0 (left/base) and snapshot 1 (right/head)
    const snapshots = db
      .prepare(
        `SELECT s.*, b.content
       FROM artifact_snapshots s
       LEFT JOIN content_blobs b ON s.content_hash = b.content_hash
       ORDER BY s.snapshot_index`
      )
      .all() as {
      snapshot_index: number;
      file_path: string;
      content: string;
    }[];

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]?.snapshot_index).toBe(0); // Left (base)
    expect(snapshots[0]?.content).toBe("original\n");
    expect(snapshots[1]?.snapshot_index).toBe(1); // Right (head)
    expect(snapshots[1]?.content).toBe("modified\n");

    db.close();
  });

  it("computes span trackers for modified files", () => {
    const result = buildIterationDb({
      initialFiles: {
        "file.ts": "line1\nline2\n",
      },
      patches: [
        `From abc123 Mon Sep 17 00:00:00 2001
From: Test <test@example.com>
Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: [PATCH] Add line

diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,3 @@
 line1
+inserted
 line2
`,
      ],
    });

    const db = new Database(Buffer.from(result.buffer));

    // Should have a span tracker for the file
    const trackers = db.prepare("SELECT * FROM span_trackers").all() as {
      left_snapshot_index: number;
      right_snapshot_index: number;
    }[];
    expect(trackers.length).toBeGreaterThan(0);
    expect(trackers[0]?.left_snapshot_index).toBe(0);
    expect(trackers[0]?.right_snapshot_index).toBe(1);

    // Should have span mappings
    const mappings = db.prepare("SELECT * FROM span_mappings").all();
    expect(mappings.length).toBeGreaterThan(0);

    db.close();
  });

  it("handles new file creation", () => {
    const result = buildIterationDb({
      initialFiles: {},
      patches: [
        `From abc123 Mon Sep 17 00:00:00 2001
From: Test <test@example.com>
Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: [PATCH] Add new file

diff --git a/newfile.ts b/newfile.ts
new file mode 100644
--- /dev/null
+++ b/newfile.ts
@@ -0,0 +1,2 @@
+const a = 1;
+const b = 2;
`,
      ],
    });

    const db = new Database(Buffer.from(result.buffer));

    // Get all snapshots (only one artifact in this test)
    const snapshots = db
      .prepare(
        `SELECT s.snapshot_index, s.file_path, b.content
         FROM artifact_snapshots s
         LEFT JOIN content_blobs b ON s.content_hash = b.content_hash
         ORDER BY s.snapshot_index`
      )
      .all() as {
      snapshot_index: number;
      file_path: string | null;
      content: string | null;
    }[];

    // New file: should have 2 snapshots
    expect(snapshots).toHaveLength(2);
    // Left (base): file didn't exist, so null path and null content
    expect(snapshots[0]?.file_path).toBeNull();
    expect(snapshots[0]?.content).toBeNull();
    // Right (head): file created
    expect(snapshots[1]?.file_path).toBe("newfile.ts");
    expect(snapshots[1]?.content).toBe("const a = 1;\nconst b = 2;\n")

    db.close();
  });

  it("handles file deletion", () => {
    const result = buildIterationDb({
      initialFiles: {
        "deleted.ts": "old content\n",
      },
      patches: [
        `From abc123 Mon Sep 17 00:00:00 2001
From: Test <test@example.com>
Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: [PATCH] Delete file

diff --git a/deleted.ts b/deleted.ts
deleted file mode 100644
--- a/deleted.ts
+++ /dev/null
@@ -1 +0,0 @@
-old content
`,
      ],
    });

    const db = new Database(Buffer.from(result.buffer));

    const snapshots = db
      .prepare(
        `SELECT s.*, b.content
       FROM artifact_snapshots s
       LEFT JOIN content_blobs b ON s.content_hash = b.content_hash
       WHERE s.file_path = 'deleted.ts' OR s.file_path IS NULL
       ORDER BY s.snapshot_index`
      )
      .all() as {
      snapshot_index: number;
      file_path: string | null;
      content: string | null;
    }[];

    // Deleted file: left should have content, right should be null
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]?.content).toBe("old content\n"); // Left (base)
    expect(snapshots[1]?.content).toBeNull(); // Right (head) - deleted

    db.close();
  });

  it("returns correct metadata", () => {
    const result = buildIterationDb({
      initialFiles: {
        "file1.ts": "a\n",
        "file2.ts": "b\n",
      },
      patches: [
        `From abc123 Mon Sep 17 00:00:00 2001
From: Test <test@example.com>
Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: [PATCH] Change one

diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
@@ -1 +1 @@
-a
+A
`,
        `From def456 Mon Sep 17 00:00:00 2001
From: Test <test@example.com>
Date: Tue, 2 Jan 2024 10:00:00 +0000
Subject: [PATCH] Change two

diff --git a/file2.ts b/file2.ts
--- a/file2.ts
+++ b/file2.ts
@@ -1 +1 @@
-b
+B
`,
      ],
    });

    expect(result.meta.iterationCount).toBe(2);
    expect(result.meta.fileCount).toBe(2); // file1.ts and file2.ts
    expect(result.meta.snapshotCount).toBe(4); // 2 iterations * 2 files modified
  });
});

describe("createIterationDbBuilder (fluent API)", () => {
  it("builds database with fluent API", () => {
    const result = createIterationDbBuilder()
      .withInitialFiles({ "app.ts": "const x = 1;\n" })
      .withPatch(`From abc123 Mon Sep 17 00:00:00 2001
From: Test <test@example.com>
Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: [PATCH] Update

diff --git a/app.ts b/app.ts
--- a/app.ts
+++ b/app.ts
@@ -1 +1 @@
-const x = 1;
+const x = 2;
`)
      .build();

    const db = new Database(Buffer.from(result.buffer));
    const iterations = db.prepare("SELECT * FROM iterations").all();
    expect(iterations).toHaveLength(1);
    db.close();
  });

  it("supports multiple patches via chaining", () => {
    const result = createIterationDbBuilder()
      .withInitialFiles({ "app.ts": "v1\n" })
      .withPatch(`From a Mon Sep 17 00:00:00 2001
From: Test <t@t.com>
Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: [PATCH] v2

diff --git a/app.ts b/app.ts
--- a/app.ts
+++ b/app.ts
@@ -1 +1 @@
-v1
+v2
`)
      .withPatch(`From b Mon Sep 17 00:00:00 2001
From: Test <t@t.com>
Date: Tue, 2 Jan 2024 10:00:00 +0000
Subject: [PATCH] v3

diff --git a/app.ts b/app.ts
--- a/app.ts
+++ b/app.ts
@@ -1 +1 @@
-v2
+v3
`)
      .build();

    expect(result.meta.iterationCount).toBe(2);
  });
});
