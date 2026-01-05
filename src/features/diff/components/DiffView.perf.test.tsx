/**
 * Performance regression tests for DiffView
 *
 * These tests verify that memoization is correctly applied to prevent
 * unnecessary re-renders.
 */
import { describe, it, expect } from 'vitest';
import { DiffLine, DiffLineSpacer } from './DiffLine';

describe('DiffView Performance - Memoization', () => {
  describe('DiffLine memoization', () => {
    it('DiffLine should be wrapped with React.memo', () => {
      // React.memo components have a $$typeof of Symbol(react.memo)
      // and a 'compare' property (even if null)
      // The 'type' property contains the wrapped component
      expect(DiffLine).toHaveProperty('$$typeof');
      expect(String(DiffLine.$$typeof)).toContain('memo');
    });

    it('DiffLineSpacer should be wrapped with React.memo', () => {
      expect(DiffLineSpacer).toHaveProperty('$$typeof');
      expect(String(DiffLineSpacer.$$typeof)).toContain('memo');
    });
  });

  describe('UnifiedDiffTable memoization', () => {
    it('should export a memoized component', async () => {
      // We can't easily test internal components, but we can verify
      // that the file structure includes memo imports
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, './DiffView.tsx'),
        'utf-8'
      );

      // Verify memo is imported
      expect(content).toMatch(/import\s*{[^}]*memo[^}]*}\s*from\s*['"]react['"]/);

      // Verify UnifiedDiffTable uses memo
      expect(content).toMatch(/const\s+UnifiedDiffTable\s*=\s*memo\s*\(/);
    });
  });

  describe('Callback memoization', () => {
    it('should have memoized callbacks for UnifiedDiffTable', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, './DiffView.tsx'),
        'utf-8'
      );

      // Verify callbacks are wrapped with useCallback
      expect(content).toMatch(/const\s+handleStartCommentRight\s*=\s*useCallback/);
      expect(content).toMatch(/const\s+handleSubmitDraftUnified\s*=\s*useCallback/);
      expect(content).toMatch(/const\s+handleSubmitDraftSideBySide\s*=\s*useCallback/);

      // Verify no inline arrow functions for these callbacks in JSX
      // (this would indicate unmemoized callbacks)
      expect(content).not.toMatch(/onStartComment={\s*\(index\)\s*=>/);
      expect(content).not.toMatch(/onSubmitDraft={\s*\(\)\s*=>\s*{/);
    });
  });
});
