-- Feature #7: Sale Notes & Line-Item Memo
-- Feature #10: Tip / Gratuity at Checkout
ALTER TABLE sales ADD COLUMN notes TEXT;
ALTER TABLE sales ADD COLUMN tip_amount REAL DEFAULT 0;
ALTER TABLE sale_items ADD COLUMN memo TEXT;
