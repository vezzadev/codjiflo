/**
 * Git Format-Patch Parser
 *
 * Parses git format-patch output including metadata (author, date, commit SHA)
 * and applies patches to file contents.
 */

// ============================================================================
// Types
// ============================================================================

export interface ParsedPatch {
  /** Commit SHA extracted from "From <sha>" line */
  commitSha?: string;
  /** Author from "From:" header */
  author?: string;
  /** Date from "Date:" header */
  date?: string;
  /** Subject from "Subject:" header (without [PATCH] prefix) */
  subject?: string;
  /** File changes in this patch */
  files: ParsedFileDiff[];
}

export interface ParsedFileDiff {
  /** Original file path (null for new files) */
  oldPath: string | null;
  /** New file path (null for deleted files) */
  newPath: string | null;
  /** Hunks of changes */
  hunks: ParsedHunk[];
}

export interface ParsedHunk {
  /** Start line in old file (1-based) */
  oldStart: number;
  /** Number of lines in old file */
  oldLines: number;
  /** Start line in new file (1-based) */
  newStart: number;
  /** Number of lines in new file */
  newLines: number;
  /** Individual lines in the hunk */
  lines: HunkLine[];
}

export interface HunkLine {
  type: "context" | "addition" | "deletion";
  content: string;
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Parse a git format-patch string into structured data.
 * Supports both full format-patch output and plain unified diffs.
 */
export function parsePatch(patch: string): ParsedPatch {
  const lines = patch.split("\n");
  const result: ParsedPatch = {
    files: [],
  };

  let i = 0;

  // Parse git format-patch header (optional)
  // Line 1: "From <sha> Mon Sep 17 00:00:00 2001"
  if (lines[0]?.startsWith("From ")) {
    const match = /^From\s+([a-f0-9]+)\s/.exec(lines[0]);
    if (match?.[1]) {
      result.commitSha = match[1];
    }
    i++;

    // Parse email-style headers
    while (i < lines.length && !lines[i]?.startsWith("diff ")) {
      const line = lines[i] ?? "";

      if (line.startsWith("From: ")) {
        result.author = line.slice(6).trim();
      } else if (line.startsWith("Date: ")) {
        result.date = line.slice(6).trim();
      } else if (line.startsWith("Subject: ")) {
        let subject = line.slice(9).trim();
        // Remove [PATCH] prefix if present
        subject = subject.replace(/^\[PATCH[^\]]*\]\s*/, "");
        result.subject = subject;
      }
      i++;
    }
  }

  // Parse diff sections
  while (i < lines.length) {
    const line = lines[i];
    if (!line?.startsWith("diff --git ")) {
      i++;
      continue;
    }

    // Parse one file diff
    const fileDiff = parseFileDiff(lines, i);
    if (fileDiff) {
      result.files.push(fileDiff.diff);
      i = fileDiff.nextIndex;
    } else {
      i++;
    }
  }

  return result;
}

interface FileDiffResult {
  diff: ParsedFileDiff;
  nextIndex: number;
}

function parseFileDiff(
  lines: string[],
  startIndex: number
): FileDiffResult | null {
  let i = startIndex;
  const diffLine = lines[i];
  if (!diffLine?.startsWith("diff --git ")) {
    return null;
  }
  i++;

  let oldPath: string | null = null;
  let newPath: string | null = null;
  const hunks: ParsedHunk[] = [];

  // Skip optional metadata lines (index, new file mode, deleted file mode)
  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }

    if (line.startsWith("---")) {
      // Parse old path
      oldPath = extractPath(line);
      i++;
    } else if (line.startsWith("+++")) {
      // Parse new path
      newPath = extractPath(line);
      i++;
    } else if (line.startsWith("@@")) {
      // Parse hunk
      const hunkResult = parseHunk(lines, i);
      if (hunkResult) {
        hunks.push(hunkResult.hunk);
        i = hunkResult.nextIndex;
      } else {
        i++;
      }
    } else if (
      line.startsWith("diff --git ") ||
      line.startsWith("From ") ||
      (line.length > 0 && !(/^(index|new file|deleted file|old mode|new mode|similarity|rename|copy|Binary)/.exec(line)))
    ) {
      // Start of next file diff or end of this diff
      if (line.startsWith("diff --git ")) {
        break;
      }
      i++;
    } else {
      i++;
    }
  }

  return {
    diff: { oldPath, newPath, hunks },
    nextIndex: i,
  };
}

