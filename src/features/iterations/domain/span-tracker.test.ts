/**
 * Tests for SpanTracker domain implementations
 */

import { describe, it, expect } from 'vitest';
import {
  PrecomputedSpanTracker,
  IdentitySpanTracker,
  ChainedSpanTracker,
  createSpanTracker,
  chainTrackers,
} from './span-tracker';
import type { LineMapping } from './span-mapping';

describe('IdentitySpanTracker', () => {
  const tracker = new IdentitySpanTracker(0, 1);

  it('should store snapshot indices', () => {
    expect(tracker.leftSnapshotIndex).toBe(0);
    expect(tracker.rightSnapshotIndex).toBe(1);
  });

  it('should return same span for forward tracking', () => {
    const span = { startLine: 5, endLine: 10 };
    expect(tracker.trackSpanForward(span)).toEqual(span);
  });

  it('should return same span for backward tracking', () => {
    const span = { startLine: 1, endLine: 20 };
    expect(tracker.trackSpanBackward(span)).toEqual(span);
  });

  it('should return empty mappings', () => {
    const mappings = tracker.getMappings();
    expect(mappings.mappings).toEqual([]);
    expect(mappings.leftToRight.size).toBe(0);
    expect(mappings.rightToLeft.size).toBe(0);
  });
});

