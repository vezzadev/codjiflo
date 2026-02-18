/**
 * Tests for git format-patch parsing
 */

import { describe, it, expect } from "vitest";
import { parsePatch, applyPatch } from "./patch-parser";

describe("parsePatch", () => {
  it("parses a simple git format-patch with metadata", () => {
    const patch = `From abc123def456789 Mon Sep 17 00:00:00 2001
From: John Doe <john@example.com>
Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: [PATCH] Fix bug in login

diff --git a/src/login.ts b/src/login.ts
--- a/src/login.ts
+++ b/src/login.ts
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
 const z = 3;
`;

    const result = parsePatch(patch);

    expect(result.commitSha).toBe("abc123def456789");
    expect(result.author).toBe("John Doe <john@example.com>");
    expect(result.date).toBe("Mon, 1 Jan 2024 10:00:00 +0000");
    expect(result.subject).toBe("Fix bug in login");
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.oldPath).toBe("src/login.ts");
    expect(result.files[0]?.newPath).toBe("src/login.ts");
  });

  it("parses patch without git format-patch metadata", () => {
    const patch = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1 +1 @@
-const x = 1;
+const x = 2;
`;

    const result = parsePatch(patch);

    expect(result.commitSha).toBeUndefined();
    expect(result.author).toBeUndefined();
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.hunks).toHaveLength(1);
  });

  it("parses new file creation", () => {
    const patch = `diff --git a/newfile.ts b/newfile.ts
new file mode 100644
--- /dev/null
+++ b/newfile.ts
@@ -0,0 +1,2 @@
+const a = 1;
+const b = 2;
`;

    const result = parsePatch(patch);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.oldPath).toBeNull();
    expect(result.files[0]?.newPath).toBe("newfile.ts");
  });

  it("parses file deletion", () => {
    const patch = `diff --git a/deleted.ts b/deleted.ts
deleted file mode 100644
--- a/deleted.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-const a = 1;
-const b = 2;
`;

    const result = parsePatch(patch);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.oldPath).toBe("deleted.ts");
    expect(result.files[0]?.newPath).toBeNull();
  });

  it("parses multiple files in one patch", () => {
    const patch = `diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
@@ -1 +1 @@
-old1
+new1
diff --git a/file2.ts b/file2.ts
--- a/file2.ts
+++ b/file2.ts
@@ -1 +1 @@
-old2
+new2
`;

    const result = parsePatch(patch);

    expect(result.files).toHaveLength(2);
    expect(result.files[0]?.newPath).toBe("file1.ts");
    expect(result.files[1]?.newPath).toBe("file2.ts");
  });

  it("parses multiple hunks in one file", () => {
    const patch = `diff --git a/multi.ts b/multi.ts
--- a/multi.ts
+++ b/multi.ts
@@ -1,2 +1,2 @@
 line1
-line2
+modified2
@@ -10,2 +10,3 @@
 line10
+inserted
 line11
`;

    const result = parsePatch(patch);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.hunks).toHaveLength(2);
    expect(result.files[0]?.hunks[0]?.oldStart).toBe(1);
    expect(result.files[0]?.hunks[1]?.oldStart).toBe(10);
  });
});

describe("applyPatch", () => {
  it("applies a simple modification", () => {
    const files = {
      "src/app.ts": "const x = 1;\n",
    };

    const patch = parsePatch(`diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1 +1 @@
-const x = 1;
+const x = 2;
`);

    const result = applyPatch(files, patch);

    expect(result["src/app.ts"]).toBe("const x = 2;\n");
  });

  it("applies addition of lines", () => {
    const files = {
      "src/app.ts": "line1\nline3\n",
    };

    const patch = parsePatch(`diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,2 +1,3 @@
 line1
+line2
 line3
`);

    const result = applyPatch(files, patch);

    expect(result["src/app.ts"]).toBe("line1\nline2\nline3\n");
  });

  it("applies deletion of lines", () => {
    const files = {
      "src/app.ts": "line1\nline2\nline3\n",
    };

    const patch = parsePatch(`diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,2 @@
 line1
-line2
 line3
`);

    const result = applyPatch(files, patch);

    expect(result["src/app.ts"]).toBe("line1\nline3\n");
  });

  it("creates new files", () => {
    const files: { [key: string]: string } = {};

    const patch = parsePatch(`diff --git a/newfile.ts b/newfile.ts
new file mode 100644
--- /dev/null
+++ b/newfile.ts
@@ -0,0 +1,2 @@
+const a = 1;
+const b = 2;
`);

    const result = applyPatch(files, patch);

    expect(result["newfile.ts"]).toBe("const a = 1;\nconst b = 2;\n");
  });

  it("deletes files", () => {
    const files = {
      "deleted.ts": "const a = 1;\nconst b = 2;\n",
    };

    const patch = parsePatch(`diff --git a/deleted.ts b/deleted.ts
deleted file mode 100644
--- a/deleted.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-const a = 1;
-const b = 2;
`);

    const result = applyPatch(files, patch);

    expect(result["deleted.ts"]).toBeUndefined();
  });

  it("applies multiple files in one patch", () => {
    const files = {
      "file1.ts": "old1\n",
      "file2.ts": "old2\n",
    };

    const patch = parsePatch(`diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
@@ -1 +1 @@
-old1
+new1
diff --git a/file2.ts b/file2.ts
--- a/file2.ts
+++ b/file2.ts
@@ -1 +1 @@
-old2
+new2
`);

    const result = applyPatch(files, patch);

    expect(result["file1.ts"]).toBe("new1\n");
    expect(result["file2.ts"]).toBe("new2\n");
  });

  it("preserves unmodified files", () => {
    const files = {
      "modified.ts": "old\n",
      "unchanged.ts": "keep\n",
    };

    const patch = parsePatch(`diff --git a/modified.ts b/modified.ts
--- a/modified.ts
+++ b/modified.ts
@@ -1 +1 @@
-old
+new
`);

    const result = applyPatch(files, patch);

    expect(result["modified.ts"]).toBe("new\n");
    expect(result["unchanged.ts"]).toBe("keep\n");
  });

  it("applies multiple hunks correctly", () => {
    const files = {
      "multi.ts":
        "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\n",
    };

    const patch = parsePatch(`diff --git a/multi.ts b/multi.ts
--- a/multi.ts
+++ b/multi.ts
@@ -1,3 +1,3 @@
 line1
-line2
+modified2
 line3
@@ -8,3 +8,4 @@
 line8
+inserted
 line9
 line10
`);

    const result = applyPatch(files, patch);

    expect(result["multi.ts"]).toBe(
      "line1\nmodified2\nline3\nline4\nline5\nline6\nline7\nline8\ninserted\nline9\nline10\n"
    );
  });
});
