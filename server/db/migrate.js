const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'moon.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Running migrations...');

const migrationsDir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(migrationsDir).sort();

for (const file of files) {
  if (!file.endsWith('.sql')) continue;
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  console.log(`  Running: ${file}`);
  // Execute each statement separately (SQLite doesn't support multiple statements in one exec for some cases)
  db.exec(sql);
}

console.log('All migrations completed.');
db.close();
process.exit(0);
