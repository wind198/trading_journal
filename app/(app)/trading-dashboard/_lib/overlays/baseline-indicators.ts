import type { LightweightCandle } from '@/lib/ticks/candles'
import { quantile } from './candle-features'

export type {
  BaselineDirection,
  BaselineForceEvent,
  ForceScorePoint,
} from './force-candles'
export { calculateForceScores, detectBaselineForce } from './force-candles'
export type { BaselineEngulfingEvent } from './engulfing'
export { detectBaselineEngulfing, geometryScore } from './engulfing'
export type { BaselineDojiEvent } from './doji'
export { detectBaselineDoji } from './doji'

export type Regime = 'UP' | 'DOWN' | 'CHOPPY'
export type RegimeSegment = { startTime: number; endTime: number; regime: Regime }
type KeyLevelBase = {
  lower: number
  upper: number
  center: number
  score: number
  retests: number
  avgReversal: number
}
export type KeyLevelZone =
  | (KeyLevelBase & {
      type: 'Boundary'
      side: 'high' | 'low'
      events: number
      outerBonus: number
    })
  | (KeyLevelBase & { type: 'Density' })
const REGIME_KIJUN_PERIOD = 52
const REGIME_ONSET_CONFIRMATION_BARS = 10
const REGIME_ONSET_DOMINANCE = 0.70

/**
 * Retrospective display-only onset estimation. This deliberately does not alter
 * the causal regime used by trading logic. The search is capped at one Kijun
 * period so a confirmed transition cannot repaint farther than its input horizon.
 */
export function backfillRegimeOnsets(
  positions: readonly (number | null)[],
  causalRegimes: readonly (Regime | null)[],
  lookback = REGIME_KIJUN_PERIOD,
): (Regime | null)[] {
  const display = [...causalRegimes]
  let previous: Regime | null = null

  for (let confirmedAt = 0; confirmedAt < causalRegimes.length; confirmedAt++) {
    const regime = causalRegimes[confirmedAt]
    if (regime == null) continue
    if (previous == null) {
      previous = regime
      continue
    }
    if (regime === previous) continue
    previous = regime
    const target = regime === 'UP' ? 1 : regime === 'DOWN' ? -1 : null
    if (target == null) continue

    const earliest = Math.max(0, confirmedAt - lookback + 1)
    const qualifying: number[] = []
    for (let i = earliest; i + REGIME_ONSET_CONFIRMATION_BARS - 1 <= confirmedAt; i++) {
      if (positions[i] !== target) continue
      let matching = 0
      let valid = true
      for (let j = i; j < i + REGIME_ONSET_CONFIRMATION_BARS; j++) {
        const position = positions[j]
        if (position == null) { valid = false; break }
        if (position === target) matching++
      }
      if (valid && matching / REGIME_ONSET_CONFIRMATION_BARS >= REGIME_ONSET_DOMINANCE) {
        qualifying.push(i)
      }
    }
    if (!qualifying.length) continue

    // Match Python's connected_local_dominance component containing the latest
    // qualifying window, then take the earliest onset in that component.
    const connected = new Set<number>([qualifying.at(-1)!])
    const stack = [qualifying.at(-1)!]
    while (stack.length) {
      const current = stack.pop()!
      for (const candidate of qualifying) {
        if (!connected.has(candidate) && Math.abs(current - candidate) < REGIME_ONSET_CONFIRMATION_BARS) {
          connected.add(candidate)
          stack.push(candidate)
        }
      }
    }
    const onset = Math.min(...connected)
    for (let i = onset; i < confirmedAt; i++) {
      if (display[i] != null) display[i] = regime
    }
  }
  return display
}

function regimeInputsForBars(bars: readonly LightweightCandle[]): {
  positions: (number | null)[]
  causalRegimes: (Regime | null)[]
} {
  const positions: (number | null)[] = bars.map((bar, i) => {
    if (i < REGIME_KIJUN_PERIOD - 1) return null
    const window = bars.slice(i - REGIME_KIJUN_PERIOD + 1, i + 1)
    const kijun = (Math.max(...window.map((item) => item.high)) + Math.min(...window.map((item) => item.low))) / 2
    return bar.close > kijun ? 1 : bar.close < kijun ? -1 : 0
  })
  const causalRegimes: (Regime | null)[] = bars.map((_, i) => {
    if (i < 151) return null
    const window = positions.slice(i - 99, i + 1)
    if (window.some((value) => value == null)) return null
    const above = window.filter((value) => value === 1).length / 100
    const below = window.filter((value) => value === -1).length / 100
    return above >= 0.70 ? 'UP' : below >= 0.70 ? 'DOWN' : 'CHOPPY'
  })
  return { positions, causalRegimes }
}