function extractPath(line: string): string | null {
  // Handle --- a/path or +++ b/path format
  // Also handle --- /dev/null or +++ /dev/null
  const match = /^[-+]{3}\s+(?:[ab]\/)?(.+)$/.exec(line);
  if (match) {
    const path = match[1]?.trim();
    if (path === "/dev/null" || path === "dev/null") {
      return null;
    }
    return path ?? null;
  }
  return null;
}

interface HunkResult {
  hunk: ParsedHunk;
  nextIndex: number;
}

function parseHunk(lines: string[], startIndex: number): HunkResult | null {
  const headerLine = lines[startIndex];
  if (!headerLine?.startsWith("@@")) {
    return null;
  }

  // Parse @@ -oldStart,oldLines +newStart,newLines @@
  const match = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(headerLine);
  if (!match) {
    return null;
  }

  const oldStart = parseInt(match[1] ?? "0", 10);
  const oldLines = parseInt(match[2] ?? "1", 10);
  const newStart = parseInt(match[3] ?? "0", 10);
  const newLines = parseInt(match[4] ?? "1", 10);

  const hunkLines: HunkLine[] = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) {
      i++;
      continue;
    }

    // Check for end of hunk
    if (
      line.startsWith("@@") ||
      line.startsWith("diff --git ") ||
      line.startsWith("From ")
    ) {
      break;
    }

    // Handle empty line at end of file
    if (line === "" && i === lines.length - 1) {
      break;
    }

    const firstChar = line[0];
    if (firstChar === "+") {
      hunkLines.push({ type: "addition", content: line.slice(1) });
    } else if (firstChar === "-") {
      hunkLines.push({ type: "deletion", content: line.slice(1) });
    } else if (firstChar === " " || firstChar === undefined) {
      hunkLines.push({ type: "context", content: line.slice(1) });
    } else if (line.startsWith("\\ No newline at end of file")) {
      // Skip this marker
    } else {
      // Unknown line format, might be end of hunk
      break;
    }

    i++;
  }

  return {
    hunk: { oldStart, oldLines, newStart, newLines, lines: hunkLines },
    nextIndex: i,
  };
}

// ============================================================================
// Patch Application
// ============================================================================

/**
 * Apply a parsed patch to a set of files.
 * Returns a new object with the updated file contents.
 */
export function applyPatch(
  files: Record<string, string>,
  patch: ParsedPatch
): Record<string, string> {
  const result = { ...files };

  for (const fileDiff of patch.files) {
    applyFileDiff(result, fileDiff);
  }

  return result;
}

function applyFileDiff(
  files: Record<string, string>,
  fileDiff: ParsedFileDiff
): void {
  // Handle file deletion
  if (fileDiff.newPath === null && fileDiff.oldPath !== null) {
    // Use Reflect.deleteProperty to avoid eslint no-dynamic-delete
    Reflect.deleteProperty(files, fileDiff.oldPath);
    return;
  }

  // Handle new file creation
  if (fileDiff.oldPath === null && fileDiff.newPath !== null) {
    const newContent = fileDiff.hunks
      .flatMap((h) =>
        h.lines.filter((l) => l.type !== "deletion").map((l) => l.content)
      )
      .join("\n") + "\n";
    files[fileDiff.newPath] = newContent;
    return;
  }

  // Handle modification
  const path = fileDiff.newPath ?? fileDiff.oldPath;
  if (!path) return;

  const originalContent = files[path] ?? "";
  const originalLines = originalContent.split("\n");

  // Remove trailing empty line if content ends with newline
  if (originalLines[originalLines.length - 1] === "") {
    originalLines.pop();
  }

  // Apply hunks in reverse order to preserve line numbers
  const sortedHunks = [...fileDiff.hunks].sort(
    (a, b) => b.oldStart - a.oldStart
  );

  for (const hunk of sortedHunks) {
    applyHunk(originalLines, hunk);
  }

  files[path] = originalLines.join("\n") + "\n";
}

function applyHunk(lines: string[], hunk: ParsedHunk): void {
  // Calculate the index to start at (0-based)
  const startIndex = hunk.oldStart - 1;

  // Collect the new lines for this hunk
  const newHunkLines: string[] = [];
  let deleteCount = 0;

  for (const line of hunk.lines) {
    if (line.type === "context" || line.type === "addition") {
      newHunkLines.push(line.content);
    }
    if (line.type === "context" || line.type === "deletion") {
      deleteCount++;
    }
  }

  // Replace the old lines with new lines
  lines.splice(startIndex, deleteCount, ...newHunkLines);
}
