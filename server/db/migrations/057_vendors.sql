-- Wave 3 Phase 4: Marketplace - Vendor Management
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT,
  description TEXT,
  logo_url TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'SA',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
  commission_rate REAL DEFAULT 15.0,
  rating REAL DEFAULT 0,
  total_sales REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  bank_name TEXT,
  bank_account TEXT,
  bank_iban TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  approved_at DATETIME
);