export function detectCurrentRegime(bars: readonly LightweightCandle[]): Regime | null {
  return regimeInputsForBars(bars).causalRegimes.at(-1) ?? null
}

export function detectRegimeSegments(bars: readonly LightweightCandle[]): RegimeSegment[] {
  const { positions, causalRegimes } = regimeInputsForBars(bars)
  const regimes = backfillRegimeOnsets(positions, causalRegimes)
  const result: RegimeSegment[] = []
  let start = -1
  let active: Regime | null = null
  for (let i = 0; i <= bars.length; i++) {
    const regime = i < bars.length ? regimes[i]! : null
    if (regime === active) continue
    if (active && start >= 0) {
      result.push({ startTime: bars[start]!.time, endTime: bars[i - 1]!.time, regime: active })
    }
    active = regime
    start = regime ? i : -1
  }
  return result
}

export type KeyLevelDetectConfig = {
  atrPeriod: number
  atrMultiplier: number
  rangeMultiplier: number
  bin: number
  smoothing: number
  separation: number
  width: number
  maxZones: number
  reactionWeight: number
  pivot: number
  cluster: number
  lookahead: number
  minReversal: number
  retestGap: number
  boundarySlots: number
  lookbackBars: number
}

/** Mirrors trading_algorithms_python/trading_algorithms/price_zone.py. */
const KEY_LEVEL_CONFIG: KeyLevelDetectConfig = {
  atrPeriod: 14,
  atrMultiplier: 0.35,
  rangeMultiplier: 0.06,
  bin: 0.1,
  smoothing: 0.4,
  separation: 1.5,
  width: 0.4,
  maxZones: 7,
  reactionWeight: 0.55,
  pivot: 3,
  cluster: 1,
  lookahead: 12,
  minReversal: 0.6,
  retestGap: 6,
  boundarySlots: 2,
  lookbackBars: 288,
}

export function keyLevelDetectConfig(): KeyLevelDetectConfig {
  return { ...KEY_LEVEL_CONFIG }
}

export function keyLevelVolumeBarCount(_paneId: string): number {
  return KEY_LEVEL_CONFIG.lookbackBars
}

/** @deprecated use keyLevelVolumeBarCount */
export const KEY_LEVEL_CANDLE_COUNT = 288

export function closedCandlesAt(
  candles: readonly LightweightCandle[],
  intervalSec: number,
  nowSec: number,
): readonly LightweightCandle[] {
  const last = candles.at(-1)
  return last && last.time + intervalSec > nowSec ? candles.slice(0, -1) : candles
}

type Pivot = { index: number; price: number; side: 'high' | 'low'; reversal: number }
type BoundaryCluster = { side: Pivot['side']; points: Pivot[]; center: number }
type ScaleMetrics = { atr: number; range: number; scale: number }

function clamp(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, value))
}

function smoothProfile(values: readonly number[], sigma: number): number[] {
  if (sigma <= 0) return [...values]
  const radius = Math.ceil(3 * sigma)
  const kernel = Array.from(
    { length: radius * 2 + 1 },
    (_, index) => Math.exp(-0.5 * ((index - radius) / sigma) ** 2),
  )
  const sum = kernel.reduce((total, value) => total + value, 0)
  return values.map((_, index) =>
    kernel.reduce(
      (total, weight, kernelIndex) =>
        total + weight * values[clamp(index + kernelIndex - radius, 0, values.length - 1)]! / sum,
      0,
    ),
  )
}

function keyLevelScaleMetrics(
  candles: readonly LightweightCandle[],
  config: KeyLevelDetectConfig,
): ScaleMetrics {
  const trueRanges = candles.map((candle, index) => Math.max(
    candle.high - candle.low,
    index > 0 ? Math.abs(candle.high - candles[index - 1]!.close) : 0,
    index > 0 ? Math.abs(candle.low - candles[index - 1]!.close) : 0,
  ))
  const period = Math.min(config.atrPeriod, trueRanges.length)
  let atr = trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0) / period
  for (let index = period; index < trueRanges.length; index++) {
    atr = (atr * (period - 1) + trueRanges[index]!) / period
  }
  const minimum = Math.min(...candles.map((candle) => candle.low))
  const maximum = Math.max(...candles.map((candle) => candle.high))
  const range = maximum - minimum
  return {
    atr,
    range,
    scale: Math.max(config.atrMultiplier * atr, config.rangeMultiplier * range),
  }
}

