-- Wave 3 Phase 2: E-commerce - Product reviews
CREATE TABLE IF NOT EXISTS product_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  is_verified INTEGER DEFAULT 0,
  is_approved INTEGER DEFAULT 1,
  helpful_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now'))
);

-- Product Q&A
CREATE TABLE IF NOT EXISTS product_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id),
  question TEXT NOT NULL,
  answer TEXT,
  answered_by INTEGER REFERENCES users(id),
  is_public INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT (datetime('now')),
  answered_at DATETIME
);
