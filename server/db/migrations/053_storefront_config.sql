-- Wave 3 Phase 2: E-commerce - Storefront configuration
CREATE TABLE IF NOT EXISTS storefront_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT,
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- Insert default storefront settings
INSERT INTO storefront_config (config_key, config_value) VALUES
  ('store_name', 'MOON Fashion & Style'),
  ('store_description', 'Luxury fashion retail'),
  ('hero_title', 'Discover Your Style'),
  ('hero_subtitle', 'Premium fashion for the modern you'),
  ('shipping_free_threshold', '500'),
  ('shipping_standard_rate', '25'),
  ('shipping_express_rate', '50'),
  ('return_policy_days', '14'),
  ('storefront_enabled', 'true'),
  ('featured_category', 'Evening Wear');

-- Banners / hero slides
CREATE TABLE IF NOT EXISTS storefront_banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  position INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT (datetime('now'))
);
