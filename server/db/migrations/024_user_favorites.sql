-- Feature #3: Quick-Add Favorites Grid
ALTER TABLE users ADD COLUMN favorites TEXT DEFAULT '[]';
