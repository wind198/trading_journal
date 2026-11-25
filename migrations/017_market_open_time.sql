BEGIN;
CREATE TABLE public.market_open_time (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market TEXT NOT NULL CHECK (market IN ('sydney','tokyo','london','newyork')),
  open_hour SMALLINT NOT NULL CHECK (open_hour BETWEEN 0 AND 23),
  open_minute SMALLINT NOT NULL CHECK (open_minute BETWEEN 0 AND 59),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, market)
);
ALTER TABLE public.market_open_time ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_open_time FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.market_open_time TO authenticated;
CREATE POLICY "Users read own market openings" ON public.market_open_time FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own market openings" ON public.market_open_time FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own market openings" ON public.market_open_time FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
COMMIT;
