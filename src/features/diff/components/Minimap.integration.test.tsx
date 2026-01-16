/**
 * Integration tests for Minimap component
 *
 * TDD: Tests written BEFORE implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@/tests/helpers';
import { Minimap, type NavigateEvent } from './Minimap';
import type { DiffPipelineOutput } from '../hooks/pipeline/types';
import type { ParsedDiffLine, AlignedDiffLine } from '../types';
import type { ReviewThread } from '@/features/comments';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockPipeline(overrides: Partial<DiffPipelineOutput> = {}): DiffPipelineOutput {
  const defaultDiffLines: ParsedDiffLine[] = [
    { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'line 1' },
    { type: 'deletion', oldLineNumber: 2, newLineNumber: null, content: 'deleted' },
    { type: 'addition', oldLineNumber: null, newLineNumber: 2, content: 'added' },
    { type: 'context', oldLineNumber: 3, newLineNumber: 3, content: 'line 3' },
    { type: 'context', oldLineNumber: 4, newLineNumber: 4, content: 'line 4' },
    { type: 'context', oldLineNumber: 5, newLineNumber: 5, content: 'line 5' },
  ];

  const defaultAlignedLines: AlignedDiffLine[] = defaultDiffLines.map((line, index) => ({
    left: line.type !== 'addition' ? {
      type: line.type === 'deletion' ? 'deletion' : 'context',
      oldLineNumber: line.oldLineNumber,
      newLineNumber: null,
      content: line.content,
    } : null,
    right: line.type !== 'deletion' ? {
      type: line.type === 'addition' ? 'addition' : 'context',
      oldLineNumber: null,
      newLineNumber: line.newLineNumber,
      content: line.content,
    } : null,
    key: `line-${index}`,
  }));

  return {
    patch: '@@ -1,5 +1,5 @@',
    filename: 'test.ts',
    fileStatus: 'modified',
    iterationDiff: null,
    isIterationMode: false,
    diffLines: defaultDiffLines,
    sourceAlignedLines: null,
    language: 'typescript',
    isFullFileChange: false,
    alignedLines: defaultAlignedLines,
    viewMode: 'inline',
    showWhitespace: false,
    contentFilter: 'both',
    lineNumberMode: 'both',
    hunkIndices: [1],
    scrollToRowIndex: undefined,
    threadsByLineAndSide: new Map<string, ReviewThread[]>(),
    ...overrides,
  } as DiffPipelineOutput;
}

function createMockScrollContainer(): HTMLDivElement {
  const container = document.createElement('div');
  const scrollable = document.createElement('div');
  scrollable.style.overflow = 'auto';
  scrollable.setAttribute('data-testid', 'scroll-container');

  Object.defineProperty(scrollable, 'scrollHeight', { value: 1000, writable: true });
  Object.defineProperty(scrollable, 'clientHeight', { value: 500, writable: true });

  container.appendChild(scrollable);
  return container;
}

// ============================================================================
// Tests
// ============================================================================

describe('Minimap component', () => {
  let scrollContainer: HTMLDivElement;

  beforeEach(() => {
    scrollContainer = createMockScrollContainer();
    document.body.appendChild(scrollContainer);
  });

  afterEach(() => {
    document.body.removeChild(scrollContainer);
  });

  describe('rendering', () => {
    it('renders minimap with left and right bars', () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };

      render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={false}
        />
      );

      const svg = screen.getByRole('img', { name: /minimap/i });
      expect(svg).toBeInTheDocument();
    });

    it('renders deletion regions on left bar', () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };

      const { container } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={false}
        />
      );

      // Should have deletion highlight rect on left bar
      const deletionRects = container.querySelectorAll('.minimap-deletion');
      expect(deletionRects.length).toBeGreaterThan(0);
    });

    it('renders addition regions on right bar', () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };

      const { container } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={false}
        />
      );

      // Should have addition highlight rect on right bar
      const additionRects = container.querySelectorAll('.minimap-addition');
      expect(additionRects.length).toBeGreaterThan(0);
    });
  });

  describe('lasso visibility', () => {
    it('shows lasso in full-file mode without comments', () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };

      const { container } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={false}
        />
      );

      const lasso = container.querySelector('.minimap-lasso');
      expect(lasso).toBeInTheDocument();
    });

    it('hides lasso in changes-only mode', () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };

      const { container } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={false}
          hasInlineComments={false}
        />
      );

      const lasso = container.querySelector('.minimap-lasso');
      expect(lasso).not.toBeInTheDocument();
    });

    it('hides lasso when inline comments are present', () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };

      const { container } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={true}
        />
      );

      const lasso = container.querySelector('.minimap-lasso');
      expect(lasso).not.toBeInTheDocument();
    });
  });

  describe('click navigation', () => {
    it('calls onNavigate with left side on left bar click', () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };
      const onNavigate = vi.fn();

      render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={false}
          onNavigate={onNavigate}
        />
      );

      const svg = screen.getByRole('img', { name: /minimap/i });
      fireEvent.click(svg, { clientX: 15, clientY: 100 });

      expect(onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ side: 'left' })
      );
    });

    it('calls onNavigate with right side on right bar click', () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };
      const onNavigate = vi.fn();

      render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={false}
          onNavigate={onNavigate}
        />
      );

      const svg = screen.getByRole('img', { name: /minimap/i });
      fireEvent.click(svg, { clientX: 45, clientY: 100 });

      expect(onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ side: 'right' })
      );
    });

    it('scrolls to bottom when clicking at bottom of bar (scroll ratio)', () => {
      // This test verifies the scroll ratio calculation:
      // Clicking at bottom of bar (Y = barTop + barHeight) should scroll to maxScroll
      const pipeline = createMockPipeline();
      const scrollable = scrollContainer.querySelector('[style*="overflow"]') as HTMLDivElement;

      // Setup scrollable with known dimensions
      Object.defineProperty(scrollable, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(scrollable, 'clientHeight', { value: 500, writable: true });
      scrollable.scrollTop = 0;

      const containerRef = { current: scrollContainer };

      const { container } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={false}
        />
      );

      const svg = container.querySelector('svg') as SVGSVGElement;

      // Mock getBoundingClientRect to return known bounds
      const originalGetBoundingClientRect = svg.getBoundingClientRect;
      svg.getBoundingClientRect = () => ({
        top: 0,
        left: 0,
        bottom: 500,
        right: 60,
        width: 60,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      // For containerHeight=500 with PADDING_VERTICAL=10:
      // renderAreaHeight = 500 - 2*10 = 480
      // barTop = 10 (renderAreaTop)
      // For equal line counts, both bars have height = 480
      // Bottom of bar: y = barTop + barHeight = 10 + 480 = 490
      // Click at bottom of right bar: clientX=45, clientY=490
      fireEvent.click(svg, { clientX: 45, clientY: 490 });

      // maxScroll = scrollHeight - clientHeight = 1000 - 500 = 500
      // At ratio=1.0 (bottom of bar), scrollTop should be 500
      expect(scrollable.scrollTop).toBe(500);

      // Restore
      svg.getBoundingClientRect = originalGetBoundingClientRect;
    });

    it('scrolls to top when clicking at top of bar', () => {
      const pipeline = createMockPipeline();
      const scrollable = scrollContainer.querySelector('[style*="overflow"]') as HTMLDivElement;

      // Setup scrollable with known dimensions, start scrolled down
      Object.defineProperty(scrollable, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(scrollable, 'clientHeight', { value: 500, writable: true });
      scrollable.scrollTop = 250; // Start in the middle

      const containerRef = { current: scrollContainer };

      const { container } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={false}
        />
      );

      const svg = container.querySelector('svg') as SVGSVGElement;

      svg.getBoundingClientRect = () => ({
        top: 0,
        left: 0,
        bottom: 500,
        right: 60,
        width: 60,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      // Top of bar: y = barTop = 10 (PADDING_VERTICAL)
      // Click at top of right bar: clientX=45, clientY=10
      fireEvent.click(svg, { clientX: 45, clientY: 10 });

      // At ratio=0.0 (top of bar), scrollTop should be 0
      expect(scrollable.scrollTop).toBe(0);
    });

    it('scrolls to middle when clicking at middle of bar', () => {
      const pipeline = createMockPipeline();
      const scrollable = scrollContainer.querySelector('[style*="overflow"]') as HTMLDivElement;

      Object.defineProperty(scrollable, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(scrollable, 'clientHeight', { value: 500, writable: true });
      scrollable.scrollTop = 0;

      const containerRef = { current: scrollContainer };

      const { container } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={false}
        />
      );

      const svg = container.querySelector('svg') as SVGSVGElement;

      svg.getBoundingClientRect = () => ({
        top: 0,
        left: 0,
        bottom: 500,
        right: 60,
        width: 60,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      // For barTop=10, barHeight=480, middle = 10 + 240 = 250
      fireEvent.click(svg, { clientX: 45, clientY: 250 });

      // At ratio=0.5 (middle of bar), scrollTop should be 250 (0.5 * 500)
      expect(scrollable.scrollTop).toBe(250);
    });
  });

  describe('drag navigation', () => {
    it('enables drag when no inline comments', () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };
      const onNavigate = vi.fn();

      render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={false}
          onNavigate={onNavigate}
        />
      );

      const svg = screen.getByRole('img', { name: /minimap/i });

      // Start drag
      fireEvent.mouseDown(svg, { clientX: 30, clientY: 100 });

      // Move mouse
      fireEvent.mouseMove(svg, { clientX: 30, clientY: 200 });

      // Should call navigate during drag
      expect(onNavigate).toHaveBeenCalled();
    });

    it('disables drag when inline comments present', () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };
      const onNavigate = vi.fn();

      render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={true}
          onNavigate={onNavigate}
        />
      );

      const svg = screen.getByRole('img', { name: /minimap/i });

      // Try to drag
      fireEvent.mouseDown(svg, { clientX: 30, clientY: 100 });
      fireEvent.mouseMove(svg, { clientX: 30, clientY: 200 });

      // Should NOT call navigate during drag (only click works)
      // Note: click might still work, but drag should not
      // The onNavigate might be called once for the mouseDown acting as click
      const dragMoveCallCount = onNavigate.mock.calls.filter(
        (call) => (call as [NavigateEvent])[0].type === 'drag'
      ).length;
      expect(dragMoveCallCount).toBe(0);
    });
  });

  describe('content filter', () => {
    it('grays out left bar when filter is right-only', () => {
      const pipeline = createMockPipeline({ contentFilter: 'right' });
      const containerRef = { current: scrollContainer };

      const { container } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={false}
        />
      );

      const leftBar = container.querySelector('.minimap-bar-left');
      expect(leftBar).toHaveClass('minimap-bar-disabled');
    });

    it('grays out right bar when filter is left-only', () => {
      const pipeline = createMockPipeline({ contentFilter: 'left' });
      const containerRef = { current: scrollContainer };

      const { container } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={false}
        />
      );

      const rightBar = container.querySelector('.minimap-bar-right');
      expect(rightBar).toHaveClass('minimap-bar-disabled');
    });
  });

  describe('side-by-side mode', () => {
    it('uses alignedLines for region calculation in side-by-side mode', () => {
      const pipeline = createMockPipeline({ viewMode: 'split' });
      const containerRef = { current: scrollContainer };

      const { container } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          hasInlineComments={false}
        />
      );

      // Should still render deletion and addition regions
      const deletionRects = container.querySelectorAll('.minimap-deletion');
      const additionRects = container.querySelectorAll('.minimap-addition');
      expect(deletionRects.length + additionRects.length).toBeGreaterThan(0);
    });
  });
});