describe('PrecomputedSpanTracker', () => {
  describe('with 1:1 mappings', () => {
    const mappings: LineMapping[] = [
      {
        leftSpan: { startLine: 1, endLine: 10 },
        rightSpan: { startLine: 1, endLine: 10 },
        type: 'unchanged',
      },
    ];
    const tracker = new PrecomputedSpanTracker(0, 1, mappings);

    it('should track spans forward correctly', () => {
      const result = tracker.trackSpanForward({ startLine: 3, endLine: 5 });
      expect(result).toEqual({ startLine: 3, endLine: 5 });
    });

    it('should track spans backward correctly', () => {
      const result = tracker.trackSpanBackward({ startLine: 7, endLine: 9 });
      expect(result).toEqual({ startLine: 7, endLine: 9 });
    });

    it('should return mappings data', () => {
      const data = tracker.getMappings();
      expect(data.mappings).toEqual(mappings);
    });
  });

  describe('with offset mappings', () => {
    // Lines 1-5 shifted to lines 3-7 (inserted 2 lines at start)
    const mappings: LineMapping[] = [
      {
        leftSpan: null,
        rightSpan: { startLine: 1, endLine: 2 },
        type: 'added',
      },
      {
        leftSpan: { startLine: 1, endLine: 5 },
        rightSpan: { startLine: 3, endLine: 7 },
        type: 'unchanged',
      },
    ];
    const tracker = new PrecomputedSpanTracker(0, 1, mappings);

    it('should track shifted spans forward', () => {
      const result = tracker.trackSpanForward({ startLine: 1, endLine: 3 });
      expect(result).toEqual({ startLine: 3, endLine: 5 });
    });

    it('should track shifted spans backward', () => {
      const result = tracker.trackSpanBackward({ startLine: 3, endLine: 5 });
      expect(result).toEqual({ startLine: 1, endLine: 3 });
    });

    it('should find nearest valid span for added lines tracked backward', () => {
      const result = tracker.trackSpanBackward({ startLine: 1, endLine: 2 });
      // Added lines 1-2 (right) don't exist in left. Nearest valid is line 3 (right) -> line 1 (left)
      expect(result).toEqual({ startLine: 1, endLine: 1 });
    });
  });

  describe('with deleted lines', () => {
    const mappings: LineMapping[] = [
      {
        leftSpan: { startLine: 1, endLine: 3 },
        rightSpan: { startLine: 1, endLine: 3 },
        type: 'unchanged',
      },
      {
        leftSpan: { startLine: 4, endLine: 6 },
        rightSpan: null,
        type: 'deleted',
      },
      {
        leftSpan: { startLine: 7, endLine: 10 },
        rightSpan: { startLine: 4, endLine: 7 },
        type: 'unchanged',
      },
    ];
    const tracker = new PrecomputedSpanTracker(0, 1, mappings);

    it('should find nearest valid span for deleted lines', () => {
      const result = tracker.trackSpanForward({ startLine: 4, endLine: 6 });
      // Deleted lines 4-6 (left). Nearest valid is line 3 (left) -> line 3 (right)
      // The algorithm searches before first (startLine - distance), so finds line 3
      expect(result).toEqual({ startLine: 3, endLine: 3 });
    });

    it('should return null if no valid span found within distance', () => {
      // Create tracker with only deleted mappings far from any valid
      const farDeletedMappings: LineMapping[] = [
        {
          leftSpan: { startLine: 100, endLine: 110 },
          rightSpan: null,
          type: 'deleted',
        },
      ];
      const farTracker = new PrecomputedSpanTracker(0, 1, farDeletedMappings);
      const result = farTracker.trackSpanForward({ startLine: 100, endLine: 110 });
      expect(result).toBeNull();
    });
  });

  describe('with unmapped lines', () => {
    const tracker = new PrecomputedSpanTracker(0, 1, []);

    it('should return identity for unmapped spans', () => {
      const span = { startLine: 50, endLine: 60 };
      expect(tracker.trackSpanForward(span)).toEqual(span);
      expect(tracker.trackSpanBackward(span)).toEqual(span);
    });
  });

  describe('findNearestValidSpan boundary cases', () => {
    it('should find valid line at exactly distance 10', () => {
      // Deleted lines 11-20, with valid line at 1 (distance = 10 from startLine 11)
      const mappings: LineMapping[] = [
        {
          leftSpan: { startLine: 1, endLine: 1 },
          rightSpan: { startLine: 1, endLine: 1 },
          type: 'unchanged',
        },
        {
          leftSpan: { startLine: 11, endLine: 20 },
          rightSpan: null,
          type: 'deleted',
        },
      ];
      const tracker = new PrecomputedSpanTracker(0, 1, mappings);
      const result = tracker.trackSpanForward({ startLine: 11, endLine: 11 });
      // Distance from 11 to 1 is 10 (11 - 10 = 1), should find it
      expect(result).toEqual({ startLine: 1, endLine: 1 });
    });

    it('should return null when valid line is at distance 11', () => {
      // Deleted lines 12-20, with no valid line within distance 10
      const mappings: LineMapping[] = [
        {
          leftSpan: { startLine: 1, endLine: 1 },
          rightSpan: { startLine: 1, endLine: 1 },
          type: 'unchanged',
        },
        {
          leftSpan: { startLine: 12, endLine: 20 },
          rightSpan: null,
          type: 'deleted',
        },
      ];
      const tracker = new PrecomputedSpanTracker(0, 1, mappings);
      const result = tracker.trackSpanForward({ startLine: 12, endLine: 12 });
      // Distance from 12 to 1 is 11 (12 - 11 = 1), should NOT find it
      expect(result).toBeNull();
    });

    it('should prefer "before" direction when both are equidistant', () => {
      // Deleted line 5, with valid lines at 4 (before) and 6 (after)
      const mappings: LineMapping[] = [
        {
          leftSpan: { startLine: 4, endLine: 4 },
          rightSpan: { startLine: 4, endLine: 4 },
          type: 'unchanged',
        },
        {
          leftSpan: { startLine: 5, endLine: 5 },
          rightSpan: null,
          type: 'deleted',
        },
        {
          leftSpan: { startLine: 6, endLine: 6 },
          rightSpan: { startLine: 5, endLine: 5 },
          type: 'unchanged',
        },
      ];
      const tracker = new PrecomputedSpanTracker(0, 1, mappings);
      const result = tracker.trackSpanForward({ startLine: 5, endLine: 5 });
      // Algorithm checks "before" first, so should find line 4
      expect(result).toEqual({ startLine: 4, endLine: 4 });
    });

    it('should find "after" when "before" is not available', () => {
      // Deleted line 1, only valid line is after at line 2
      const mappings: LineMapping[] = [
        {
          leftSpan: { startLine: 1, endLine: 1 },
          rightSpan: null,
          type: 'deleted',
        },
        {
          leftSpan: { startLine: 2, endLine: 2 },
          rightSpan: { startLine: 1, endLine: 1 },
          type: 'unchanged',
        },
      ];
      const tracker = new PrecomputedSpanTracker(0, 1, mappings);
      const result = tracker.trackSpanForward({ startLine: 1, endLine: 1 });
      // Line 0 doesn't exist, so should find line 2 (endLine + 1)
      expect(result).toEqual({ startLine: 1, endLine: 1 });
    });
  });

  describe('with modified regions', () => {
    it('should track forward through modified region with more lines on right', () => {
      // 3 lines on left become 5 lines on right
      const mappings: LineMapping[] = [
        {
          leftSpan: { startLine: 1, endLine: 3 },
          rightSpan: { startLine: 1, endLine: 5 },
          type: 'modified',
        },
      ];
      const tracker = new PrecomputedSpanTracker(0, 1, mappings);
      // All left lines map to line 1 on right (first line of right span)
      expect(tracker.trackSpanForward({ startLine: 1, endLine: 1 })).toEqual({
        startLine: 1,
        endLine: 1,
      });
      expect(tracker.trackSpanForward({ startLine: 2, endLine: 2 })).toEqual({
        startLine: 1,
        endLine: 1,
      });
      expect(tracker.trackSpanForward({ startLine: 3, endLine: 3 })).toEqual({
        startLine: 1,
        endLine: 1,
      });
    });

    it('should track backward through modified region with more lines on right', () => {
      const mappings: LineMapping[] = [
        {
          leftSpan: { startLine: 1, endLine: 3 },
          rightSpan: { startLine: 1, endLine: 5 },
          type: 'modified',
        },
      ];
      const tracker = new PrecomputedSpanTracker(0, 1, mappings);
      // All right lines map to line 1 on left (first line of left span)
      expect(tracker.trackSpanBackward({ startLine: 1, endLine: 1 })).toEqual({
        startLine: 1,
        endLine: 1,
      });
      expect(tracker.trackSpanBackward({ startLine: 3, endLine: 3 })).toEqual({
        startLine: 1,
        endLine: 1,
      });
      expect(tracker.trackSpanBackward({ startLine: 5, endLine: 5 })).toEqual({
        startLine: 1,
        endLine: 1,
      });
    });

    it('should track through modified region with fewer lines on right', () => {
      // 5 lines on left become 3 lines on right
      const mappings: LineMapping[] = [
        {
          leftSpan: { startLine: 1, endLine: 5 },
          rightSpan: { startLine: 1, endLine: 3 },
          type: 'modified',
        },
      ];
      const tracker = new PrecomputedSpanTracker(0, 1, mappings);
      // All left lines map to line 1 on right
      expect(tracker.trackSpanForward({ startLine: 1, endLine: 1 })).toEqual({
        startLine: 1,
        endLine: 1,
      });
      expect(tracker.trackSpanForward({ startLine: 5, endLine: 5 })).toEqual({
        startLine: 1,
        endLine: 1,
      });
      // All right lines map to line 1 on left
      expect(tracker.trackSpanBackward({ startLine: 1, endLine: 1 })).toEqual({
        startLine: 1,
        endLine: 1,
      });
      expect(tracker.trackSpanBackward({ startLine: 3, endLine: 3 })).toEqual({
        startLine: 1,
        endLine: 1,
      });
    });
  });
});

