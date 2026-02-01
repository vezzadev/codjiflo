/**
 * Tests for StatelessStorage
 *
 * IndexedDB storage for stateless iteration mode. Uses fake-indexeddb for testing.
 * Tests follow TDD approach - written before implementation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import type {
  StatelessStorage,
  LastSeenRecord,
  IterationRecord,
  UnavailableRecord,
} from './types';
import { IDBStatelessStorage, openStatelessStorage } from './stateless-storage';

// Helper to suppress console.debug during tests
function noop(): void {
  // Intentionally empty - used to suppress console output
}

// Type for parsed span data
interface SpanData {
  attributes: Record<string, string>;
}

// Helper to find a span call in mock.calls
function findSpanCall(
  calls: unknown[][],
  spanName: string
): string | undefined {
  for (const call of calls) {
    const arg = call[0];
    if (typeof arg === 'string' && arg.includes(spanName)) {
      return arg;
    }
  }
  return undefined;
}

describe('StatelessStorage', () => {
  let storage: StatelessStorage;

  beforeEach(async () => {
    // Clear any previous databases
    const databases = await indexedDB.databases();
    for (const dbInfo of databases) {
      if (dbInfo.name) {
        indexedDB.deleteDatabase(dbInfo.name);
      }
    }

    const result = await openStatelessStorage();
    if (!result) {
      throw new Error('Failed to open storage for test');
    }
    storage = result;
  });

  afterEach(() => {
    storage.close();
  });

  describe('openStatelessStorage', () => {
    it('returns a StatelessStorage instance on success', async () => {
      const result = await openStatelessStorage();
      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(IDBStatelessStorage);
      result?.close();
    });

    it('returns null when IndexedDB is unavailable', async () => {
      // Save the original indexedDB
      const originalIndexedDB = globalThis.indexedDB;

      // Remove indexedDB to simulate private browsing
      Object.defineProperty(globalThis, 'indexedDB', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = await openStatelessStorage();
      expect(result).toBeNull();

      // Restore indexedDB
      Object.defineProperty(globalThis, 'indexedDB', {
        value: originalIndexedDB,
        writable: true,
        configurable: true,
      });
    });

    it('returns null when database open fails', async () => {
      // Save the original indexedDB.open
      const originalOpen = globalThis.indexedDB.open.bind(globalThis.indexedDB);

      // Mock open to throw an error
      globalThis.indexedDB.open = () => {
        throw new Error('Simulated failure');
      };

      const result = await openStatelessStorage();
      expect(result).toBeNull();

      // Restore original
      globalThis.indexedDB.open = originalOpen;
    });
  });

  describe('LastSeen operations', () => {
    it('returns undefined for non-existent PR', async () => {
      const result = await storage.getLastSeen('owner/repo/123');
      expect(result).toBeUndefined();
    });

    it('stores and retrieves last seen record', async () => {
      const record: LastSeenRecord = {
        prKey: 'owner/repo/123',
        iterationRevision: 5,
        headSha: 'abc123',
        timestamp: Date.now(),
      };

      await storage.setLastSeen(record);
      const result = await storage.getLastSeen('owner/repo/123');

      expect(result).toEqual(record);
    });

    it('updates existing last seen record', async () => {
      const record1: LastSeenRecord = {
        prKey: 'owner/repo/123',
        iterationRevision: 3,
        headSha: 'sha1',
        timestamp: 1000,
      };

      const record2: LastSeenRecord = {
        prKey: 'owner/repo/123',
        iterationRevision: 5,
        headSha: 'sha2',
        timestamp: 2000,
      };

      await storage.setLastSeen(record1);
      await storage.setLastSeen(record2);

      const result = await storage.getLastSeen('owner/repo/123');
      expect(result).toEqual(record2);
    });

    it('stores last seen records for multiple PRs', async () => {
      const record1: LastSeenRecord = {
        prKey: 'owner/repo/1',
        iterationRevision: 1,
        headSha: 'sha1',
        timestamp: 1000,
      };

      const record2: LastSeenRecord = {
        prKey: 'owner/repo/2',
        iterationRevision: 2,
        headSha: 'sha2',
        timestamp: 2000,
      };

      await storage.setLastSeen(record1);
      await storage.setLastSeen(record2);

      expect(await storage.getLastSeen('owner/repo/1')).toEqual(record1);
      expect(await storage.getLastSeen('owner/repo/2')).toEqual(record2);
    });
  });

  describe('Iteration operations', () => {
    it('returns empty array for non-existent PR', async () => {
      const result = await storage.getIterations('owner/repo/123');
      expect(result).toEqual([]);
    });

    it('stores and retrieves iterations', async () => {
      const records: IterationRecord[] = [
        {
          key: 'owner/repo/123/1',
          prKey: 'owner/repo/123',
          revision: 1,
          commitSha: 'sha1',
          baseSha: 'base1',
          lineage: 'current',
          discoveredAt: Date.now(),
        },
        {
          key: 'owner/repo/123/2',
          prKey: 'owner/repo/123',
          revision: 2,
          commitSha: 'sha2',
          baseSha: 'sha1',
          lineage: 'current',
          discoveredAt: Date.now(),
        },
      ];

      await storage.addIterations(records);
      const result = await storage.getIterations('owner/repo/123');

      expect(result).toHaveLength(2);
      expect(result).toEqual(records);
    });

    it('returns iterations ordered by revision', async () => {
      const records: IterationRecord[] = [
        {
          key: 'owner/repo/123/3',
          prKey: 'owner/repo/123',
          revision: 3,
          commitSha: 'sha3',
          baseSha: 'sha2',
          lineage: 'current',
          discoveredAt: Date.now(),
        },
        {
          key: 'owner/repo/123/1',
          prKey: 'owner/repo/123',
          revision: 1,
          commitSha: 'sha1',
          baseSha: 'base',
          lineage: 'current',
          discoveredAt: Date.now(),
        },
        {
          key: 'owner/repo/123/2',
          prKey: 'owner/repo/123',
          revision: 2,
          commitSha: 'sha2',
          baseSha: 'sha1',
          lineage: 'current',
          discoveredAt: Date.now(),
        },
      ];

      await storage.addIterations(records);
      const result = await storage.getIterations('owner/repo/123');

      expect(result).toHaveLength(3);
      expect(result[0]?.revision).toBe(1);
      expect(result[1]?.revision).toBe(2);
      expect(result[2]?.revision).toBe(3);
    });

    it('silently ignores duplicate iterations (immutability)', async () => {
      const record: IterationRecord = {
        key: 'owner/repo/123/1',
        prKey: 'owner/repo/123',
        revision: 1,
        commitSha: 'sha1',
        baseSha: 'base',
        lineage: 'current',
        discoveredAt: 1000,
      };

      const updatedRecord: IterationRecord = {
        ...record,
        commitSha: 'different-sha', // Try to change the SHA
        discoveredAt: 2000,
      };

      await storage.addIterations([record]);
      await storage.addIterations([updatedRecord]); // Should be silently ignored

      const result = await storage.getIterations('owner/repo/123');
      expect(result).toHaveLength(1);
      expect(result[0]?.commitSha).toBe('sha1'); // Original value preserved
      expect(result[0]?.discoveredAt).toBe(1000); // Original timestamp preserved
    });

    it('stores collapsed iterations with group ID', async () => {
      const record: IterationRecord = {
        key: 'owner/repo/123/1',
        prKey: 'owner/repo/123',
        revision: 1,
        commitSha: 'sha1',
        baseSha: 'base',
        lineage: 'discarded',
        collapsedGroupId: 'group-1',
        discoveredAt: Date.now(),
      };

      await storage.addIterations([record]);
      const result = await storage.getIterations('owner/repo/123');

      expect(result[0]?.lineage).toBe('discarded');
      expect(result[0]?.collapsedGroupId).toBe('group-1');
    });

    it('only returns iterations for requested PR', async () => {
      const pr1Records: IterationRecord[] = [
        {
          key: 'owner/repo/1/1',
          prKey: 'owner/repo/1',
          revision: 1,
          commitSha: 'sha1',
          baseSha: 'base',
          lineage: 'current',
          discoveredAt: Date.now(),
        },
      ];

      const pr2Records: IterationRecord[] = [
        {
          key: 'owner/repo/2/1',
          prKey: 'owner/repo/2',
          revision: 1,
          commitSha: 'sha2',
          baseSha: 'base',
          lineage: 'current',
          discoveredAt: Date.now(),
        },
      ];

      await storage.addIterations([...pr1Records, ...pr2Records]);

      const pr1Result = await storage.getIterations('owner/repo/1');
      const pr2Result = await storage.getIterations('owner/repo/2');

      expect(pr1Result).toHaveLength(1);
      expect(pr1Result[0]?.prKey).toBe('owner/repo/1');
      expect(pr2Result).toHaveLength(1);
      expect(pr2Result[0]?.prKey).toBe('owner/repo/2');
    });

    it('handles empty array input', async () => {
      await storage.addIterations([]);
      const result = await storage.getIterations('owner/repo/123');
      expect(result).toEqual([]);
    });

    it('adds new iterations without affecting existing ones', async () => {
      const existing: IterationRecord = {
        key: 'owner/repo/123/1',
        prKey: 'owner/repo/123',
        revision: 1,
        commitSha: 'sha1',
        baseSha: 'base',
        lineage: 'current',
        discoveredAt: 1000,
      };

      const newRecord: IterationRecord = {
        key: 'owner/repo/123/2',
        prKey: 'owner/repo/123',
        revision: 2,
        commitSha: 'sha2',
        baseSha: 'sha1',
        lineage: 'current',
        discoveredAt: 2000,
      };

      await storage.addIterations([existing]);
      await storage.addIterations([newRecord]);

      const result = await storage.getIterations('owner/repo/123');
      expect(result).toHaveLength(2);
    });
  });

  describe('Unavailable operations', () => {
    it('returns false for non-existent unavailable record', async () => {
      const result = await storage.isUnavailable('owner/repo/123', 1);
      expect(result).toBe(false);
    });

    it('marks iteration as unavailable and checks correctly', async () => {
      const record: UnavailableRecord = {
        key: 'owner/repo/123/1',
        prKey: 'owner/repo/123',
        revision: 1,
        reason: '404',
        detectedAt: Date.now(),
      };

      await storage.markUnavailable(record);
      const result = await storage.isUnavailable('owner/repo/123', 1);

      expect(result).toBe(true);
    });

    it('correctly identifies different unavailable reasons', async () => {
      const record404: UnavailableRecord = {
        key: 'owner/repo/123/1',
        prKey: 'owner/repo/123',
        revision: 1,
        reason: '404',
        detectedAt: Date.now(),
      };

      const record410: UnavailableRecord = {
        key: 'owner/repo/123/2',
        prKey: 'owner/repo/123',
        revision: 2,
        reason: '410',
        detectedAt: Date.now(),
      };

      const recordUnknown: UnavailableRecord = {
        key: 'owner/repo/123/3',
        prKey: 'owner/repo/123',
        revision: 3,
        reason: 'unknown',
        detectedAt: Date.now(),
      };

      await storage.markUnavailable(record404);
      await storage.markUnavailable(record410);
      await storage.markUnavailable(recordUnknown);

      expect(await storage.isUnavailable('owner/repo/123', 1)).toBe(true);
      expect(await storage.isUnavailable('owner/repo/123', 2)).toBe(true);
      expect(await storage.isUnavailable('owner/repo/123', 3)).toBe(true);
      expect(await storage.isUnavailable('owner/repo/123', 4)).toBe(false);
    });

    it('updates existing unavailable record', async () => {
      const record1: UnavailableRecord = {
        key: 'owner/repo/123/1',
        prKey: 'owner/repo/123',
        revision: 1,
        reason: '404',
        detectedAt: 1000,
      };

      const record2: UnavailableRecord = {
        key: 'owner/repo/123/1',
        prKey: 'owner/repo/123',
        revision: 1,
        reason: '410',
        detectedAt: 2000,
      };

      await storage.markUnavailable(record1);
      await storage.markUnavailable(record2);

      const result = await storage.isUnavailable('owner/repo/123', 1);
      expect(result).toBe(true);
    });

    it('handles unavailable records for different PRs', async () => {
      const record1: UnavailableRecord = {
        key: 'owner/repo/1/1',
        prKey: 'owner/repo/1',
        revision: 1,
        reason: '404',
        detectedAt: Date.now(),
      };

      const record2: UnavailableRecord = {
        key: 'owner/repo/2/1',
        prKey: 'owner/repo/2',
        revision: 1,
        reason: '410',
        detectedAt: Date.now(),
      };

      await storage.markUnavailable(record1);
      await storage.markUnavailable(record2);

      expect(await storage.isUnavailable('owner/repo/1', 1)).toBe(true);
      expect(await storage.isUnavailable('owner/repo/2', 1)).toBe(true);
      expect(await storage.isUnavailable('owner/repo/1', 2)).toBe(false);
    });
  });

  describe('Lifecycle', () => {
    it('can close storage without error', () => {
      expect(() => storage.close()).not.toThrow();
    });

    it('can close storage multiple times without error', () => {
      storage.close();
      expect(() => storage.close()).not.toThrow();
    });
  });

  describe('OTel tracing', () => {
    it('creates spans for getLastSeen', async () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(noop);

      await storage.getLastSeen('owner/repo/123');

      expect(debugSpy).toHaveBeenCalled();
      const spanJson = findSpanCall(debugSpy.mock.calls, 'storage.getLastSeen');
      expect(spanJson).toBeDefined();

      debugSpy.mockRestore();
    });

    it('creates spans for setLastSeen', async () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(noop);

      await storage.setLastSeen({
        prKey: 'owner/repo/123',
        iterationRevision: 1,
        headSha: 'sha',
        timestamp: Date.now(),
      });

      expect(debugSpy).toHaveBeenCalled();
      const spanJson = findSpanCall(debugSpy.mock.calls, 'storage.setLastSeen');
      expect(spanJson).toBeDefined();

      debugSpy.mockRestore();
    });

    it('creates spans for getIterations', async () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(noop);

      await storage.getIterations('owner/repo/123');

      expect(debugSpy).toHaveBeenCalled();
      const spanJson = findSpanCall(debugSpy.mock.calls, 'storage.getIterations');
      expect(spanJson).toBeDefined();

      debugSpy.mockRestore();
    });

    it('creates spans for addIterations', async () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(noop);

      await storage.addIterations([]);

      expect(debugSpy).toHaveBeenCalled();
      const spanJson = findSpanCall(debugSpy.mock.calls, 'storage.addIterations');
      expect(spanJson).toBeDefined();

      debugSpy.mockRestore();
    });

    it('creates spans for isUnavailable', async () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(noop);

      await storage.isUnavailable('owner/repo/123', 1);

      expect(debugSpy).toHaveBeenCalled();
      const spanJson = findSpanCall(debugSpy.mock.calls, 'storage.isUnavailable');
      expect(spanJson).toBeDefined();

      debugSpy.mockRestore();
    });

    it('creates spans for markUnavailable', async () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(noop);

      await storage.markUnavailable({
        key: 'owner/repo/123/1',
        prKey: 'owner/repo/123',
        revision: 1,
        reason: '404',
        detectedAt: Date.now(),
      });

      expect(debugSpy).toHaveBeenCalled();
      const spanJson = findSpanCall(debugSpy.mock.calls, 'storage.markUnavailable');
      expect(spanJson).toBeDefined();

      debugSpy.mockRestore();
    });

    it('includes storage.operation and storage.key attributes', async () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(noop);

      await storage.getLastSeen('owner/repo/123');

      const spanJson = findSpanCall(debugSpy.mock.calls, 'storage.getLastSeen');
      expect(spanJson).toBeDefined();
      if (spanJson) {
        const spanData = JSON.parse(spanJson) as SpanData;
        expect(spanData.attributes).toBeDefined();
        expect(spanData.attributes['storage.operation']).toBe('getLastSeen');
        expect(spanData.attributes['storage.key']).toBe('owner/repo/123');
      }

      debugSpy.mockRestore();
    });
  });
});
