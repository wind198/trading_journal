/** Mirrors `force-candles.default.json` (bundler-safe; Next cannot load JSON via createRequire). */
export const FORCE_CANDLES_DEFAULT = {
  lookback: 100,
  percentile: 60,
  min_body_ratio: 0.65,
  min_body_p60_factor: 1.0,
  min_range_p60_factor: 1.0,
  min_directional_close: 0.8,
  max_opposite_wick_ratio: 0.2,
  min_force_score: 65,
  normalization: {
    body_factor_saturation: 2.5,
    range_factor_saturation: 2.5,
    body_ratio_saturation: 0.85,
  },
  weights: {
    body_strength: 0.3,
    range_strength: 0.25,
    body_efficiency: 0.3,
    directional_close: 0.15,
  },
  filters: { use_opposite_wick: true },
}