describe('ChainedSpanTracker', () => {
  it('should throw for empty tracker array', () => {
    expect(() => new ChainedSpanTracker([])).toThrow('requires at least one tracker');
  });

  it('should throw for broken chain', () => {
    const t1 = new IdentitySpanTracker(0, 1);
    const t2 = new IdentitySpanTracker(3, 4); // Gap: 1 -> 3
    expect(() => new ChainedSpanTracker([t1, t2])).toThrow('chain broken');
  });

  it('should track through single tracker', () => {
    const inner = new IdentitySpanTracker(0, 1);
    const chained = new ChainedSpanTracker([inner]);

    expect(chained.leftSnapshotIndex).toBe(0);
    expect(chained.rightSnapshotIndex).toBe(1);

    const span = { startLine: 5, endLine: 10 };
    expect(chained.trackSpanForward(span)).toEqual(span);
    expect(chained.trackSpanBackward(span)).toEqual(span);
  });

  it('should track through multiple trackers', () => {
    // Create a chain with offset at each step
    const mappings1: LineMapping[] = [
      {
        leftSpan: { startLine: 1, endLine: 10 },
        rightSpan: { startLine: 2, endLine: 11 },
        type: 'unchanged',
      },
    ];
    const mappings2: LineMapping[] = [
      {
        leftSpan: { startLine: 2, endLine: 11 },
        rightSpan: { startLine: 4, endLine: 13 },
        type: 'unchanged',
      },
    ];

    const t1 = new PrecomputedSpanTracker(0, 1, mappings1);
    const t2 = new PrecomputedSpanTracker(1, 2, mappings2);
    const chained = new ChainedSpanTracker([t1, t2]);

    expect(chained.leftSnapshotIndex).toBe(0);
    expect(chained.rightSnapshotIndex).toBe(2);

    // Line 1 -> 2 (after t1) -> 4 (after t2)
    const forward = chained.trackSpanForward({ startLine: 1, endLine: 1 });
    expect(forward).toEqual({ startLine: 4, endLine: 4 });

    // Line 4 -> 2 (after t2 backward) -> 1 (after t1 backward)
    const backward = chained.trackSpanBackward({ startLine: 4, endLine: 4 });
    expect(backward).toEqual({ startLine: 1, endLine: 1 });
  });

  it('should return null if any tracker in chain returns null', () => {
    // This line is deleted in the first tracker (far from any valid line)
    const farDeleteMappings: LineMapping[] = [
      {
        leftSpan: { startLine: 100, endLine: 100 },
        rightSpan: null,
        type: 'deleted',
      },
    ];
    const t1Far = new PrecomputedSpanTracker(0, 1, farDeleteMappings);
    const t2 = new IdentitySpanTracker(1, 2);
    const chainedFar = new ChainedSpanTracker([t1Far, t2]);

    const result = chainedFar.trackSpanForward({ startLine: 100, endLine: 100 });
    expect(result).toBeNull();
  });

  it('should return empty mappings', () => {
    const t1 = new IdentitySpanTracker(0, 1);
    const t2 = new IdentitySpanTracker(1, 2);
    const chained = new ChainedSpanTracker([t1, t2]);

    const mappings = chained.getMappings();
    expect(mappings.mappings).toEqual([]);
  });

  it('should expose underlying trackers', () => {
    const t1 = new IdentitySpanTracker(0, 1);
    const t2 = new IdentitySpanTracker(1, 2);
    const chained = new ChainedSpanTracker([t1, t2]);

    expect(chained.getTrackers()).toHaveLength(2);
  });
});

