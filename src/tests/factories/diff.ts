import { FileChange, FileChangeStatus } from '@/api/types';
import type { ParsedDiffLine } from '@/features/diff/types';

let fileCounter = 0;

export function createMockFileChange(overrides: Partial<FileChange> = {}): FileChange {
  fileCounter++;
  return {
    filename: `src/file${fileCounter}.ts`,
    status: FileChangeStatus.Modified,
    additions: 10,
    deletions: 5,
    changes: 15,
    patch: `@@ -1,5 +1,7 @@
 import { foo } from 'bar';

-const oldValue = 'old';
+const newValue = 'new';
+const anotherValue = 'added';

 export default function() {}`,
    ...overrides,
  };
}

export function createMockDiffLine(overrides: Partial<ParsedDiffLine> = {}): ParsedDiffLine {
  return {
    type: 'context',
    content: 'const example = true;',
    oldLineNumber: 1,
    newLineNumber: 1,
    ...overrides,
  };
}

export function createMockAddedLine(lineNumber: number, content: string): ParsedDiffLine {
  return {
    type: 'addition',
    content,
    oldLineNumber: null,
    newLineNumber: lineNumber,
  };
}

export function createMockDeletedLine(lineNumber: number, content: string): ParsedDiffLine {
  return {
    type: 'deletion',
    content,
    oldLineNumber: lineNumber,
    newLineNumber: null,
  };
}

export function resetDiffFactoryCounters() {
  fileCounter = 0;
}
