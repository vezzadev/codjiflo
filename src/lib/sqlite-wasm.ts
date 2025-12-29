/**
 * SQL.js (SQLite WASM) Wrapper
 *
 * Provides a typed interface to SQLite compiled to WebAssembly.
 * Used for reading iteration artifacts in the browser.
 *
 * Note: Uses dynamic imports to avoid Node.js module issues in browser.
 */

// Use dynamic imports to avoid 'fs' module issues at build time
 
type SqlJsStatic = import('sql.js').SqlJsStatic;
 
type SqlJsDatabase = import('sql.js').Database;

// ============================================================================
// Module State
// ============================================================================

let SQL: SqlJsStatic | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize SQL.js with WASM.
 * Lazy-loaded on first use via dynamic import.
 */
async function ensureInitialized(): Promise<void> {
  if (SQL) return;

  initPromise ??= (async () => {
    // Dynamic import to avoid Node.js fs module issues at build time
    const initSqlJs = (await import('sql.js')).default;
    SQL = await initSqlJs({
      // WASM file served from public folder
      locateFile: (file: string) => `/sql-wasm/${file}`,
    });
  })();

  await initPromise;
}

// ============================================================================
// SQLite Database Wrapper
// ============================================================================

/**
 * Wrapper around SQL.js Database providing typed query interface.
 */
export class SQLiteDatabase {
  private db: SqlJsDatabase;
  private closed = false;

  private constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  /**
   * Create a SQLiteDatabase from an ArrayBuffer (downloaded artifact).
   */
  static async fromArrayBuffer(buffer: ArrayBuffer): Promise<SQLiteDatabase> {
    await ensureInitialized();

    if (!SQL) {
      throw new Error('SQL.js failed to initialize');
    }

    const db = new SQL.Database(new Uint8Array(buffer));
    return new SQLiteDatabase(db);
  }

  /**
   * Create an empty in-memory database (for testing).
   */
  static async createEmpty(): Promise<SQLiteDatabase> {
    await ensureInitialized();

    if (!SQL) {
      throw new Error('SQL.js failed to initialize');
    }

    const db = new SQL.Database();
    return new SQLiteDatabase(db);
  }

  /**
   * Execute a SQL statement that returns rows.
   *
   * @param sql SQL query with ? placeholders
   * @param params Parameters to bind
   * @returns Array of row objects
   */
  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    this.ensureOpen();

    const stmt = this.db.prepare(sql);
    stmt.bind(params as (string | number | null | Uint8Array)[]);

    const results: T[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as T;
      results.push(row);
    }

    stmt.free();
    return results;
  }

  /**
   * Execute a SQL statement that returns a single row.
   * Uses the same generic type as query() for consistency.
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- Type parameter needed for caller-specified return type
  queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
    const results = this.query<T>(sql, params);
    return results[0];
  }

  /**
   * Execute a SQL statement that doesn't return rows.
   */
  exec(sql: string): void {
    this.ensureOpen();
    this.db.run(sql);
  }

  /**
   * Execute multiple SQL statements (e.g., schema creation).
   */
  execMultiple(sql: string): void {
    this.ensureOpen();
    this.db.exec(sql);
  }

  /**
   * Export the database to a Uint8Array.
   */
  export(): Uint8Array {
    this.ensureOpen();
    return this.db.export();
  }

  /**
   * Close the database and free resources.
   */
  close(): void {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }

  /**
   * Check if the database has been closed.
   */
  isClosed(): boolean {
    return this.closed;
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new Error('Database has been closed');
    }
  }
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type for SQLite column values
 */
export type SQLiteValue = string | number | null | Uint8Array;

/**
 * Type for a generic SQLite row
 */
export type SQLiteRow = Record<string, SQLiteValue>;
