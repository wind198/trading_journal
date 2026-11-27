import type { LightweightCandle } from '@/lib/ticks/candles'
import { candleFeatures, rollingQuantile, type CandleFeatures } from './candle-features'
import {
  defaultForceCandlesConfig,
  type ForceCandlesConfig,
} from './force-candles-config'

export type BaselineDirection = 'BULLISH' | 'BEARISH'

export type BaselineForceEvent = {
  eventId: number
  time: number
  direction: BaselineDirection
  srcOpen: number
  srcHigh: number
  srcLow: number
  srcClose: number
  score: number
}

export type ForceScorePoint = {
  time: number
  score: number
  direction: BaselineDirection
}

export function calculateForceScoreFromFeatures(
  feature: CandleFeatures,
  bodyFactor: number,
  rangeFactor: number,
  cfg: ForceCandlesConfig,
): number {
  const norm = cfg.normalization
  const w = cfg.weights
  const sBody = Math.min(1, bodyFactor / norm.body_factor_saturation)
  const sRange = Math.min(1, rangeFactor / norm.range_factor_saturation)
  const sEff = Math.min(1, feature.bodyRatio / norm.body_ratio_saturation)
  const sClose = feature.directionalClose
  return (
    100 *
    (w.body_strength * sBody +
      w.range_strength * sRange +
      w.body_efficiency * sEff +
      w.directional_close * sClose)
  )
}

export function calculateForceScores(
  bars: readonly LightweightCandle[],
  config: ForceCandlesConfig = defaultForceCandlesConfig(),
): ForceScorePoint[] {
  const fs = bars.map(candleFeatures)
  const bodies = fs.map((item) => item.body)
  const ranges = fs.map((item) => item.range)
  const pct = config.percentile
  const lookback = config.lookback
  const scores: ForceScorePoint[] = []
  for (let i = lookback; i < bars.length; i++) {
    const feature = fs[i]!
    if (feature.invalidCandle || feature.direction === 0) continue
    const bodyBase = rollingQuantile(bodies, i, lookback, pct)
    const rangeBase = rollingQuantile(ranges, i, lookback, pct)
    if (!(bodyBase > 0) || !(rangeBase > 0)) continue
    const score = calculateForceScoreFromFeatures(
      feature,
      feature.body / bodyBase,
      feature.range / rangeBase,
      config,
    )
    scores.push({
      time: bars[i]!.time,
      score: Math.max(0, Math.min(100, score)),
      direction: feature.direction > 0 ? 'BULLISH' : 'BEARISH',
    })
  }
  return scores
}

export function detectBaselineForce(
  bars: readonly LightweightCandle[],
  config: ForceCandlesConfig = defaultForceCandlesConfig(),
): BaselineForceEvent[] {
  const fs = bars.map(candleFeatures)
  const bodies = fs.map((item) => item.body)
  const ranges = fs.map((item) => item.range)
  const lookback = config.lookback
  const pct = config.percentile
  const events: BaselineForceEvent[] = []
  for (let i = lookback; i < bars.length; i++) {
    const feature = fs[i]!
    if (feature.invalidCandle) continue
    const bodyBase = rollingQuantile(bodies, i, lookback, pct)
    const rangeBase = rollingQuantile(ranges, i, lookback, pct)
    if (!(bodyBase > 0) || !(rangeBase > 0)) continue
    if (feature.direction === 0) continue
    const bodyFactor = feature.body / bodyBase
    const rangeFactor = feature.range / rangeBase
    const score = calculateForceScoreFromFeatures(feature, bodyFactor, rangeFactor, config)
    if (
      feature.bodyRatio < config.min_body_ratio ||
      bodyFactor < config.min_body_p60_factor ||
      rangeFactor < config.min_range_p60_factor ||
      feature.directionalClose < config.min_directional_close ||
      (config.filters.use_opposite_wick &&
        feature.oppositeWickRatio > config.max_opposite_wick_ratio) ||
      score < config.min_force_score
    ) {
      continue
    }
    const bar = bars[i]!
    events.push({
      eventId: i + 1,
      time: bar.time,
      direction: feature.direction > 0 ? 'BULLISH' : 'BEARISH',
      srcOpen: bar.open,
      srcHigh: bar.high,
      srcLow: bar.low,
      srcClose: bar.close,
      score,
    })
  }
  return events
}