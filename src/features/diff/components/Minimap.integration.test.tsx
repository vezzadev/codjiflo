/**
 * Integration tests for Minimap component
 *
 * TDD: Tests written BEFORE implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@/tests/helpers';
import { Minimap, type NavigateEvent } from './Minimap';
import type { DiffPipelineOutput } from '../hooks/pipeline/types';
import type { ParsedDiffLine, AlignedDiffLine } from '../types';
import type { ReviewThread } from '@/features/comments';

// ============================================================================
// Type-safe helpers
// ============================================================================

/** Assert element exists and return it with proper type narrowing */
function assertElement<T extends Element>(element: T | null, message: string): T {
  if (!element) throw new Error(message);
  return element;
}

/**
 * Wait for useMinimapScroll's scroll stabilization to complete.
 *
 * The hook requires 2 stable frames before reporting metrics:
 * - Frame 1: Sets lastScrollHeight
 * - Frame 2: stableFrameCount = 1
 * - Frame 3: stableFrameCount = 2, triggers state update
 *
 * Must be wrapped in act() to handle React state updates.
 */
async function waitForRAF(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
  });
}

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

/** Create a default visible row range covering all rows */
function createVisibleRowRange(rowCount: number) {
  return { startIndex: 0, stopIndex: rowCount - 1 };
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
          showComments={false}
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
          showComments={false}
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
          showComments={false}
        />
      );

      // Should have addition highlight rect on right bar
      const additionRects = container.querySelectorAll('.minimap-addition');
      expect(additionRects.length).toBeGreaterThan(0);
    });
  });

  describe('lasso visibility', () => {
    it('shows lasso when comments are hidden (showComments=false) in full-file mode', async () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };

      const { container } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
          visibleRowRange={createVisibleRowRange(pipeline.diffLines.length)}
        />
      );

      // Wait for useMinimapScroll's rAF-based initialization
      await waitForRAF();

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
          showComments={false}
        />
      );

      const lasso = container.querySelector('.minimap-lasso');
      expect(lasso).not.toBeInTheDocument();
    });

    it('hides lasso when comments are shown (showComments=true)', () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };

      const { container } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={true}
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
          showComments={false}
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
          showComments={false}
          onNavigate={onNavigate}
        />
      );

      const svg = screen.getByRole('img', { name: /minimap/i });
      fireEvent.click(svg, { clientX: 45, clientY: 100 });

      expect(onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ side: 'right' })
      );
    });

    it('click positions lasso center at click point (scrolls to bottom)', async () => {
      // This test verifies lasso-center positioning:
      // Click uses formula: ratio = (y - barTop - lassoHeight/2) / (barHeight - lassoHeight)
      const pipeline = createMockPipeline();
      const scrollable = assertElement(scrollContainer.querySelector<HTMLElement>('[style*="overflow"]'), 'scrollable element not found');

      // Setup scrollable: viewportRatio = 500/1000 = 0.5
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
          showComments={false}
        />
      );

      // Wait for useMinimapScroll's rAF-based scroll element detection
      await waitForRAF();

      // Trigger scroll event to update scroll state
      fireEvent.scroll(scrollable);
      await vi.waitFor(() => { /* Allow React to process scroll event */ });

      const svg = assertElement(container.querySelector<SVGSVGElement>('svg'), 'svg element not found');

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

      // For containerHeight=500, PADDING_VERTICAL=10:
      // renderAreaHeight = 480, barTop = 10
      // viewportRatio = 0.5, lassoHeight = 0.5 * 480 = 240
      // lassoMoveRange = 480 - 240 = 240
      // Formula: ratio = (y - 10 - 120) / 240 = (y - 130) / 240
      //
      // For ratio=1.0 (scroll to bottom): y = 130 + 240 = 370
      fireEvent.click(svg, { clientX: 45, clientY: 370 });

      // maxScroll = 1000 - 500 = 500, scrollTop = 1.0 * 500 = 500
      expect(scrollable.scrollTop).toBe(500);
    });

    it('click positions lasso center at click point (scrolls to top)', async () => {
      const pipeline = createMockPipeline();
      const scrollable = assertElement(scrollContainer.querySelector<HTMLElement>('[style*="overflow"]'), 'scrollable element not found');

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
          showComments={false}
        />
      );

      // Wait for useMinimapScroll's rAF-based scroll element detection
      await waitForRAF();

      fireEvent.scroll(scrollable);
      await vi.waitFor(() => { /* Allow React to process scroll event */ });

      const svg = assertElement(container.querySelector<SVGSVGElement>('svg'), 'svg element not found');

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

      // For ratio=0 (scroll to top): y = 130
      fireEvent.click(svg, { clientX: 45, clientY: 130 });

      expect(scrollable.scrollTop).toBe(0);
    });

    it('click positions lasso center at click point (scrolls to middle)', async () => {
      const pipeline = createMockPipeline();
      const scrollable = assertElement(scrollContainer.querySelector<HTMLElement>('[style*="overflow"]'), 'scrollable element not found');

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
          showComments={false}
        />
      );

      fireEvent.scroll(scrollable);
      await vi.waitFor(() => { /* Allow React to process scroll event */ });

      const svg = assertElement(container.querySelector<SVGSVGElement>('svg'), 'svg element not found');

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

      // For ratio=0.5 (scroll to middle): y = 130 + 120 = 250
      fireEvent.click(svg, { clientX: 45, clientY: 250 });

      // scrollTop = 0.5 * 500 = 250
      expect(scrollable.scrollTop).toBe(250);
    });
  });

  describe('drag navigation', () => {
    it('enables drag when comments are hidden (showComments=false)', () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };
      const onNavigate = vi.fn();

      render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
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

    it('drag uses 1:1 lasso tracking (accounts for lasso height)', async () => {
      // This test verifies the drag formula:
      // ratio = (y - barTop - lassoHeight/2) / (barHeight - lassoHeight)
      // This ensures lasso center follows mouse at the same speed
      const pipeline = createMockPipeline();
      const scrollable = assertElement(scrollContainer.querySelector<HTMLElement>('[style*="overflow"]'), 'scrollable element not found');

      // Setup scrollable: viewportRatio = clientHeight/scrollHeight = 500/1000 = 0.5
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
          showComments={false}
        />
      );

      // Wait for useMinimapScroll's rAF-based scroll element detection
      await waitForRAF();

      // Trigger scroll event to update scroll state
      fireEvent.scroll(scrollable);

      // Wait for state update
      await vi.waitFor(() => {
        // State should be initialized
      });

      const svg = assertElement(container.querySelector<SVGSVGElement>('svg'), 'svg element not found');

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

      // For containerHeight=500, PADDING_VERTICAL=10:
      // renderAreaHeight = 480, barTop = 10
      // viewportRatio = 0.5, lassoHeight = 0.5 * 480 = 240
      // lassoMoveRange = 480 - 240 = 240
      //
      // Drag formula: ratio = (y - barTop - lassoHeight/2) / lassoMoveRange
      //             = (y - 10 - 120) / 240
      //             = (y - 130) / 240
      //
      // For lasso center at middle of bar (y = 250):
      // ratio = (250 - 130) / 240 = 0.5
      // scrollTop = 0.5 * 500 = 250

      // Start drag
      fireEvent.mouseDown(svg, { clientX: 45, clientY: 250 });
      // Move to trigger drag calculation
      fireEvent.mouseMove(svg, { clientX: 45, clientY: 250 });

      // Should scroll to 50% (250) with 1:1 lasso tracking
      expect(scrollable.scrollTop).toBe(250);

      // Now drag to where lasso center would be at bottom (y = 370)
      // ratio = (370 - 130) / 240 = 1.0
      // scrollTop = 1.0 * 500 = 500
      fireEvent.mouseMove(svg, { clientX: 45, clientY: 370 });
      expect(scrollable.scrollTop).toBe(500);

      // And drag to where lasso center would be at top (y = 130)
      // ratio = (130 - 130) / 240 = 0
      // scrollTop = 0
      fireEvent.mouseMove(svg, { clientX: 45, clientY: 130 });
      expect(scrollable.scrollTop).toBe(0);
    });

    it('disables drag when comments are shown (showComments=true)', () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };
      const onNavigate = vi.fn();

      render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={true}
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
          showComments={false}
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
          showComments={false}
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
          showComments={false}
        />
      );

      // Should still render deletion and addition regions
      const deletionRects = container.querySelectorAll('.minimap-deletion');
      const additionRects = container.querySelectorAll('.minimap-addition');
      expect(deletionRects.length + additionRects.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Dynamic Prop Changes (State Transitions)
  // These tests verify minimap correctly updates when props change between renders
  // ============================================================================

  describe('file switching (dynamic filename change)', () => {
    it('recalculates diff regions when filename changes', () => {
      // Create two pipelines with different diff patterns
      const pipelineFile1 = createMockPipeline({
        filename: 'file1.ts',
        diffLines: [
          { type: 'deletion', oldLineNumber: 1, newLineNumber: null, content: 'old line' },
          { type: 'context', oldLineNumber: 2, newLineNumber: 1, content: 'context' },
        ],
      });

      const pipelineFile2 = createMockPipeline({
        filename: 'file2.ts',
        diffLines: [
          { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'context' },
          { type: 'addition', oldLineNumber: null, newLineNumber: 2, content: 'new line' },
          { type: 'addition', oldLineNumber: null, newLineNumber: 3, content: 'another new' },
        ],
      });

      const containerRef = { current: scrollContainer };

      const { container, rerender } = render(
        <Minimap
          pipeline={pipelineFile1}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
        />
      );

      // File 1 should have deletions
      let deletionRects = container.querySelectorAll('.minimap-deletion');
      let additionRects = container.querySelectorAll('.minimap-addition');
      expect(deletionRects.length).toBeGreaterThan(0);

      // Switch to file 2
      rerender(
        <Minimap
          pipeline={pipelineFile2}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
        />
      );

      // File 2 should have additions, no deletions
      deletionRects = container.querySelectorAll('.minimap-deletion');
      additionRects = container.querySelectorAll('.minimap-addition');
      expect(additionRects.length).toBeGreaterThan(0);
    });

    it('resets scroll tracking state when filename changes', async () => {
      // This test validates the contentKey bug fix:
      // When filename changes, useMinimapScroll should reset and recalculate
      const pipelineFile1 = createMockPipeline({ filename: 'file1.ts' });
      const pipelineFile2 = createMockPipeline({ filename: 'file2.ts' });

      const scrollable = assertElement(scrollContainer.querySelector<HTMLElement>('[style*="overflow"]'), 'scrollable element not found');
      Object.defineProperty(scrollable, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(scrollable, 'clientHeight', { value: 500, writable: true });
      scrollable.scrollTop = 250; // Start scrolled to middle

      const containerRef = { current: scrollContainer };

      // File 1: simulate viewing middle rows (indices 2-4)
      const file1VisibleRange = { startIndex: 2, stopIndex: 4 };

      const { container, rerender } = render(
        <Minimap
          pipeline={pipelineFile1}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
          visibleRowRange={file1VisibleRange}
        />
      );

      // Wait for useMinimapScroll's rAF-based scroll element detection
      await waitForRAF();

      // Trigger scroll to update scroll state
      fireEvent.scroll(scrollable);
      await vi.waitFor(() => { /* Allow React to process scroll event */ });

      // Get lasso path for file1 (scrolled to middle)
      const lassoFile1 = container.querySelector('.minimap-lasso');
      const lassoPathFile1 = lassoFile1?.getAttribute('d');

      // Switch to file 2 (simulating new file at top - indices 0-2)
      scrollable.scrollTop = 0;
      const file2VisibleRange = { startIndex: 0, stopIndex: 2 };

      rerender(
        <Minimap
          pipeline={pipelineFile2}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
          visibleRowRange={file2VisibleRange}
        />
      );

      // Wait for new rAF cycle after rerender
      await waitForRAF();

      // Trigger scroll event to recalculate
      fireEvent.scroll(scrollable);
      await vi.waitFor(() => { /* Allow React to process scroll event */ });

      // Get lasso path for file2 (should be at top)
      const lassoFile2 = container.querySelector('.minimap-lasso');
      const lassoPathFile2 = lassoFile2?.getAttribute('d');

      // Paths should be different (file1 was scrolled to middle, file2 is at top)
      // This validates that visible row range correctly affects lasso position
      expect(lassoPathFile1).not.toEqual(lassoPathFile2);
    });
  });

  describe('view mode switching (inline ↔ split)', () => {
    it('updates regions when switching from inline to split mode', () => {
      const containerRef = { current: scrollContainer };

      // Start in inline mode
      const pipelineInline = createMockPipeline({ viewMode: 'inline' });
      const { container, rerender } = render(
        <Minimap
          pipeline={pipelineInline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
        />
      );

      // Verify regions exist in inline mode
      expect(container.querySelectorAll('.minimap-deletion, .minimap-addition').length).toBeGreaterThan(0);

      // Switch to split mode
      const pipelineSplit = createMockPipeline({ viewMode: 'split' });
      rerender(
        <Minimap
          pipeline={pipelineSplit}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
        />
      );

      // Regions should still be rendered (may have same count but validates re-render)
      const splitDeletions = container.querySelectorAll('.minimap-deletion').length;
      const splitAdditions = container.querySelectorAll('.minimap-addition').length;
      expect(splitDeletions + splitAdditions).toBeGreaterThan(0);
    });

    it('preserves lasso visibility when switching view modes', async () => {
      const containerRef = { current: scrollContainer };

      // Start in inline mode with lasso visible
      const pipelineInline = createMockPipeline({ viewMode: 'inline' });
      const { container, rerender } = render(
        <Minimap
          pipeline={pipelineInline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
          visibleRowRange={createVisibleRowRange(pipelineInline.diffLines.length)}
        />
      );

      // Wait for useMinimapScroll's rAF-based scroll element detection
      await waitForRAF();

      expect(container.querySelector('.minimap-lasso')).toBeInTheDocument();

      // Switch to split mode
      const pipelineSplit = createMockPipeline({ viewMode: 'split' });
      rerender(
        <Minimap
          pipeline={pipelineSplit}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
          visibleRowRange={createVisibleRowRange(pipelineSplit.diffLines.length)}
        />
      );

      // Lasso should still be visible
      expect(container.querySelector('.minimap-lasso')).toBeInTheDocument();
    });
  });

  describe('content filter changes (dynamic)', () => {
    it('disables left bar when filter changes from both to right', () => {
      const containerRef = { current: scrollContainer };

      // Start with both filter
      const pipelineBoth = createMockPipeline({ contentFilter: 'both' });
      const { container, rerender } = render(
        <Minimap
          pipeline={pipelineBoth}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
        />
      );

      // Both bars should be enabled
      let leftBar = container.querySelector('.minimap-bar-left');
      let rightBar = container.querySelector('.minimap-bar-right');
      expect(leftBar).not.toHaveClass('minimap-bar-disabled');
      expect(rightBar).not.toHaveClass('minimap-bar-disabled');

      // Change filter to right-only
      const pipelineRight = createMockPipeline({ contentFilter: 'right' });
      rerender(
        <Minimap
          pipeline={pipelineRight}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
        />
      );

      // Left bar should be disabled
      leftBar = container.querySelector('.minimap-bar-left');
      rightBar = container.querySelector('.minimap-bar-right');
      expect(leftBar).toHaveClass('minimap-bar-disabled');
      expect(rightBar).not.toHaveClass('minimap-bar-disabled');
    });

    it('disables right bar when filter changes from both to left', () => {
      const containerRef = { current: scrollContainer };

      // Start with both filter
      const pipelineBoth = createMockPipeline({ contentFilter: 'both' });
      const { container, rerender } = render(
        <Minimap
          pipeline={pipelineBoth}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
        />
      );

      // Change filter to left-only
      const pipelineLeft = createMockPipeline({ contentFilter: 'left' });
      rerender(
        <Minimap
          pipeline={pipelineLeft}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
        />
      );

      // Right bar should be disabled
      const leftBar = container.querySelector('.minimap-bar-left');
      const rightBar = container.querySelector('.minimap-bar-right');
      expect(leftBar).not.toHaveClass('minimap-bar-disabled');
      expect(rightBar).toHaveClass('minimap-bar-disabled');
    });

    it('re-enables both bars when filter changes back to both', () => {
      const containerRef = { current: scrollContainer };

      // Start with left filter (right bar disabled)
      const pipelineLeft = createMockPipeline({ contentFilter: 'left' });
      const { container, rerender } = render(
        <Minimap
          pipeline={pipelineLeft}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
        />
      );

      let rightBar = container.querySelector('.minimap-bar-right');
      expect(rightBar).toHaveClass('minimap-bar-disabled');

      // Change back to both
      const pipelineBoth = createMockPipeline({ contentFilter: 'both' });
      rerender(
        <Minimap
          pipeline={pipelineBoth}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
        />
      );

      // Both bars should be enabled
      const leftBar = container.querySelector('.minimap-bar-left');
      rightBar = container.querySelector('.minimap-bar-right');
      expect(leftBar).not.toHaveClass('minimap-bar-disabled');
      expect(rightBar).not.toHaveClass('minimap-bar-disabled');
    });
  });

  describe('showFullFile toggle (dynamic)', () => {
    it('shows lasso when showFullFile changes from false to true', async () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };

      // Start with showFullFile=false (no lasso)
      const { container, rerender } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={false}
          showComments={false}
        />
      );

      expect(container.querySelector('.minimap-lasso')).not.toBeInTheDocument();

      // Toggle to showFullFile=true
      rerender(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
          visibleRowRange={createVisibleRowRange(pipeline.diffLines.length)}
        />
      );

      // Wait for rAF-based scroll state initialization
      await waitForRAF();

      expect(container.querySelector('.minimap-lasso')).toBeInTheDocument();
    });

    it('hides lasso when showFullFile changes from true to false', async () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };

      // Start with showFullFile=true (lasso visible)
      const { container, rerender } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
          visibleRowRange={createVisibleRowRange(pipeline.diffLines.length)}
        />
      );

      // Wait for rAF-based scroll state initialization
      await waitForRAF();

      expect(container.querySelector('.minimap-lasso')).toBeInTheDocument();

      // Toggle to showFullFile=false
      rerender(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={false}
          showComments={false}
          visibleRowRange={createVisibleRowRange(pipeline.diffLines.length)}
        />
      );

      expect(container.querySelector('.minimap-lasso')).not.toBeInTheDocument();
    });
  });

  describe('showComments toggle (dynamic)', () => {
    it('hides lasso when comments appear', async () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };

      // Start without comments (lasso visible)
      const { container, rerender } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
          visibleRowRange={createVisibleRowRange(pipeline.diffLines.length)}
        />
      );

      // Wait for rAF-based scroll state initialization
      await waitForRAF();

      expect(container.querySelector('.minimap-lasso')).toBeInTheDocument();

      // Comments appear
      rerender(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={true}
        />
      );

      expect(container.querySelector('.minimap-lasso')).not.toBeInTheDocument();
    });

    it('shows lasso when comments are removed', async () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };

      // Start with comments (no lasso)
      const { container, rerender } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={true}
        />
      );

      expect(container.querySelector('.minimap-lasso')).not.toBeInTheDocument();

      // Comments removed
      rerender(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
          visibleRowRange={createVisibleRowRange(pipeline.diffLines.length)}
        />
      );

      // Wait for rAF-based scroll state initialization
      await waitForRAF();

      expect(container.querySelector('.minimap-lasso')).toBeInTheDocument();
    });

    it('disables drag when comments appear mid-drag', () => {
      const pipeline = createMockPipeline();
      const containerRef = { current: scrollContainer };
      const onNavigate = vi.fn();

      // Start without comments
      const { rerender } = render(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={false}
          onNavigate={onNavigate}
        />
      );

      const svg = screen.getByRole('img', { name: /minimap/i });

      // Start drag
      fireEvent.mouseDown(svg, { clientX: 30, clientY: 100 });
      fireEvent.mouseMove(svg, { clientX: 30, clientY: 150 });

      // Drag should be working
      const dragCallsBefore = onNavigate.mock.calls.filter(
        (call) => (call as [NavigateEvent])[0].type === 'drag'
      ).length;
      expect(dragCallsBefore).toBeGreaterThan(0);

      // Comments appear while dragging
      rerender(
        <Minimap
          pipeline={pipeline}
          containerHeight={500}
          scrollContainerRef={containerRef}
          showFullFile={true}
          showComments={true}
          onNavigate={onNavigate}
        />
      );

      // Clear call count
      onNavigate.mockClear();

      // Try to continue dragging
      fireEvent.mouseMove(svg, { clientX: 30, clientY: 200 });

      // No more drag events should fire
      const dragCallsAfter = onNavigate.mock.calls.filter(
        (call) => (call as [NavigateEvent])[0].type === 'drag'
      ).length;
      expect(dragCallsAfter).toBe(0);
    });
  });
});
