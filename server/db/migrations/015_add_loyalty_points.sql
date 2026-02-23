-- Add loyalty_points to customers
ALTER TABLE customers ADD COLUMN loyalty_points INTEGER DEFAULT 0;

-- Create loyalty_transactions log
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    sale_id INTEGER REFERENCES sales(id),
    points INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('earned', 'redeemed', 'adjustment', 'refund_deduct')),
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Add loyalty settings (earn_rate: points per $1, redeem_value: $ per 100 points)
INSERT OR IGNORE INTO settings (key, value) VALUES ('loyalty_enabled', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('loyalty_earn_rate', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('loyalty_redeem_value', '5');

-- Add points_redeemed column to sales for tracking redemptions
ALTER TABLE sales ADD COLUMN points_redeemed INTEGER DEFAULT 0;
