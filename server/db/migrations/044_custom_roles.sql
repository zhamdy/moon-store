-- Feature #29: Custom Roles & Permissions
CREATE TABLE IF NOT EXISTS custom_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT (datetime('now'))
);

-- Default roles inserted
INSERT OR IGNORE INTO custom_roles (name, description, permissions) VALUES
('Admin', 'Full access to all features', '{"all": true}'),
('Cashier', 'POS and sales access', '{"pos": true, "sales": true, "inventory": {"view": true}, "customers": {"view": true}}'),
('Delivery', 'Delivery management only', '{"deliveries": true}');