function detectPivots(
  candles: readonly LightweightCandle[],
  config: KeyLevelDetectConfig,
  metrics: ScaleMetrics,
): Pivot[] {
  const result: Pivot[] = []
  const radius = config.pivot
  for (let index = radius; index < candles.length - radius; index++) {
    const candle = candles[index]!
    const window = candles.slice(index - radius, index + radius + 1)
    for (const side of ['high', 'low'] as const) {
      const price = candle[side]
      const extreme = side === 'high'
        ? Math.max(...window.map((item) => item.high))
        : Math.min(...window.map((item) => item.low))
      if (Math.abs(price - extreme) > 1e-9) continue
      const ahead = candles.slice(index + 1, Math.min(candles.length, index + 1 + config.lookahead))
      if (!ahead.length) continue
      const reversal = side === 'high'
        ? (price - Math.min(...ahead.map((item) => item.low))) / metrics.atr
        : (Math.max(...ahead.map((item) => item.high)) - price) / metrics.atr
      if (reversal >= config.minReversal) result.push({ index, price, side, reversal })
    }
  }
  return result
}

function buildBoundaryZones(
  candles: readonly LightweightCandle[],
  pivots: readonly Pivot[],
  config: KeyLevelDetectConfig,
  metrics: ScaleMetrics,
): KeyLevelZone[] {
  const clusters: BoundaryCluster[] = []
  const tolerance = config.cluster * metrics.scale
  for (const side of ['high', 'low'] as const) {
    const points = pivots.filter((point) => point.side === side).sort((a, b) => a.price - b.price)
    for (const point of points) {
      let nearest: BoundaryCluster | undefined
      let distance = Infinity
      for (const cluster of clusters) {
        if (cluster.side !== side) continue
        const candidateDistance = Math.abs(point.price - cluster.center)
        if (candidateDistance <= tolerance && candidateDistance < distance) {
          nearest = cluster
          distance = candidateDistance
        }
      }
      if (!nearest) {
        nearest = { side, points: [], center: point.price }
        clusters.push(nearest)
      }
      nearest.points.push(point)
      const weightedPrice = nearest.points.reduce(
        (total, item) => total + item.price * Math.min(item.reversal, 3),
        0,
      )
      const weights = nearest.points.reduce((total, item) => total + Math.min(item.reversal, 3), 0)
      nearest.center = weightedPrice / weights
    }
  }

  const minimum = Math.min(...candles.map((candle) => candle.low))
  const maximum = Math.max(...candles.map((candle) => candle.high))
  const range = Math.max(maximum - minimum, Number.EPSILON)
  return clusters.map((cluster) => {
    const points = [...cluster.points].sort((a, b) => a.index - b.index)
    const events: Pivot[] = []
    for (const point of points) {
      const previous = events.at(-1)
      if (!previous || point.index - previous.index >= config.retestGap) events.push(point)
      else if (point.reversal > previous.reversal) events[events.length - 1] = point
    }
    const avgReversal = events.reduce((total, item) => total + item.reversal, 0) / Math.max(1, events.length)
    const retests = Math.max(0, events.length - 1)
    const boundaryDistance = cluster.side === 'high'
      ? (maximum - cluster.center) / range
      : (cluster.center - minimum) / range
    const outerBonus = Math.exp(-boundaryDistance / 0.2)
    const score =
      0.35 * Math.min(1, avgReversal / 2) +
      0.35 * Math.min(1, retests / 3) +
      0.3 * outerBonus
    const prices = cluster.points.map((item) => item.price)
    const padding = metrics.scale * 0.1
    const lower = prices.length >= 3
      ? quantile(prices, 0.15) - padding
      : cluster.center - config.width * metrics.scale
    const upper = prices.length >= 3
      ? quantile(prices, 0.85) + padding
      : cluster.center + config.width * metrics.scale
    return {
      type: 'Boundary' as const,
      side: cluster.side,
      center: cluster.center,
      lower,
      upper,
      score,
      retests,
      avgReversal,
      events: events.length,
      outerBonus,
    }
  }).sort((a, b) => b.score - a.score)
}

