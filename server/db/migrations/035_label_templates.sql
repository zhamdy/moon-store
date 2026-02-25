-- Feature #21: Custom Barcode Label Template Designer
CREATE TABLE IF NOT EXISTS label_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  template_json TEXT NOT NULL DEFAULT '{}',
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now'))
);

-- Insert a default label template
INSERT INTO label_templates (name, template_json, is_default) VALUES (
  'Standard Price Tag',
  '{"width":50,"height":30,"unit":"mm","fields":[{"type":"barcode","x":5,"y":2,"w":40,"h":12},{"type":"name","x":5,"y":16,"w":40,"h":5,"fontSize":8},{"type":"price","x":5,"y":22,"w":40,"h":6,"fontSize":12,"bold":true}]}',
  1
);
