-- Wave 3 Phase 5: AI - Auto Descriptions & Image Search
ALTER TABLE products ADD COLUMN ai_description TEXT;
ALTER TABLE products ADD COLUMN image_embedding TEXT; -- JSON array of floats for visual similarity
ALTER TABLE products ADD COLUMN seo_title TEXT;
ALTER TABLE products ADD COLUMN seo_description TEXT;
ALTER TABLE products ADD COLUMN tags TEXT; -- comma-separated auto-generated tags

CREATE TABLE IF NOT EXISTS ai_generation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER REFERENCES products(id),
  generation_type TEXT NOT NULL CHECK (generation_type IN ('description', 'tags', 'seo', 'image_embedding')),
  input_data TEXT,
  output_data TEXT,
  model_used TEXT DEFAULT 'local',
  created_at DATETIME DEFAULT (datetime('now'))
);
