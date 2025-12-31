import { describe, it, expect } from 'vitest';
import { parsePatch, detectLanguage } from './parse-patch';

describe('parsePatch', () => {
  it('returns empty array for empty patch', () => {
    expect(parsePatch('')).toEqual([]);
  });

  it('parses a simple unified diff', () => {
    const patch = `@@ -1,3 +1,4 @@
 line 1
-removed line
+added line
+another added line
 line 3`;

    const result = parsePatch(patch);

    expect(result).toHaveLength(6);
    expect(result[0]).toEqual({
      type: 'header',
      content: '@@ -1,3 +1,4 @@',
      oldLineNumber: null,
      newLineNumber: null,
    });
    expect(result[1]).toEqual({
      type: 'context',
      content: 'line 1',
      oldLineNumber: 1,
      newLineNumber: 1,
    });
    expect(result[2]).toEqual({
      type: 'deletion',
      content: 'removed line',
      oldLineNumber: 2,
      newLineNumber: null,
    });
    expect(result[3]).toEqual({
      type: 'addition',
      content: 'added line',
      oldLineNumber: null,
      newLineNumber: 2,
    });
    expect(result[4]).toEqual({
      type: 'addition',
      content: 'another added line',
      oldLineNumber: null,
      newLineNumber: 3,
    });
    expect(result[5]).toEqual({
      type: 'context',
      content: 'line 3',
      oldLineNumber: 3,
      newLineNumber: 4,
    });
  });

  it('handles multiple hunks', () => {
    const patch = `@@ -1,2 +1,2 @@
 first
-old
+new
@@ -10,2 +10,3 @@
 context
+added`;

    const result = parsePatch(patch);

    expect(result.filter(l => l.type === 'header')).toHaveLength(2);
    expect(result[0]?.newLineNumber).toBeNull(); // header
    expect(result[4]?.newLineNumber).toBeNull(); // second header
  });

  it('preserves indentation', () => {
    const patch = `@@ -1,1 +1,1 @@
-    indented content
+    new indented content`;

    const result = parsePatch(patch);

    expect(result[1]?.content).toBe('    indented content');
    expect(result[2]?.content).toBe('    new indented content');
  });

  it('handles malformed hunk header without updating line numbers', () => {
    // A line starting with @@ but not matching the expected format
    const patch = `@@ malformed header @@
 context line`;

    const result = parsePatch(patch);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: 'header',
      content: '@@ malformed header @@',
      oldLineNumber: null,
      newLineNumber: null,
    });
    // Line numbers should stay at initial value (0) since header didn't parse
    expect(result[1]).toEqual({
      type: 'context',
      content: 'context line',
      oldLineNumber: 0,
      newLineNumber: 0,
    });
  });

  it('handles context lines that do not start with space', () => {
    // Edge case: context line without leading space (can happen in some diff outputs)
    const patch = `@@ -1,2 +1,2 @@
 normal context
context without space
-deleted
+added`;

    const result = parsePatch(patch);

    expect(result).toHaveLength(5);
    // First context line (has leading space)
    expect(result[1]?.content).toBe('normal context');
    expect(result[1]?.type).toBe('context');
    // Second context line (no leading space - should preserve content as-is)
    expect(result[2]?.content).toBe('context without space');
    expect(result[2]?.type).toBe('context');
    expect(result[2]?.oldLineNumber).toBe(2);
    expect(result[2]?.newLineNumber).toBe(2);
  });

  it('handles "No newline at end of file" marker', () => {
    const patch = `@@ -1,2 +1,2 @@
 line 1
-old last line
\\ No newline at end of file
+new last line
\\ No newline at end of file`;

    const result = parsePatch(patch);

    // The backslash lines should be parsed as context lines
    expect(result.some(l => l.content.includes('No newline at end of file'))).toBe(true);
  });

  it('correctly tracks line numbers across additions and deletions', () => {
    // Hunk header: old file lines 5-8 (4 lines), new file lines 5-10 (6 lines)
    // Old file: line 5 (context), lines 6-7 (deleted), line 8 (context)
    // New file: line 5 (context), lines 6-9 (added), line 10 (context)
    const patch = `@@ -5,4 +5,6 @@
 context at old:5 new:5
-deleted at old:6
-deleted at old:7
+added at new:6
+added at new:7
+added at new:8
+added at new:9
 context at old:8 new:10`;

    const result = parsePatch(patch);

    // Verify old line numbers for deletions (6 and 7 in original file)
    const deletions = result.filter(l => l.type === 'deletion');
    expect(deletions).toHaveLength(2);
    expect(deletions[0]?.oldLineNumber).toBe(6);
    expect(deletions[1]?.oldLineNumber).toBe(7);

    // Verify new line numbers for additions (6, 7, 8, 9 in new file)
    const additions = result.filter(l => l.type === 'addition');
    expect(additions).toHaveLength(4);
    expect(additions[0]?.newLineNumber).toBe(6);
    expect(additions[1]?.newLineNumber).toBe(7);
    expect(additions[2]?.newLineNumber).toBe(8);
    expect(additions[3]?.newLineNumber).toBe(9);

    // Verify final context line has correct numbers:
    // In old file: line 8 (the 4th line of the hunk: 5, 6, 7, 8)
    // In new file: line 10 (after 4 additions replacing 2 deletions: 5 + (4 additions) + 1 = 10)
    const lastContext = result[result.length - 1];
    expect(lastContext?.type).toBe('context');
    expect(lastContext?.oldLineNumber).toBe(8);
    expect(lastContext?.newLineNumber).toBe(10);
  });

  it('handles hunk headers with single line count (no comma)', () => {
    // GitHub sometimes omits the count when it's 1
    const patch = `@@ -1 +1 @@
-old single
+new single`;

    const result = parsePatch(patch);

    expect(result).toHaveLength(3);
    expect(result[0]?.type).toBe('header');
    expect(result[1]?.oldLineNumber).toBe(1);
    expect(result[2]?.newLineNumber).toBe(1);
  });
});

