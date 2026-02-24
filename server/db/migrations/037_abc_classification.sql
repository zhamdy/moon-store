-- Feature #18: ABC / Pareto Classification
ALTER TABLE products ADD COLUMN abc_class TEXT DEFAULT 'C' CHECK (abc_class IN ('A', 'B', 'C'));
