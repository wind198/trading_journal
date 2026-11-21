BEGIN;

ALTER TABLE public.alert_config
  ADD COLUMN IF NOT EXISTS doji boolean NOT NULL DEFAULT false;

INSERT INTO public.alert_config (doji)
SELECT false
WHERE NOT EXISTS (SELECT 1 FROM public.alert_config);

COMMIT;