function buildDensityZones(
  candles: readonly LightweightCandle[],
  pivots: readonly Pivot[],
  config: KeyLevelDetectConfig,
  metrics: ScaleMetrics,
): KeyLevelZone[] {
  const minimum = Math.min(...candles.map((candle) => candle.low))
  const maximum = Math.max(...candles.map((candle) => candle.high))
  const step = metrics.scale * config.bin
  const start = Math.floor(minimum / step) * step
  const count = Math.ceil((maximum - start) / step) + 1
  const prices = Array.from({ length: count }, (_, index) => start + index * step)
  const occupancy = Array<number>(count).fill(0)
  const reaction = Array<number>(count).fill(0)
  const bump = (price: number, weight: number) => {
    const center = (price - start) / step
    const sigma = Math.max(1, 0.75 / config.bin)
    for (
      let index = Math.max(0, Math.floor(center - 4 * sigma));
      index <= Math.min(count - 1, Math.ceil(center + 4 * sigma));
      index++
    ) {
      reaction[index] += weight * Math.exp(-0.5 * ((index - center) / sigma) ** 2)
    }
  }

  for (const candle of candles) {
    const first = clamp(Math.floor((candle.low - start) / step), 0, count - 1)
    const last = clamp(Math.ceil((candle.high - start) / step), 0, count - 1)
    const bodyLow = Math.min(candle.open, candle.close)
    const bodyHigh = Math.max(candle.open, candle.close)
    const bodyBins: number[] = []
    for (let index = first; index <= last; index++) {
      if (prices[index]! >= bodyLow - step / 2 && prices[index]! <= bodyHigh + step / 2) {
        bodyBins.push(index)
      }
    }
    for (let index = first; index <= last; index++) occupancy[index] += 0.4 / (last - first + 1)
    for (const index of bodyBins) occupancy[index] += 0.6 / Math.max(1, bodyBins.length)
    const span = Math.max(step, candle.high - candle.low)
    const upperWick = (candle.high - bodyHigh) / span
    const lowerWick = (bodyLow - candle.low) / span
    if (upperWick > 0.08) bump(candle.high, upperWick)
    if (lowerWick > 0.08) bump(candle.low, lowerWick)
  }
  for (const pivot of pivots) bump(pivot.price, Math.min(2, pivot.reversal / 8))

  const smoothedOccupancy = smoothProfile(occupancy, config.smoothing / config.bin)
  const smoothedReaction = smoothProfile(reaction, config.smoothing / config.bin)
  const maxOccupancy = Math.max(1e-9, ...smoothedOccupancy)
  const maxReaction = Math.max(1e-9, ...smoothedReaction)
  const scores = smoothedOccupancy.map(
    (value, index) =>
      (1 - config.reactionWeight) * value / maxOccupancy +
      config.reactionWeight * smoothedReaction[index]! / maxReaction,
  )
  const zones: KeyLevelZone[] = []
  for (let index = 1; index < count - 1; index++) {
    if (scores[index]! >= scores[index - 1]! && scores[index]! > scores[index + 1]! && scores[index]! > 0.13) {
      const center = prices[index]!
      zones.push({
        type: 'Density',
        center,
        lower: center - config.width * metrics.scale,
        upper: center + config.width * metrics.scale,
        score: scores[index]!,
        retests: 0,
        avgReversal: 0,
      })
    }
  }
  return zones.sort((a, b) => b.score - a.score)
}

export function detectKeyLevels(
  bars: readonly LightweightCandle[],
  config: KeyLevelDetectConfig = keyLevelDetectConfig(),
): KeyLevelZone[] {
  if (bars.length < config.lookbackBars) return []
  const candles = bars.slice(-config.lookbackBars)
  const metrics = keyLevelScaleMetrics(candles, config)
  if (!(metrics.atr > 0) || !(metrics.scale > 0)) return []
  const pivots = detectPivots(candles, config, metrics)
  const boundary = buildBoundaryZones(candles, pivots, config, metrics)
  const density = buildDensityZones(candles, pivots, config, metrics)
  const selected: KeyLevelZone[] = []
  const nonOverlapping = (zone: KeyLevelZone) => selected.every(
    (current) =>
      Math.abs(current.center - zone.center) >= config.separation * metrics.scale &&
      (current.upper < zone.lower || zone.upper < current.lower),
  )
  for (const zone of boundary) {
    if (selected.filter((item) => item.type === 'Boundary').length >= config.boundarySlots) break
    if (nonOverlapping(zone)) selected.push(zone)
  }
  for (const zone of density) {
    if (selected.length >= config.maxZones) break
    if (nonOverlapping(zone)) selected.push(zone)
  }
  return selected.sort((a, b) => a.center - b.center)
}
