/**
 * Tests for PriorityQueue - min-heap implementation (Task 3.2)
 */

import { describe, it, expect } from 'vitest';
import { PriorityQueue, type Comparator } from './priority-queue';

// Number comparator for min-heap (smallest first)
const numberComparator: Comparator<number> = (a, b) => a - b;

// Max-heap comparator (largest first)
const maxHeapComparator: Comparator<number> = (a, b) => b - a;

// Task-like comparator for realistic use case
interface Task {
  id: string;
  priority: number;
  name: string;
}

const taskComparator: Comparator<Task> = (a, b) => a.priority - b.priority;

describe('PriorityQueue', () => {
  describe('constructor', () => {
    it('creates an empty queue', () => {
      const pq = new PriorityQueue(numberComparator);
      expect(pq.size()).toBe(0);
    });
  });

  describe('push', () => {
    it('adds an item to the queue', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(5);
      expect(pq.size()).toBe(1);
    });

    it('maintains min-heap property after multiple pushes', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(5);
      pq.push(3);
      pq.push(7);
      pq.push(1);
      expect(pq.peek()).toBe(1);
    });

    it('handles duplicate values', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(5);
      pq.push(5);
      pq.push(5);
      expect(pq.size()).toBe(3);
      expect(pq.peek()).toBe(5);
    });
  });

  describe('pop', () => {
    it('returns undefined for empty queue', () => {
      const pq = new PriorityQueue(numberComparator);
      expect(pq.pop()).toBeUndefined();
    });

    it('removes and returns the smallest item', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(5);
      pq.push(3);
      pq.push(7);
      expect(pq.pop()).toBe(3);
      expect(pq.size()).toBe(2);
    });

    it('maintains heap property after pop', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(5);
      pq.push(3);
      pq.push(7);
      pq.push(1);
      pq.push(9);

      expect(pq.pop()).toBe(1);
      expect(pq.pop()).toBe(3);
      expect(pq.pop()).toBe(5);
      expect(pq.pop()).toBe(7);
      expect(pq.pop()).toBe(9);
      expect(pq.pop()).toBeUndefined();
    });

    it('returns items in correct order for complex sequence', () => {
      const pq = new PriorityQueue(numberComparator);
      const values = [15, 10, 20, 17, 25, 5, 30, 8, 12, 3];

      for (const v of values) {
        pq.push(v);
      }

      const sorted = [...values].sort((a, b) => a - b);
      for (const expected of sorted) {
        expect(pq.pop()).toBe(expected);
      }
    });
  });

  describe('peek', () => {
    it('returns undefined for empty queue', () => {
      const pq = new PriorityQueue(numberComparator);
      expect(pq.peek()).toBeUndefined();
    });

    it('returns the smallest item without removing it', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(5);
      pq.push(3);
      expect(pq.peek()).toBe(3);
      expect(pq.size()).toBe(2);
      expect(pq.peek()).toBe(3);
    });
  });

  describe('size', () => {
    it('returns 0 for empty queue', () => {
      const pq = new PriorityQueue(numberComparator);
      expect(pq.size()).toBe(0);
    });

    it('returns correct size after operations', () => {
      const pq = new PriorityQueue(numberComparator);
      expect(pq.size()).toBe(0);
      pq.push(1);
      expect(pq.size()).toBe(1);
      pq.push(2);
      expect(pq.size()).toBe(2);
      pq.pop();
      expect(pq.size()).toBe(1);
      pq.pop();
      expect(pq.size()).toBe(0);
    });
  });

  describe('clear', () => {
    it('removes all items from the queue', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(1);
      pq.push(2);
      pq.push(3);
      expect(pq.size()).toBe(3);

      pq.clear();
      expect(pq.size()).toBe(0);
      expect(pq.peek()).toBeUndefined();
      expect(pq.pop()).toBeUndefined();
    });

    it('allows reuse after clear', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(5);
      pq.clear();
      pq.push(3);
      expect(pq.size()).toBe(1);
      expect(pq.peek()).toBe(3);
    });
  });

  describe('remove', () => {
    it('returns undefined when no match found', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(1);
      pq.push(2);
      pq.push(3);

      const result = pq.remove(item => item === 99);
      expect(result).toBeUndefined();
      expect(pq.size()).toBe(3);
    });

    it('removes and returns the first matching item', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(5);
      pq.push(3);
      pq.push(7);

      const result = pq.remove(item => item === 3);
      expect(result).toBe(3);
      expect(pq.size()).toBe(2);
    });

    it('maintains heap property after remove', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(1);
      pq.push(3);
      pq.push(5);
      pq.push(7);
      pq.push(9);

      // Remove middle element
      pq.remove(item => item === 5);

      expect(pq.pop()).toBe(1);
      expect(pq.pop()).toBe(3);
      expect(pq.pop()).toBe(7);
      expect(pq.pop()).toBe(9);
    });

    it('removes root element correctly', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(5);
      pq.push(3);
      pq.push(7);

      const result = pq.remove(item => item === 3);
      expect(result).toBe(3);
      expect(pq.peek()).toBe(5);
    });

    it('removes last element correctly', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(5);
      pq.push(3);
      pq.push(7);

      const result = pq.remove(item => item === 7);
      expect(result).toBe(7);
      expect(pq.size()).toBe(2);
      expect(pq.pop()).toBe(3);
      expect(pq.pop()).toBe(5);
    });

    it('handles removal from single-element queue', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(5);

      const result = pq.remove(item => item === 5);
      expect(result).toBe(5);
      expect(pq.size()).toBe(0);
    });

    it('returns undefined for empty queue', () => {
      const pq = new PriorityQueue(numberComparator);
      const result = pq.remove(item => item === 5);
      expect(result).toBeUndefined();
    });
  });

  describe('update', () => {
    it('returns false when no match found', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(1);
      pq.push(2);

      const result = pq.update(
        item => item === 99,
        item => item + 100
      );
      expect(result).toBe(false);
      expect(pq.size()).toBe(2);
    });

    it('updates matching item and returns true', () => {
      const pq = new PriorityQueue(taskComparator);
      pq.push({ id: '1', priority: 10, name: 'task1' });
      pq.push({ id: '2', priority: 5, name: 'task2' });

      const result = pq.update(
        task => task.id === '1',
        task => ({ ...task, priority: 1 })
      );

      expect(result).toBe(true);
      // Now task1 should be the highest priority (lowest number)
      expect(pq.peek()?.id).toBe('1');
      expect(pq.peek()?.priority).toBe(1);
    });

    it('maintains heap property when priority increases', () => {
      const pq = new PriorityQueue(taskComparator);
      pq.push({ id: '1', priority: 1, name: 'task1' });
      pq.push({ id: '2', priority: 5, name: 'task2' });
      pq.push({ id: '3', priority: 10, name: 'task3' });

      // Increase priority of task1 (make it worse)
      pq.update(
        task => task.id === '1',
        task => ({ ...task, priority: 100 })
      );

      expect(pq.peek()?.id).toBe('2');
      expect(pq.pop()?.id).toBe('2');
      expect(pq.pop()?.id).toBe('3');
      expect(pq.pop()?.id).toBe('1');
    });

    it('maintains heap property when priority decreases', () => {
      const pq = new PriorityQueue(taskComparator);
      pq.push({ id: '1', priority: 10, name: 'task1' });
      pq.push({ id: '2', priority: 5, name: 'task2' });
      pq.push({ id: '3', priority: 1, name: 'task3' });

      // Decrease priority of task1 (make it better)
      pq.update(
        task => task.id === '1',
        task => ({ ...task, priority: 0 })
      );

      expect(pq.peek()?.id).toBe('1');
      expect(pq.peek()?.priority).toBe(0);
    });

    it('returns false for empty queue', () => {
      const pq = new PriorityQueue(numberComparator);
      const result = pq.update(
        item => item === 5,
        item => item + 10
      );
      expect(result).toBe(false);
    });

    it('handles update to same priority', () => {
      const pq = new PriorityQueue(taskComparator);
      pq.push({ id: '1', priority: 5, name: 'task1' });

      pq.update(
        task => task.id === '1',
        task => ({ ...task, name: 'updated' })
      );

      expect(pq.peek()?.name).toBe('updated');
      expect(pq.peek()?.priority).toBe(5);
    });
  });

  describe('custom comparators', () => {
    it('works as max-heap with reverse comparator', () => {
      const pq = new PriorityQueue(maxHeapComparator);
      pq.push(5);
      pq.push(3);
      pq.push(7);
      pq.push(1);

      expect(pq.pop()).toBe(7);
      expect(pq.pop()).toBe(5);
      expect(pq.pop()).toBe(3);
      expect(pq.pop()).toBe(1);
    });

    it('works with complex object comparator', () => {
      const pq = new PriorityQueue(taskComparator);
      pq.push({ id: '1', priority: 10, name: 'low priority' });
      pq.push({ id: '2', priority: 1, name: 'high priority' });
      pq.push({ id: '3', priority: 5, name: 'medium priority' });

      expect(pq.pop()?.name).toBe('high priority');
      expect(pq.pop()?.name).toBe('medium priority');
      expect(pq.pop()?.name).toBe('low priority');
    });

    it('handles string comparator', () => {
      const stringComparator: Comparator<string> = (a, b) => a.localeCompare(b);
      const pq = new PriorityQueue(stringComparator);

      pq.push('banana');
      pq.push('apple');
      pq.push('cherry');

      expect(pq.pop()).toBe('apple');
      expect(pq.pop()).toBe('banana');
      expect(pq.pop()).toBe('cherry');
    });
  });

  describe('O(log n) complexity verification', () => {
    it('handles large number of items efficiently', () => {
      const pq = new PriorityQueue(numberComparator);
      const count = 10000;

      // Push random values
      for (let i = 0; i < count; i++) {
        pq.push(Math.floor(Math.random() * 100000));
      }

      expect(pq.size()).toBe(count);

      // Verify items come out in sorted order
      let prev = -Infinity;
      while (pq.size() > 0) {
        const current = pq.pop();
        if (current === undefined) {
          throw new Error('Unexpected undefined from pop');
        }
        expect(current).toBeGreaterThanOrEqual(prev);
        prev = current;
      }
    });
  });

  describe('edge cases', () => {
    it('handles negative numbers', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(-5);
      pq.push(0);
      pq.push(-10);
      pq.push(5);

      expect(pq.pop()).toBe(-10);
      expect(pq.pop()).toBe(-5);
      expect(pq.pop()).toBe(0);
      expect(pq.pop()).toBe(5);
    });

    it('handles mixed push and pop operations', () => {
      const pq = new PriorityQueue(numberComparator);

      pq.push(5);
      pq.push(3);
      expect(pq.pop()).toBe(3);

      pq.push(1);
      expect(pq.pop()).toBe(1);

      pq.push(10);
      pq.push(2);
      expect(pq.pop()).toBe(2);
      expect(pq.pop()).toBe(5);
      expect(pq.pop()).toBe(10);
    });

    it('handles zero values', () => {
      const pq = new PriorityQueue(numberComparator);
      pq.push(0);
      pq.push(0);
      pq.push(0);

      expect(pq.size()).toBe(3);
      expect(pq.pop()).toBe(0);
      expect(pq.pop()).toBe(0);
      expect(pq.pop()).toBe(0);
    });
  });
});
