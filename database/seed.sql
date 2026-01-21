-- Sample data for testing

-- Clear existing data
TRUNCATE TABLE transactions, price_cache RESTART IDENTITY CASCADE;

-- Insert sample transactions
INSERT INTO transactions (ticker, transaction_type, transaction_date, quantity, price_per_share) VALUES
  ('AAPL', 'BUY', '2025-01-15', 10, 150.50),
  ('GOOGL', 'BUY', '2025-02-01', 5, 2800.00),
  ('MSFT', 'BUY', '2025-02-15', 8, 380.25),
  ('AAPL', 'BUY', '2025-03-01', 5, 155.75),
  ('TSLA', 'BUY', '2025-03-10', 20, 180.00),
  ('GOOGL', 'SELL', '2025-03-20', 2, 2850.00),
  ('MSFT', 'BUY', '2025-04-01', 3, 390.00);

-- Insert sample price cache (these will be outdated, but good for testing)
INSERT INTO price_cache (ticker, current_price, last_updated) VALUES
  ('AAPL', 152.30, CURRENT_TIMESTAMP),
  ('GOOGL', 2820.50, CURRENT_TIMESTAMP),
  ('MSFT', 385.75, CURRENT_TIMESTAMP),
  ('TSLA', 175.20, CURRENT_TIMESTAMP);
