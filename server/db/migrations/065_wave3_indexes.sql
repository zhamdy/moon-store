-- Migration 065: Add missing indexes for Wave 3 tables (050-064)
-- These tables had zero CREATE INDEX statements, relying only on PRIMARY KEY and UNIQUE constraints.

-- 050: customer_addresses
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);

-- 050: wishlists (UNIQUE(customer_id, product_id) covers composite, add individual product index)
CREATE INDEX IF NOT EXISTS idx_wishlists_product ON wishlists(product_id);

-- 051: online_orders
CREATE INDEX IF NOT EXISTS idx_online_orders_customer ON online_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(status);
CREATE INDEX IF NOT EXISTS idx_online_orders_payment_status ON online_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_online_orders_created ON online_orders(created_at);

-- 051: online_order_items
CREATE INDEX IF NOT EXISTS idx_online_order_items_order ON online_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_online_order_items_product ON online_order_items(product_id);

-- 051: shopping_carts
CREATE INDEX IF NOT EXISTS idx_shopping_carts_customer ON shopping_carts(customer_id);

-- 052: product_reviews
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer ON product_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_approved ON product_reviews(is_approved);

-- 052: product_questions
CREATE INDEX IF NOT EXISTS idx_product_questions_product ON product_questions(product_id);

-- 054: saved_reports
CREATE INDEX IF NOT EXISTS idx_saved_reports_created_by ON saved_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_saved_reports_type ON saved_reports(report_type);

-- 054: scheduled_reports
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_report ON scheduled_reports(report_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at);

-- 055: product_performance (UNIQUE(product_id, period) covers composite)
CREATE INDEX IF NOT EXISTS idx_product_performance_period ON product_performance(period);

-- 056: dashboard_widgets
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_user ON dashboard_widgets(user_id);

-- 057: vendors
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);

-- 058: vendor_product_approvals
CREATE INDEX IF NOT EXISTS idx_vendor_approvals_product ON vendor_product_approvals(product_id);
CREATE INDEX IF NOT EXISTS idx_vendor_approvals_vendor ON vendor_product_approvals(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_approvals_status ON vendor_product_approvals(status);

-- 059: vendor_commissions
CREATE INDEX IF NOT EXISTS idx_vendor_commissions_vendor ON vendor_commissions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_commissions_sale ON vendor_commissions(sale_id);
CREATE INDEX IF NOT EXISTS idx_vendor_commissions_status ON vendor_commissions(status);

-- 059: vendor_payouts
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor ON vendor_payouts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status ON vendor_payouts(status);

-- 060: vendor_reviews
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor ON vendor_reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_customer ON vendor_reviews(customer_id);

-- 061: price_suggestions
CREATE INDEX IF NOT EXISTS idx_price_suggestions_product ON price_suggestions(product_id);
CREATE INDEX IF NOT EXISTS idx_price_suggestions_status ON price_suggestions(status);

-- 062: chat_sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_customer ON chat_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);

-- 062: chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

-- 062: knowledge_base
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);

-- 063: sales_predictions
CREATE INDEX IF NOT EXISTS idx_sales_predictions_category ON sales_predictions(category);

-- 063: trend_analysis
CREATE INDEX IF NOT EXISTS idx_trend_analysis_entity ON trend_analysis(entity_type, entity_id);

-- 064: ai_generation_log
CREATE INDEX IF NOT EXISTS idx_ai_generation_log_product ON ai_generation_log(product_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_log_type ON ai_generation_log(generation_type);
