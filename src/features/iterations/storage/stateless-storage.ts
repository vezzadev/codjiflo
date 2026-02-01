/**
 * StatelessStorage Implementation (Milestone 4.2)
 *
 * IndexedDB-based persistence for stateless iteration mode using the idb library.
 * Provides graceful fallback for private browsing (returns null on failure).
 *
 * Database: 'codjiflo-stateless', version 1
 * Stores:
 * - lastSeen: Tracks last viewed iteration per PR (keyPath: prKey)
 * - iterations: Immutable iteration records (keyPath: key, index: by-prKey)
 * - unavailable: Tracks unavailable iterations (keyPath: key)
 *
 * @see spec/stories/milestone-4.2-stateless-iteration-management.md
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import { tracer, SemanticAttributes as Attr } from '@/lib/tracing';
import type {
  StatelessStorage,
  LastSeenRecord,
  IterationRecord,
  UnavailableRecord,
} from './types';

// ============================================================================
// Database Schema
// ============================================================================

const DB_NAME = 'codjiflo-stateless';
const DB_VERSION = 1;

/**
 * IndexedDB schema for stateless storage.
 * Defines the three object stores and their indexes.
 */
export interface StatelessDB extends DBSchema {
  lastSeen: {
    key: string; // prKey
    value: LastSeenRecord;
  };
  iterations: {
    key: string; // "{prKey}/{revision}"
    value: IterationRecord;
    indexes: {
      'by-prKey': string;
    };
  };
  unavailable: {
    key: string; // "{prKey}/{revision}"
    value: UnavailableRecord;
  };
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * IndexedDB-based StatelessStorage implementation.
 * All methods include OTel tracing for observability.
 */
export class IDBStatelessStorage implements StatelessStorage {
  private db: IDBPDatabase<StatelessDB>;

  constructor(db: IDBPDatabase<StatelessDB>) {
    this.db = db;
  }

  // -------------------------------------------------------------------------
  // Last Seen Operations
  // -------------------------------------------------------------------------

  async getLastSeen(prKey: string): Promise<LastSeenRecord | undefined> {
    const span = tracer.startSpan('storage.getLastSeen', {
      [Attr.STORAGE_OPERATION]: 'getLastSeen',
      [Attr.STORAGE_KEY]: prKey,
    });

    try {
      const result = await this.db.get('lastSeen', prKey);
      span.setStatus('ok');
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      span.setStatus('error', message);
      throw error;
    } finally {
      span.end();
    }
  }

  async setLastSeen(record: LastSeenRecord): Promise<void> {
    const span = tracer.startSpan('storage.setLastSeen', {
      [Attr.STORAGE_OPERATION]: 'setLastSeen',
      [Attr.STORAGE_KEY]: record.prKey,
    });

    try {
      await this.db.put('lastSeen', record);
      span.setStatus('ok');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      span.setStatus('error', message);
      throw error;
    } finally {
      span.end();
    }
  }

  // -------------------------------------------------------------------------
  // Iteration Operations (Immutable)
  // -------------------------------------------------------------------------

  async getIterations(prKey: string): Promise<IterationRecord[]> {
    const span = tracer.startSpan('storage.getIterations', {
      [Attr.STORAGE_OPERATION]: 'getIterations',
      [Attr.STORAGE_KEY]: prKey,
    });

    try {
      const results = await this.db.getAllFromIndex('iterations', 'by-prKey', prKey);
      // Sort by revision (ascending)
      results.sort((a, b) => a.revision - b.revision);
      span.setAttribute(Attr.ITERATION_COUNT, results.length);
      span.setStatus('ok');
      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      span.setStatus('error', message);
      throw error;
    } finally {
      span.end();
    }
  }

  async addIterations(records: IterationRecord[]): Promise<void> {
    const span = tracer.startSpan('storage.addIterations', {
      [Attr.STORAGE_OPERATION]: 'addIterations',
      [Attr.ITERATION_COUNT]: records.length,
    });

    try {
      if (records.length === 0) {
        span.setStatus('ok');
        return;
      }

      // Use a transaction for atomic batch insert
      const tx = this.db.transaction('iterations', 'readwrite');
      const store = tx.objectStore('iterations');

      let addedCount = 0;
      for (const record of records) {
        // Check if key already exists before adding (for immutability)
        // We use get() to check existence, then only add() if not present
        const existing = await store.get(record.key);
        if (existing !== undefined) {
          span.addEvent('iteration.duplicate', { key: record.key });
          continue;
        }

        await store.add(record);
        addedCount++;
      }

      await tx.done;
      span.addEvent('iterations.added', { count: addedCount });
      span.setStatus('ok');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      span.setStatus('error', message);
      throw error;
    } finally {
      span.end();
    }
  }

  // -------------------------------------------------------------------------
  // Unavailable Operations
  // -------------------------------------------------------------------------

  async isUnavailable(prKey: string, revision: number): Promise<boolean> {
    const key = `${prKey}/${revision}`;
    const span = tracer.startSpan('storage.isUnavailable', {
      [Attr.STORAGE_OPERATION]: 'isUnavailable',
      [Attr.STORAGE_KEY]: key,
    });

    try {
      const result = await this.db.get('unavailable', key);
      span.setStatus('ok');
      return result !== undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      span.setStatus('error', message);
      throw error;
    } finally {
      span.end();
    }
  }

  async markUnavailable(record: UnavailableRecord): Promise<void> {
    const span = tracer.startSpan('storage.markUnavailable', {
      [Attr.STORAGE_OPERATION]: 'markUnavailable',
      [Attr.STORAGE_KEY]: record.key,
    });

    try {
      await this.db.put('unavailable', record);
      span.setStatus('ok');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      span.setStatus('error', message);
      throw error;
    } finally {
      span.end();
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  close(): void {
    this.db.close();
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Open stateless storage.
 * Returns null on failure (graceful fallback for private browsing).
 *
 * @returns StatelessStorage instance or null if unavailable
 */
export async function openStatelessStorage(): Promise<StatelessStorage | null> {
  const span = tracer.startSpan('storage.open', {
    [Attr.STORAGE_OPERATION]: 'open',
  });

  try {
    // Check if IndexedDB is available
    if (typeof indexedDB === 'undefined') {
      span.addEvent('indexeddb.unavailable');
      span.setStatus('ok');
      return null;
    }

    const db = await openDB<StatelessDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create lastSeen store
        if (!db.objectStoreNames.contains('lastSeen')) {
          db.createObjectStore('lastSeen', { keyPath: 'prKey' });
        }

        // Create iterations store with index
        if (!db.objectStoreNames.contains('iterations')) {
          const iterationsStore = db.createObjectStore('iterations', { keyPath: 'key' });
          iterationsStore.createIndex('by-prKey', 'prKey');
        }

        // Create unavailable store
        if (!db.objectStoreNames.contains('unavailable')) {
          db.createObjectStore('unavailable', { keyPath: 'key' });
        }
      },
    });

    span.setStatus('ok');
    return new IDBStatelessStorage(db);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    span.addEvent('open.failed', { error: message });
    span.setStatus('ok'); // Not an error condition - graceful fallback
    return null;
  } finally {
    span.end();
  }
}
