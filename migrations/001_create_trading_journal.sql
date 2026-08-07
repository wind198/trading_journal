-- Reset trading_journal to slim checklist schema.
-- If an older trading_journal already exists, this drops it (data loss).
DROP TABLE IF EXISTS trading_journal CASCADE;

CREATE TABLE trading_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  buy_or_sell VARCHAR(4) NOT NULL CHECK (buy_or_sell IN ('BUY', 'SELL')),
  order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('EXTREME', 'TREND_FOLLOWING')),
  win BOOLEAN DEFAULT NULL
);

CREATE INDEX idx_trading_journal_user_id ON trading_journal(user_id);
CREATE INDEX idx_trading_journal_created_at ON trading_journal(created_at DESC);

ALTER TABLE trading_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trades"
  ON trading_journal
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trades"
  ON trading_journal
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades"
  ON trading_journal
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trades"
  ON trading_journal
  FOR DELETE
  USING (auth.uid() = user_id);
