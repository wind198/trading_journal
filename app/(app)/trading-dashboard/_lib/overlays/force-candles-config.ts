import { FORCE_CANDLES_DEFAULT } from './config/force-candles.defaults'

export type ForceCandlesConfig = {
  lookback: number
  percentile: number
  min_body_ratio: number
  min_body_p60_factor: number
  min_range_p60_factor: number
  min_directional_close: number
  max_opposite_wick_ratio: number
  min_force_score: number
  normalization: {
    body_factor_saturation: number
    range_factor_saturation: number
    body_ratio_saturation: number
  }
  weights: {
    body_strength: number
    range_strength: number
    body_efficiency: number
    directional_close: number
  }
  filters: { use_opposite_wick: boolean }
}

export function validateForceCandlesConfig(cfg: ForceCandlesConfig): ForceCandlesConfig {
  const w = cfg.weights
  const total =
    w.body_strength + w.range_strength + w.body_efficiency + w.directional_close
  if (Math.abs(total - 1) > 1e-6) {
    throw new Error(`force_candles weights must sum to 1, got ${total}`)
  }
  if (
    w.body_strength < 0 ||
    w.range_strength < 0 ||
    w.body_efficiency < 0 ||
    w.directional_close < 0
  ) {
    throw new Error('force_candles weights must be nonnegative')
  }
  return {
    ...cfg,
    filters: { use_opposite_wick: true, ...cfg.filters },
  }
}

export function defaultForceCandlesConfig(): ForceCandlesConfig {
  return validateForceCandlesConfig({ ...FORCE_CANDLES_DEFAULT } as ForceCandlesConfig)
}