/**
 * SQLite Schema for CodjiFlo Iteration Tracking
 *
 * Defines the database schema for storing iterations, file artifacts,
 * content, and precomputed SpanTrackers.
 */

import { SCHEMA_SQL_TEMPLATE } from './schema.generated';

export const SCHEMA_VERSION = 2;

// Replace version placeholder in schema template
export const SCHEMA_SQL = SCHEMA_SQL_TEMPLATE.replace('{{SCHEMA_VERSION}}', String(SCHEMA_VERSION));