describe('detectLanguage', () => {
  it('detects TypeScript files', () => {
    expect(detectLanguage('file.ts')).toBe('typescript');
    expect(detectLanguage('component.tsx')).toBe('typescript');
  });

  it('detects JavaScript files', () => {
    expect(detectLanguage('file.js')).toBe('javascript');
    expect(detectLanguage('component.jsx')).toBe('javascript');
    expect(detectLanguage('config.mjs')).toBe('javascript');
    expect(detectLanguage('config.cjs')).toBe('javascript');
  });

  it('detects Python files', () => {
    expect(detectLanguage('script.py')).toBe('python');
    expect(detectLanguage('winscript.pyw')).toBe('python');
  });

  it('detects web files', () => {
    expect(detectLanguage('index.html')).toBe('html');
    expect(detectLanguage('page.htm')).toBe('html');
    expect(detectLanguage('styles.css')).toBe('css');
    expect(detectLanguage('styles.scss')).toBe('css');
    expect(detectLanguage('styles.less')).toBe('css');
    expect(detectLanguage('data.json')).toBe('json');
    expect(detectLanguage('config.xml')).toBe('xml');
    expect(detectLanguage('config.yaml')).toBe('yaml');
    expect(detectLanguage('config.yml')).toBe('yaml');
  });

  it('detects JVM and .NET languages', () => {
    expect(detectLanguage('Main.java')).toBe('java');
    expect(detectLanguage('Main.kt')).toBe('kotlin');
    expect(detectLanguage('Program.cs')).toBe('csharp');
  });

  it('detects systems programming languages', () => {
    expect(detectLanguage('main.go')).toBe('go');
    expect(detectLanguage('main.rs')).toBe('rust');
    expect(detectLanguage('main.c')).toBe('c');
    expect(detectLanguage('main.cpp')).toBe('cpp');
    expect(detectLanguage('header.h')).toBe('c');
    expect(detectLanguage('header.hpp')).toBe('cpp');
    expect(detectLanguage('app.swift')).toBe('swift');
  });

  it('detects scripting languages', () => {
    expect(detectLanguage('app.rb')).toBe('ruby');
    expect(detectLanguage('app.php')).toBe('php');
    expect(detectLanguage('script.sh')).toBe('bash');
    expect(detectLanguage('script.bash')).toBe('bash');
    expect(detectLanguage('script.zsh')).toBe('bash');
  });

  it('detects SQL and markdown files', () => {
    expect(detectLanguage('query.sql')).toBe('sql');
    expect(detectLanguage('README.md')).toBe('markdown');
    expect(detectLanguage('docs.markdown')).toBe('markdown');
  });

  it('returns plaintext for unknown extensions', () => {
    expect(detectLanguage('file.unknown')).toBe('plaintext');
    expect(detectLanguage('file')).toBe('plaintext');
  });

  it('handles case insensitivity', () => {
    expect(detectLanguage('FILE.TS')).toBe('typescript');
    expect(detectLanguage('FILE.PY')).toBe('python');
    expect(detectLanguage('FILE.JAVA')).toBe('java');
    expect(detectLanguage('FILE.RS')).toBe('rust');
  });

  it('handles files with multiple dots in name', () => {
    expect(detectLanguage('component.test.ts')).toBe('typescript');
    expect(detectLanguage('config.local.json')).toBe('json');
    expect(detectLanguage('styles.module.css')).toBe('css');
  });

  it('handles empty filename', () => {
    expect(detectLanguage('')).toBe('plaintext');
  });
});
