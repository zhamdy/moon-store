import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';

interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount?: number;
  lastInsertRowid?: number | bigint;
}

interface PoolClient {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
  release: () => void;
}

const dbPath = path.join(__dirname, 'moon.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Helper to mimic pg's query interface for easy migration
// Supports $1, $2... parameterized queries (converts to ?)
function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): QueryResult<T> {
  // Convert PostgreSQL $1, $2 placeholders to ?
  const sqliteText = text.replace(/\$\d+/g, () => '?');

  // Determine if it's a SELECT/RETURNING or a write operation
  const trimmed = sqliteText.trim().toUpperCase();
  const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');
  const hasReturning = /RETURNING\s+/i.test(sqliteText);

  if (isSelect) {
    const rows = db.prepare(sqliteText).all(...params) as T[];
    return { rows };
  }

  if (hasReturning) {
    // SQLite supports RETURNING in newer versions; better-sqlite3 supports it
    try {
      const rows = db.prepare(sqliteText).all(...params) as T[];
      return { rows };
    } catch (err: unknown) {
      // Only fall back for RETURNING-specific incompatibility, rethrow other errors
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('RETURNING') || message.includes('near "RETURNING"')) {
        const cleanSql = sqliteText.replace(/RETURNING\s+.*/i, '');
        const info = db.prepare(cleanSql).run(...params);
        return { rows: [{ id: info.lastInsertRowid } as unknown as T] };
      }
      throw err;
    }
  }

  const info = db.prepare(sqliteText).run(...params);
  return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
}

// Override query to return promises (to match async pg interface)
export = {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>> =>
    Promise.resolve(query<T>(text, params)),
  pool: {
    connect: async (): Promise<PoolClient> => {
      return {
        query: async <T = Record<string, unknown>>(text: string, params?: unknown[]) =>
          query<T>(text, params),
        release: () => {},
      };
    },
  },
  db: db as DatabaseType, // raw db access for transactions
};
