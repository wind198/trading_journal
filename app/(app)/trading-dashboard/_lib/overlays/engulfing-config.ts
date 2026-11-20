import { ENGULFING_DEFAULT } from './config/engulfing.defaults'

export type EngulfingConfig = {
  enabled: boolean
  baseline: { lookback: number; percentile: number }
  geometry: {
    min_penetration: number
    open_tolerance_factor: number
    min_previous_body_factor: number
  }
  force: {
    min_body_ratio: number
    min_body_factor: number
    min_range_factor: number
    min_close_position: number
    min_force_score: number
  }
  scoring: {
    geometry_weight: number
    force_weight: number
    min_pattern_score: number
  }
}

export function validateEngulfingConfig(cfg: EngulfingConfig): EngulfingConfig {
  const gw = cfg.scoring.geometry_weight
  const fw = cfg.scoring.force_weight
  if (gw < 0 || fw < 0) throw new Error('engulfing scoring weights must be nonnegative')
  if (Math.abs(gw + fw - 1) > 1e-6) {
    throw new Error('geometry_weight + force_weight must equal 1')
  }
  const mp = cfg.geometry.min_penetration
  if (!(mp > 0 && mp <= 1)) {
    throw new Error('min_penetration must be in (0, 1]')
  }
  return cfg
}

export function defaultEngulfingConfig(): EngulfingConfig {
  return validateEngulfingConfig({ ...ENGULFING_DEFAULT } as EngulfingConfig)
}