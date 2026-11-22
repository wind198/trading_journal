BEGIN;

DROP TABLE IF EXISTS public.alert_config;

CREATE TABLE public.alert_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  force_candle BOOLEAN NOT NULL DEFAULT FALSE,
  double_pattern BOOLEAN NOT NULL DEFAULT FALSE,
  engulfing BOOLEAN NOT NULL DEFAULT FALSE,
  doji BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own alert config"
  ON public.alert_config FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own alert config"
  ON public.alert_config FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own alert config"
  ON public.alert_config FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
