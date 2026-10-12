-- Chart drawings (trendlines, etc.), scoped per user + symbol + timeframe.
DROP TABLE IF EXISTS chart_drawings CASCADE;

CREATE TABLE chart_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  kind TEXT NOT NULL,
  p1_time BIGINT NOT NULL,
  p1_price DOUBLE PRECISION NOT NULL,
  p2_time BIGINT NOT NULL,
  p2_price DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chart_drawings_user_symbol_tf
  ON chart_drawings(user_id, symbol, timeframe);

ALTER TABLE chart_drawings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chart drawings"
  ON chart_drawings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chart drawings"
  ON chart_drawings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chart drawings"
  ON chart_drawings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chart drawings"
  ON chart_drawings FOR DELETE
  USING (auth.uid() = user_id);
