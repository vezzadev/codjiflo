import { describe, it, expect } from 'vitest';
import { parsePatch, detectLanguage } from './parse-patch';

describe('parsePatch', () => {
  it('returns empty array for empty patch', () => {
    expect(parsePatch('')).toEqual([]);
  });

  it('parses a simple inline diff', () => {
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
});

describe('detectLanguage', () => {
  // detectLanguage returns the file extension, which Shiki resolves via its alias system
  // (e.g., 'ts' → 'typescript', 'py' → 'python')

  it('returns file extension for TypeScript and TSX files', () => {
    expect(detectLanguage('file.ts')).toBe('ts');
    expect(detectLanguage('component.tsx')).toBe('tsx');
  });

  it('returns file extension for JavaScript and JSX files', () => {
    expect(detectLanguage('file.js')).toBe('js');
    expect(detectLanguage('component.jsx')).toBe('jsx');
    expect(detectLanguage('config.mjs')).toBe('mjs');
    expect(detectLanguage('utils.cjs')).toBe('cjs');
  });

  it('returns file extension for other languages', () => {
    expect(detectLanguage('script.py')).toBe('py');
    expect(detectLanguage('index.html')).toBe('html');
    expect(detectLanguage('styles.css')).toBe('css');
    expect(detectLanguage('data.json')).toBe('json');
  });

  it('returns txt for files without extension', () => {
    expect(detectLanguage('Makefile')).toBe('txt');
    expect(detectLanguage('Dockerfile')).toBe('txt');
  });

  it('returns extension even for unknown types (Shiki handles fallback)', () => {
    // Unknown extensions are still returned - Shiki will fall back to plaintext
    expect(detectLanguage('file.xyz')).toBe('xyz');
  });

  it('handles case insensitivity', () => {
    expect(detectLanguage('FILE.TS')).toBe('ts');
    expect(detectLanguage('FILE.PY')).toBe('py');
  });
});
