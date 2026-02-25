import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(__dirname, 'moon.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create migrations tracking table
db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT DEFAULT (datetime('now'))
)`);

// Helper to check if a column exists on a table
function hasColumn(table: string, column: string): boolean {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return cols.some((c) => c.name === column);
  } catch {
    return false;
  }
}

function tableExists(name: string): boolean {
  const result = db
    .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?")
    .get(name) as { count: number };
  return result.count > 0;
}

// --down [N] flag: rollback last N migrations (default 1)
const downIndex = process.argv.indexOf('--down');
if (downIndex !== -1) {
  const count = parseInt(process.argv[downIndex + 1], 10) || 1;
  runDown(count);
} else {
  runUp();
}

function runDown(count: number): void {
  console.log(`Rolling back last ${count} migration(s)...`);

  const migrationsDir = path.join(__dirname, 'migrations');
  const applied = db
    .prepare('SELECT id, name FROM _migrations ORDER BY id DESC LIMIT ?')
    .all(count) as Array<{ id: number; name: string }>;

  if (applied.length === 0) {
    console.log('  No migrations to roll back.');
    db.close();
    process.exit(0);
  }

  for (const migration of applied) {
    const downFile = migration.name.replace('.sql', '.down.sql');
    const downPath = path.join(migrationsDir, downFile);

    if (!fs.existsSync(downPath)) {
      console.warn(
        `  WARNING: No down migration found for ${migration.name} (expected ${downFile}). Skipping.`
      );
      continue;
    }

    const sql = fs.readFileSync(downPath, 'utf8');
    console.log(`  Rolling back: ${migration.name}`);

    const needsFkOff = sql.includes('-- @FK_OFF');
    if (needsFkOff) db.pragma('foreign_keys = OFF');
    db.exec(sql);
    if (needsFkOff) db.pragma('foreign_keys = ON');

    db.prepare('DELETE FROM _migrations WHERE id = ?').run(migration.id);
    console.log(`  Removed from tracking: ${migration.name}`);
  }

  console.log('Rollback completed.');
  db.close();
  process.exit(0);
}

function runUp(): void {
  // Always reconcile: mark migrations as applied if their artifacts already exist
  const reconcile: Record<string, () => boolean> = {
    '001_create_users.sql': () => tableExists('users'),
    '002_create_refresh_tokens.sql': () => tableExists('refresh_tokens'),
    '003_create_products.sql': () => tableExists('products'),
    '004_create_sales.sql': () => tableExists('sales'),
    '005_create_delivery_orders.sql': () => tableExists('delivery_orders'),
    '006_create_offline_sync.sql': () => tableExists('offline_sync_queue'),
    '007_create_customers.sql': () =>
      tableExists('customers') && hasColumn('delivery_orders', 'customer_id'),
    '008_create_categories_and_distributors.sql': () =>
      tableExists('categories') && hasColumn('products', 'category_id'),
  };

  const insert = db.prepare('INSERT OR IGNORE INTO _migrations (name) VALUES (?)');
  for (const [name, check] of Object.entries(reconcile)) {
    if (check()) {
      insert.run(name);
    }
  }

  console.log('Running migrations...');

  // Migration naming convention:
  //   {NNN}_{description}.sql  (e.g. 066_add_reviews.sql)
  // - NNN is a zero-padded sequential number
  // - Each number should be unique (note: 021 has two files — a legacy duplicate
  //   that is harmless since they are independent, but avoid repeating this)
  // - Indexes follow: idx_{table}_{column}
  // - Use "IF NOT EXISTS" for all CREATE TABLE/INDEX statements
  // - Files are sorted lexicographically and run in order
  // - Down migrations use {NNN}_{description}.down.sql naming
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((r) => (r as { name: string }).name)
  );

  for (const file of files) {
    if (!file.endsWith('.sql') || file.includes('.down.sql')) continue;
    if (applied.has(file)) {
      console.log(`  Skipping (already applied): ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`  Running: ${file}`);
    // Temporarily disable FK checks if migration needs table rebuild
    const needsFkOff = sql.includes('-- @FK_OFF');
    if (needsFkOff) db.pragma('foreign_keys = OFF');
    db.exec(sql);
    if (needsFkOff) db.pragma('foreign_keys = ON');
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
  }

  console.log('All migrations completed.');
  db.close();
  process.exit(0);
}
