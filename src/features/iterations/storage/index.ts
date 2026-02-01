/**
 * Stateless Storage (Milestone 4.2)
 *
 * IndexedDB-based persistence for stateless iteration mode.
 */

export type {
  LastSeenRecord,
  IterationRecord,
  UnavailableRecord,
  StatelessStorage,
} from './types';

export { openStatelessStorage } from './stateless-storage';
