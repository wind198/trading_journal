-- MT5 execution bridge read model (async projection; not dispatch authority).

CREATE TABLE IF NOT EXISTS execution_devices (
  device_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL DEFAULT 'primary',
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conditional_orders (
  order_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES execution_devices(device_id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL,
  command JSONB NOT NULL,
  execution_state TEXT NOT NULL DEFAULT 'SUBMITTED',
  persistence_status TEXT NOT NULL DEFAULT 'pending',
  recorded_at TIMESTAMPTZ,
  calculated_volume_lots TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS execution_events (
  event_id TEXT PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES conditional_orders(order_id) ON DELETE CASCADE,
  message_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conditional_orders_user_created
  ON conditional_orders(user_id, created_at DESC);

ALTER TABLE execution_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditional_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own execution devices"
  ON execution_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own conditional orders"
  ON conditional_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own execution events"
  ON execution_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conditional_orders co
      WHERE co.order_id = execution_events.order_id AND co.user_id = auth.uid()
    )
  );