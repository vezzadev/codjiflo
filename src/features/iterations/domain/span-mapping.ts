/**
 * SpanTracker Domain: Span Mapping Types
 *
 * Defines how lines/characters map between two snapshots.
 * Pure data types with no infrastructure dependencies.
 */

import type { LineSpan } from './text-span';

/**
 * Type of change for a span mapping
 */
export type SpanMappingType = 'unchanged' | 'modified' | 'deleted' | 'added';

/**
 * Maps a range of lines from left snapshot to right snapshot
 */
export interface LineMapping {
  /** Lines in the left (old) snapshot */
  readonly leftSpan: LineSpan | null;

  /** Lines in the right (new) snapshot */
  readonly rightSpan: LineSpan | null;

  /** Type of change */
  readonly type: SpanMappingType;
}

/**
 * Collection of line mappings for a file between two snapshots
 */
export interface SpanMappingData {
  /** All mappings in order */
  readonly mappings: readonly LineMapping[];

  /** Quick lookup: left line -> right line (null if deleted) */
  readonly leftToRight: ReadonlyMap<number, number | null>;

  /** Quick lookup: right line -> left line (null if added) */
  readonly rightToLeft: ReadonlyMap<number, number | null>;
}

/**
 * Create empty span mapping data
 */
export function emptySpanMappingData(): SpanMappingData {
  return {
    mappings: [],
    leftToRight: new Map(),
    rightToLeft: new Map(),
  };
}

/**
 * Create span mapping data from an array of mappings
 */
export function createSpanMappingData(mappings: LineMapping[]): SpanMappingData {
  const leftToRight: Map<number, number | null> = new Map();
  const rightToLeft: Map<number, number | null> = new Map();

  for (const mapping of mappings) {
    if (mapping.leftSpan && mapping.rightSpan) {
      // Unchanged or modified: map corresponding lines
      const leftLines = mapping.leftSpan.endLine - mapping.leftSpan.startLine + 1;
      const rightLines = mapping.rightSpan.endLine - mapping.rightSpan.startLine + 1;

      if (leftLines === rightLines) {
        // 1:1 mapping
        for (let i = 0; i < leftLines; i++) {
          leftToRight.set(mapping.leftSpan.startLine + i, mapping.rightSpan.startLine + i);
          rightToLeft.set(mapping.rightSpan.startLine + i, mapping.leftSpan.startLine + i);
        }
      } else {
        // Modified region: map to first line of other side
        for (let i = 0; i < leftLines; i++) {
          leftToRight.set(mapping.leftSpan.startLine + i, mapping.rightSpan.startLine);
        }
        for (let i = 0; i < rightLines; i++) {
          rightToLeft.set(mapping.rightSpan.startLine + i, mapping.leftSpan.startLine);
        }
      }
    } else if (mapping.leftSpan) {
      // Deleted: left lines map to null
      const lines = mapping.leftSpan.endLine - mapping.leftSpan.startLine + 1;
      for (let i = 0; i < lines; i++) {
        leftToRight.set(mapping.leftSpan.startLine + i, null);
      }
    } else if (mapping.rightSpan) {
      // Added: right lines map to null
      const lines = mapping.rightSpan.endLine - mapping.rightSpan.startLine + 1;
      for (let i = 0; i < lines; i++) {
        rightToLeft.set(mapping.rightSpan.startLine + i, null);
      }
    }
  }

  return {
    mappings,
    leftToRight,
    rightToLeft,
  };
}

/**
 * Serialized format for SQLite storage
 */
export interface SerializedLineMapping {
  leftStart: number | null;
  leftEnd: number | null;
  rightStart: number | null;
  rightEnd: number | null;
  type: SpanMappingType;
}

/**
 * Serialize mappings for storage
 */
export function serializeMappings(mappings: readonly LineMapping[]): SerializedLineMapping[] {
  return mappings.map((m) => ({
    leftStart: m.leftSpan?.startLine ?? null,
    leftEnd: m.leftSpan?.endLine ?? null,
    rightStart: m.rightSpan?.startLine ?? null,
    rightEnd: m.rightSpan?.endLine ?? null,
    type: m.type,
  }));
}

/**
 * Deserialize mappings from storage
 */
export function deserializeMappings(data: SerializedLineMapping[]): LineMapping[] {
  return data.map((d) => ({
    leftSpan:
      d.leftStart !== null && d.leftEnd !== null
        ? { startLine: d.leftStart, endLine: d.leftEnd }
        : null,
    rightSpan:
      d.rightStart !== null && d.rightEnd !== null
        ? { startLine: d.rightStart, endLine: d.rightEnd }
        : null,
    type: d.type,
  }));
}
