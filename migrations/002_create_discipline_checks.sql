-- One day per user, then a list of discipline items each with its own checked status.
DROP TABLE IF EXISTS discipline_check_items CASCADE;
DROP TABLE IF EXISTS discipline_days CASCADE;

CREATE TABLE discipline_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, check_date)
);

CREATE TABLE discipline_check_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES discipline_days(id) ON DELETE CASCADE,
  item_key VARCHAR(64) NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (day_id, item_key)
);

CREATE INDEX idx_discipline_days_user_date
  ON discipline_days(user_id, check_date DESC);

CREATE INDEX idx_discipline_check_items_day
  ON discipline_check_items(day_id);

ALTER TABLE discipline_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE discipline_check_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own discipline days"
  ON discipline_days FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own discipline days"
  ON discipline_days FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own discipline days"
  ON discipline_days FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own discipline days"
  ON discipline_days FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own discipline items"
  ON discipline_check_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM discipline_days d
      WHERE d.id = day_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own discipline items"
  ON discipline_check_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM discipline_days d
      WHERE d.id = day_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own discipline items"
  ON discipline_check_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM discipline_days d
      WHERE d.id = day_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own discipline items"
  ON discipline_check_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM discipline_days d
      WHERE d.id = day_id AND d.user_id = auth.uid()
    )
  );
