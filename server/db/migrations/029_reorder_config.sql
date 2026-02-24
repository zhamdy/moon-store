-- Feature #14: Automated Reorder Point & PO Suggestions
ALTER TABLE products ADD COLUMN lead_time_days INTEGER DEFAULT 7;
ALTER TABLE products ADD COLUMN reorder_qty INTEGER DEFAULT 0;
