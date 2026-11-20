import type { LightweightCandle } from '@/lib/ticks/candles'
import { candleFeatures, rollingQuantile } from './candle-features'
import { calculateForceScoreFromFeatures, type BaselineDirection } from './force-candles'
import { defaultForceCandlesConfig } from './force-candles-config'
import {
  defaultEngulfingConfig,
  type EngulfingConfig,
} from './engulfing-config'

export type BaselineEngulfingEvent = {
  time: number
  direction: BaselineDirection
  srcOpen: number
  srcHigh: number
  srcLow: number
  srcClose: number
  score: number
}

export function geometryScore(penetration: number, minPenetration: number): number {
  if (minPenetration >= 1) return penetration >= minPenetration ? 100 : 0
  return 100 * Math.max(0, Math.min(1, (penetration - minPenetration) / (1 - minPenetration)))
}

export function detectBaselineEngulfing(
  bars: readonly LightweightCandle[],
  config: EngulfingConfig = defaultEngulfingConfig(),
): BaselineEngulfingEvent[] {
  if (!config.enabled) return []

  const fs = bars.map(candleFeatures)
  const bodies = fs.map((item) => item.body)
  const ranges = fs.map((item) => item.range)
  const lookback = config.baseline.lookback
  const pct = config.baseline.percentile
  const geom = config.geometry
  const force = config.force
  const scoring = config.scoring
  const forceCfg = defaultForceCandlesConfig()
  const events: BaselineEngulfingEvent[] = []

  for (let i = 1; i < bars.length; i++) {
    if (i < lookback) continue
    const prior = bars[i - 1]!
    const bar = bars[i]!
    const f1 = fs[i - 1]!
    const f2 = fs[i]!
    if (f1.invalidCandle || f2.invalidCandle) continue
    if (f1.direction === 0 || f2.direction === 0 || f1.direction === f2.direction) continue

    const bodyBase1 = rollingQuantile(bodies, i - 1, lookback, pct)
    const rangeBase1 = rollingQuantile(ranges, i - 1, lookback, pct)
    const bodyBase2 = rollingQuantile(bodies, i, lookback, pct)
    const rangeBase2 = rollingQuantile(ranges, i, lookback, pct)
    if (!(bodyBase1 > 0) || !(rangeBase1 > 0) || !(bodyBase2 > 0) || !(rangeBase2 > 0)) continue

    const previousBodyFactor = f1.body / bodyBase1
    if (previousBodyFactor < geom.min_previous_body_factor) continue

    const eps = geom.open_tolerance_factor * rangeBase2
    let penetration: number | null = null
    if (f2.direction > 0) {
      if (bar.open > prior.close + eps) continue
      const denominator = prior.open - prior.close
      if (!(denominator > 0)) continue
      penetration = (bar.close - prior.close) / denominator
    } else {
      if (bar.open < prior.close - eps) continue
      const denominator = prior.close - prior.open
      if (!(denominator > 0)) continue
      penetration = (prior.close - bar.close) / denominator
    }
    if (penetration == null || penetration < geom.min_penetration) continue

    const bodyFactor = f2.body / bodyBase2
    const rangeFactor = f2.range / rangeBase2
    const forceScore = calculateForceScoreFromFeatures(f2, bodyFactor, rangeFactor, forceCfg)
    if (
      f2.bodyRatio < force.min_body_ratio ||
      bodyFactor < force.min_body_factor ||
      rangeFactor < force.min_range_factor ||
      f2.directionalClose < force.min_close_position ||
      forceScore < force.min_force_score
    ) {
      continue
    }

    const gscore = geometryScore(penetration, geom.min_penetration)
    const patternScore =
      scoring.geometry_weight * gscore + scoring.force_weight * forceScore
    if (patternScore < scoring.min_pattern_score) continue

    events.push({
      time: bar.time,
      direction: f2.direction > 0 ? 'BULLISH' : 'BEARISH',
      srcOpen: bar.open,
      srcHigh: bar.high,
      srcLow: bar.low,
      srcClose: bar.close,
      score: patternScore,
    })
  }
  return events
}