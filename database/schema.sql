-- Stock Portfolio Tracker Database Schema

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  ticker VARCHAR(10) NOT NULL,
  transaction_type VARCHAR(4) NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
  transaction_date DATE NOT NULL,
  quantity DECIMAL(10, 4) NOT NULL CHECK (quantity > 0),
  price_per_share DECIMAL(10, 2) NOT NULL CHECK (price_per_share > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create price_cache table to avoid API rate limits
CREATE TABLE IF NOT EXISTS price_cache (
  ticker VARCHAR(10) PRIMARY KEY,
  current_price DECIMAL(10, 2) NOT NULL,
  last_updated TIMESTAMP NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_ticker ON transactions(ticker);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_price_cache_updated ON price_cache(last_updated);
