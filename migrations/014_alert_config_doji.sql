BEGIN;

ALTER TABLE public.alert_config
  ADD COLUMN IF NOT EXISTS doji boolean NOT NULL DEFAULT false;

INSERT INTO public.alert_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMIT;
