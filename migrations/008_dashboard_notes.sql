-- Dashboard notes (global list per user; symbol column for pair tagging).
CREATE TABLE dashboard_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dashboard_notes_user_created
  ON dashboard_notes(user_id, created_at DESC);

CREATE INDEX idx_dashboard_notes_user_symbol_created
  ON dashboard_notes(user_id, symbol, created_at DESC);

ALTER TABLE dashboard_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own dashboard notes"
  ON dashboard_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dashboard notes"
  ON dashboard_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboard notes"
  ON dashboard_notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboard notes"
  ON dashboard_notes FOR DELETE
  USING (auth.uid() = user_id);