describe('createSpanTracker', () => {
  it('should return IdentitySpanTracker for empty mappings', () => {
    const tracker = createSpanTracker(0, 1, []);
    expect(tracker).toBeInstanceOf(IdentitySpanTracker);
  });

  it('should return PrecomputedSpanTracker for non-empty mappings', () => {
    const mappings: LineMapping[] = [
      {
        leftSpan: { startLine: 1, endLine: 5 },
        rightSpan: { startLine: 1, endLine: 5 },
        type: 'unchanged',
      },
    ];
    const tracker = createSpanTracker(0, 1, mappings);
    expect(tracker).toBeInstanceOf(PrecomputedSpanTracker);
  });
});

describe('chainTrackers', () => {
  it('should throw for empty array', () => {
    expect(() => chainTrackers([])).toThrow('Cannot chain zero trackers');
  });

  it('should return single tracker directly', () => {
    const single = new IdentitySpanTracker(0, 1);
    const result = chainTrackers([single]);
    expect(result).toBe(single);
  });

  it('should return ChainedSpanTracker for multiple trackers', () => {
    const t1 = new IdentitySpanTracker(0, 1);
    const t2 = new IdentitySpanTracker(1, 2);
    const result = chainTrackers([t1, t2]);
    expect(result).toBeInstanceOf(ChainedSpanTracker);
  });
});
