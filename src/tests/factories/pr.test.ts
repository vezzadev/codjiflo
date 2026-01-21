/**
 * Unit tests for PR factory functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockAuthor,
  createMockReview,
  resetFactoryCounters,
} from './pr';
import { ReviewState } from '@/api/types';

describe('pr factories', () => {
  beforeEach(() => {
    resetFactoryCounters();
  });

  describe('createMockAuthor', () => {
    it('creates a default author', () => {
      const author = createMockAuthor();

      expect(author.id).toBe('user-1');
      expect(author.displayName).toBe('User 1');
      expect(author.avatarUrl).toContain('avatars.githubusercontent.com');
    });

    it('increments id counter on each call', () => {
      const author1 = createMockAuthor();
      const author2 = createMockAuthor();

      expect(author1.id).toBe('user-1');
      expect(author2.id).toBe('user-2');
    });

    it('accepts overrides', () => {
      const author = createMockAuthor({
        id: 'custom-id',
        displayName: 'Custom User',
      });

      expect(author.id).toBe('custom-id');
      expect(author.displayName).toBe('Custom User');
    });
  });

  describe('createMockReview', () => {
    it('creates a default review', () => {
      const review = createMockReview();

      expect(review.id).toBe(1);
      expect(review.number).toBe(1);
      expect(review.title).toContain('Test Pull Request');
      expect(review.state).toBe(ReviewState.Open);
      expect(review.sourceBranch).toBe('feature/test-branch');
      expect(review.targetBranch).toBe('main');
    });

    it('includes a created author', () => {
      const review = createMockReview();

      expect(review.author).toBeDefined();
      expect(review.author.id).toBeDefined();
    });

    it('increments id counter on each call', () => {
      const review1 = createMockReview();
      const review2 = createMockReview();

      expect(review1.id).toBe(1);
      expect(review2.id).toBe(3); // 2 was used for the author in review1
    });

    it('accepts overrides', () => {
      const review = createMockReview({
        title: 'Custom PR Title',
        state: ReviewState.Merged,
        sourceBranch: 'custom-branch',
      });

      expect(review.title).toBe('Custom PR Title');
      expect(review.state).toBe(ReviewState.Merged);
      expect(review.sourceBranch).toBe('custom-branch');
    });
  });

  describe('resetFactoryCounters', () => {
    it('resets the id counter', () => {
      createMockAuthor(); // user-1
      createMockAuthor(); // user-2
      resetFactoryCounters();
      const author = createMockAuthor();

      expect(author.id).toBe('user-1');
    });
  });
});
