const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'moon.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Helper to mimic pg's query interface for easy migration
// Supports $1, $2... parameterized queries (converts to ?)
function query(text, params = []) {
  // Convert PostgreSQL $1, $2 placeholders to ?
  let idx = 0;
  const sqliteText = text.replace(/\$\d+/g, () => '?');

  // Determine if it's a SELECT/RETURNING or a write operation
  const trimmed = sqliteText.trim().toUpperCase();
  const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');
  const hasReturning = /RETURNING\s+/i.test(sqliteText);

  if (isSelect) {
    const rows = db.prepare(sqliteText).all(...params);
    return { rows };
  }

  if (hasReturning) {
    // SQLite supports RETURNING in newer versions; better-sqlite3 supports it
    try {
      const rows = db.prepare(sqliteText).all(...params);
      return { rows };
    } catch {
      // Fallback: run without RETURNING, return empty
      const cleanSql = sqliteText.replace(/RETURNING\s+.*/i, '');
      const info = db.prepare(cleanSql).run(...params);
      return { rows: [{ id: info.lastInsertRowid }] };
    }
  }

  const info = db.prepare(sqliteText).run(...params);
  return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
}

// Transaction helper that mimics pg pool.connect() pattern
const pool = {
  connect: () => {
    let inTransaction = false;
    return Promise.resolve({
      query: (text, params) => Promise.resolve(query(text, params)),
      release: () => {},
    });
  },
};

// Override query to return promises (to match async pg interface)
module.exports = {
  query: (text, params) => Promise.resolve(query(text, params)),
  pool: {
    connect: async () => {
      return {
        query: async (text, params) => query(text, params),
        release: () => {},
      };
    },
  },
  db, // raw db access for transactions
};
