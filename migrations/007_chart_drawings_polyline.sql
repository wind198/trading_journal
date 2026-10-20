-- Polyline arrow: multi-point path + optional label at arrow head.
ALTER TABLE chart_drawings
  ADD COLUMN IF NOT EXISTS points JSONB,
  ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT '';
