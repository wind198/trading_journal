/** Mirrors `engulfing.default.json` (bundler-safe). */
export const ENGULFING_DEFAULT = {
  enabled: true,
  baseline: { lookback: 100, percentile: 60 },
  geometry: {
    min_penetration: 0.6,
    open_tolerance_factor: 0,
    min_previous_body_factor: 0.5,
  },
  force: {
    min_body_ratio: 0.55,
    min_body_factor: 1.0,
    min_range_factor: 1.0,
    min_close_position: 0.7,
    min_force_score: 50,
  },
  scoring: {
    geometry_weight: 0.4,
    force_weight: 0.6,
    min_pattern_score: 60,
  },
}