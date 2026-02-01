/**
 * Generic Priority Queue implementation using min-heap (Task 3.2)
 *
 * Used by DiffScheduler to manage diff computation tasks by priority.
 * Provides O(log n) push, pop, remove, and update operations.
 */

/**
 * Comparator function type.
 * Returns negative if a < b, positive if a > b, zero if equal.
 */
export type Comparator<T> = (a: T, b: T) => number;

/**
 * Priority Queue implementation using a binary min-heap.
 *
 * The heap invariant: parent is always <= children (using comparator).
 * This means the smallest element (according to comparator) is always at root.
 */
export class PriorityQueue<T> {
  private heap: T[] = [];
  private readonly comparator: Comparator<T>;

  constructor(comparator: Comparator<T>) {
    this.comparator = comparator;
  }

  /**
   * Add an item to the queue. O(log n)
   */
  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Remove and return the highest priority (smallest) item. O(log n)
   * Returns undefined if queue is empty.
   */
  pop(): T | undefined {
    if (this.heap.length === 0) {
      return undefined;
    }

    if (this.heap.length === 1) {
      return this.heap.pop();
    }

    const result = this.heap[0];
    const lastItem = this.heap.pop();
    // After pop, heap is not empty because we checked length > 1
    if (lastItem !== undefined) {
      this.heap[0] = lastItem;
      this.bubbleDown(0);
    }
    return result;
  }

  /**
   * Return the highest priority item without removing it. O(1)
   * Returns undefined if queue is empty.
   */
  peek(): T | undefined {
    return this.heap[0];
  }

  /**
   * Return the number of items in the queue. O(1)
   */
  size(): number {
    return this.heap.length;
  }

  /**
   * Remove all items from the queue. O(1)
   */
  clear(): void {
    this.heap = [];
  }

  /**
   * Remove and return the first item matching the predicate. O(n)
   * Returns undefined if no match found.
   * Maintains heap property after removal.
   */
  remove(predicate: (item: T) => boolean): T | undefined {
    const index = this.heap.findIndex(predicate);
    if (index === -1) {
      return undefined;
    }

    const item = this.heap[index];

    // Handle last element removal
    if (index === this.heap.length - 1) {
      this.heap.pop();
      return item;
    }

    // Replace with last element and restore heap
    const lastItem = this.heap.pop();
    if (lastItem !== undefined) {
      this.heap[index] = lastItem;
      this.restoreHeapAt(index);
    }

    return item;
  }

  /**
   * Update the first item matching the predicate. O(n + log n)
   * Returns true if item was found and updated, false otherwise.
   * Maintains heap property after update.
   */
  update(predicate: (item: T) => boolean, updater: (item: T) => T): boolean {
    const index = this.heap.findIndex(predicate);
    if (index === -1) {
      return false;
    }

    const currentItem = this.heap[index];
    if (currentItem === undefined) {
      return false;
    }

    this.heap[index] = updater(currentItem);
    this.restoreHeapAt(index);

    return true;
  }

  /**
   * Get an element at index. Throws if index is out of bounds.
   * This is used internally where we know the index is valid.
   */
  private get(index: number): T {
    const item = this.heap[index];
    if (item === undefined) {
      throw new Error(`Invalid heap index: ${index}`);
    }
    return item;
  }

  /**
   * Move an element up the heap until heap property is satisfied.
   */
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.comparator(this.get(index), this.get(parentIndex)) >= 0) {
        break;
      }
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  /**
   * Move an element down the heap until heap property is satisfied.
   */
  private bubbleDown(index: number): void {
    const length = this.heap.length;
    let current = index;
    let smallest = this.findSmallestChild(current, length);

    while (smallest !== current) {
      this.swap(current, smallest);
      current = smallest;
      smallest = this.findSmallestChild(current, length);
    }
  }

  /**
   * Find the smallest child of the element at index, or return index if no smaller child.
   */
  private findSmallestChild(index: number, length: number): number {
    const leftChild = 2 * index + 1;
    const rightChild = 2 * index + 2;
    let smallest = index;

    if (
      leftChild < length &&
      this.comparator(this.get(leftChild), this.get(smallest)) < 0
    ) {
      smallest = leftChild;
    }

    if (
      rightChild < length &&
      this.comparator(this.get(rightChild), this.get(smallest)) < 0
    ) {
      smallest = rightChild;
    }

    return smallest;
  }

  /**
   * Restore heap property at a given index.
   * Used after remove or update operations.
   */
  private restoreHeapAt(index: number): void {
    // Try bubbling up first
    const parentIndex = Math.floor((index - 1) / 2);
    if (index > 0 && this.comparator(this.get(index), this.get(parentIndex)) < 0) {
      this.bubbleUp(index);
    } else {
      // If we can't bubble up, try bubbling down
      this.bubbleDown(index);
    }
  }

  /**
   * Swap two elements in the heap.
   */
  private swap(i: number, j: number): void {
    const temp = this.get(i);
    this.heap[i] = this.get(j);
    this.heap[j] = temp;
  }
}
