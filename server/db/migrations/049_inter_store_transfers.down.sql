-- Reverse 049_inter_store_transfers
DROP TABLE IF EXISTS transfer_request_items;
DROP TABLE IF EXISTS transfer_requests;
-- Note: SQLite cannot drop columns added via ALTER TABLE (expected_date, reference_number, approved_by on stock_transfers)
