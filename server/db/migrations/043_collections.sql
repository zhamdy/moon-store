-- Feature #27: Fashion Collections
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  season TEXT CHECK (season IN ('Spring', 'Summer', 'Fall', 'Winter')),
  year INTEGER,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'on_sale', 'archived')),
  description TEXT,
  image_url TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  sort_order INTEGER DEFAULT 0,
  UNIQUE(collection_id, product_id)
);
