/**
 * Tests for Milestone 4.2: Stateless Iteration Management Types
 *
 * These tests verify type construction and basic type constraints.
 * Since these are primarily TypeScript interfaces, we test:
 * - Object construction with valid values
 * - Type narrowing and discrimination
 * - Helper function behavior (if any)
 */

import { describe, it, expect } from 'vitest';
import type {
  IterationLineage,
  CollapsedVisibility,
  StatelessIteration,
  CollapsedIterationGroup,
  ForcePushEvent,
  StatelessIterationData,
} from './types';

describe('Stateless Iteration Types', () => {
  describe('IterationLineage', () => {
    it('should accept "current" as a valid lineage', () => {
      const lineage: IterationLineage = 'current';
      expect(lineage).toBe('current');
    });

    it('should accept "discarded" as a valid lineage', () => {
      const lineage: IterationLineage = 'discarded';
      expect(lineage).toBe('discarded');
    });
  });

  describe('CollapsedVisibility', () => {
    it('should accept "collapsed" as a valid visibility state', () => {
      const visibility: CollapsedVisibility = 'collapsed';
      expect(visibility).toBe('collapsed');
    });

    it('should accept "expanded" as a valid visibility state', () => {
      const visibility: CollapsedVisibility = 'expanded';
      expect(visibility).toBe('expanded');
    });
  });

  describe('StatelessIteration', () => {
    it('should create an iteration with current lineage', () => {
      const iteration: StatelessIteration = {
        revision: 1,
        commitSha: 'abc123',
        baseSha: 'def456',
        author: 'testuser',
        message: 'Initial commit',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        lineage: 'current',
      };

      expect(iteration.revision).toBe(1);
      expect(iteration.commitSha).toBe('abc123');
      expect(iteration.baseSha).toBe('def456');
      expect(iteration.author).toBe('testuser');
      expect(iteration.message).toBe('Initial commit');
      expect(iteration.createdAt).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(iteration.lineage).toBe('current');
      expect(iteration.collapsedGroupId).toBeUndefined();
    });

    it('should create a discarded iteration with collapsedGroupId', () => {
      const iteration: StatelessIteration = {
        revision: 2,
        commitSha: 'ghi789',
        baseSha: 'abc123',
        author: 'testuser',
        message: 'Feature work (discarded)',
        createdAt: new Date('2024-01-15T11:00:00Z'),
        lineage: 'discarded',
        collapsedGroupId: 'group-1',
      };

      expect(iteration.revision).toBe(2);
      expect(iteration.lineage).toBe('discarded');
      expect(iteration.collapsedGroupId).toBe('group-1');
    });

    it('should allow discarded iteration without collapsedGroupId', () => {
      const iteration: StatelessIteration = {
        revision: 3,
        commitSha: 'jkl012',
        baseSha: 'ghi789',
        author: 'testuser',
        message: 'Another commit',
        createdAt: new Date('2024-01-15T12:00:00Z'),
        lineage: 'discarded',
      };

      expect(iteration.lineage).toBe('discarded');
      expect(iteration.collapsedGroupId).toBeUndefined();
    });
  });

  describe('CollapsedIterationGroup', () => {
    it('should create a collapsed group with iterations', () => {
      const discardedIteration: StatelessIteration = {
        revision: 2,
        commitSha: 'commit-2',
        baseSha: 'commit-1',
        author: 'testuser',
        message: 'Feature work',
        createdAt: new Date('2024-01-15T11:00:00Z'),
        lineage: 'discarded',
        collapsedGroupId: 'fp-1',
      };

      const group: CollapsedIterationGroup = {
        id: 'fp-1',
        beforeSha: 'commit-2',
        afterSha: 'commit-3',
        iterations: [discardedIteration],
        visibility: 'collapsed',
      };

      expect(group.id).toBe('fp-1');
      expect(group.beforeSha).toBe('commit-2');
      expect(group.afterSha).toBe('commit-3');
      expect(group.iterations).toHaveLength(1);
      expect(group.visibility).toBe('collapsed');
      expect(group.unavailableReason).toBeUndefined();
    });

    it('should create an expanded group', () => {
      const group: CollapsedIterationGroup = {
        id: 'fp-2',
        beforeSha: 'old-head',
        afterSha: 'new-head',
        iterations: [],
        visibility: 'expanded',
      };

      expect(group.visibility).toBe('expanded');
    });

    it('should support unavailable reason for GCd commits', () => {
      const group: CollapsedIterationGroup = {
        id: 'fp-3',
        beforeSha: 'gc-commit',
        afterSha: 'new-commit',
        iterations: [],
        visibility: 'collapsed',
        unavailableReason: 'Commits have been garbage collected',
      };

      expect(group.unavailableReason).toBe('Commits have been garbage collected');
    });
  });

  describe('ForcePushEvent', () => {
    it('should create a force-push event', () => {
      const event: ForcePushEvent = {
        beforeSha: 'old-sha',
        afterSha: 'new-sha',
        timestamp: new Date('2024-01-15T14:00:00Z'),
        actor: 'developer',
      };

      expect(event.beforeSha).toBe('old-sha');
      expect(event.afterSha).toBe('new-sha');
      expect(event.timestamp).toEqual(new Date('2024-01-15T14:00:00Z'));
      expect(event.actor).toBe('developer');
    });
  });

  describe('StatelessIterationData', () => {
    it('should combine iterations and collapsed groups', () => {
      const currentIteration: StatelessIteration = {
        revision: 3,
        commitSha: 'current-sha',
        baseSha: 'base-sha',
        author: 'testuser',
        message: 'Current work',
        createdAt: new Date('2024-01-15T15:00:00Z'),
        lineage: 'current',
      };

      const discardedIteration: StatelessIteration = {
        revision: 2,
        commitSha: 'discarded-sha',
        baseSha: 'base-sha',
        author: 'testuser',
        message: 'Old work',
        createdAt: new Date('2024-01-15T12:00:00Z'),
        lineage: 'discarded',
        collapsedGroupId: 'fp-1',
      };

      const group: CollapsedIterationGroup = {
        id: 'fp-1',
        beforeSha: 'discarded-sha',
        afterSha: 'current-sha',
        iterations: [discardedIteration],
        visibility: 'collapsed',
      };

      const data: StatelessIterationData = {
        iterations: [discardedIteration, currentIteration],
        collapsedGroups: [group],
      };

      expect(data.iterations).toHaveLength(2);
      expect(data.collapsedGroups).toHaveLength(1);
      // Verify lineages are preserved in the data structure
      expect(discardedIteration.lineage).toBe('discarded');
      expect(currentIteration.lineage).toBe('current');
    });

    it('should support empty collections', () => {
      const data: StatelessIterationData = {
        iterations: [],
        collapsedGroups: [],
      };

      expect(data.iterations).toHaveLength(0);
      expect(data.collapsedGroups).toHaveLength(0);
    });
  });
});
