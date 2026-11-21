-- Shared singleton alert preferences. The backend owns detection and delivery.
CREATE TABLE alert_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  force_candle BOOLEAN NOT NULL DEFAULT FALSE,
  double_pattern BOOLEAN NOT NULL DEFAULT FALSE,
  engulfing BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO alert_config DEFAULT VALUES;

ALTER TABLE alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view alert config"
  ON alert_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users insert alert config"
  ON alert_config FOR INSERT TO authenticated WITH CHECK (id = 1);

CREATE POLICY "Authenticated users update alert config"
  ON alert_config FOR UPDATE TO authenticated
  USING (id = 1)
  WITH CHECK (id = 1);
