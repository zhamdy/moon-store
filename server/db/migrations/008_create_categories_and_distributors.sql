-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- Distributors table
CREATE TABLE IF NOT EXISTS distributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- Seed default categories from existing product data
INSERT OR IGNORE INTO categories (name, code) VALUES ('Dresses', 'DRS');
INSERT OR IGNORE INTO categories (name, code) VALUES ('Knitwear', 'KNT');
INSERT OR IGNORE INTO categories (name, code) VALUES ('Bags', 'BAG');
INSERT OR IGNORE INTO categories (name, code) VALUES ('Bottoms', 'BTM');
INSERT OR IGNORE INTO categories (name, code) VALUES ('Jewelry', 'JWL');
INSERT OR IGNORE INTO categories (name, code) VALUES ('Tops', 'TOP');
INSERT OR IGNORE INTO categories (name, code) VALUES ('Outerwear', 'JKT');
INSERT OR IGNORE INTO categories (name, code) VALUES ('Shoes', 'SHO');
INSERT OR IGNORE INTO categories (name, code) VALUES ('Accessories', 'ACC');

-- Add category_id and distributor_id columns to products
ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id);
ALTER TABLE products ADD COLUMN distributor_id INTEGER REFERENCES distributors(id);

-- Backfill category_id from existing category text
UPDATE products SET category_id = (SELECT id FROM categories WHERE categories.name = products.category) WHERE category IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_distributor_id ON products(distributor_id);
