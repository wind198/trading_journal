import type { LightweightCandle } from '@/lib/ticks/candles'

export type Regime = 'UP' | 'DOWN' | 'CHOPPY'
export type RegimeSegment = { startTime: number; endTime: number; regime: Regime }
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
export type BaselineEngulfingEvent = {
  time: number
  direction: BaselineDirection
  srcOpen: number
  srcHigh: number
  srcLow: number
  srcClose: number
  score: number
}
export type KeyLevelZone = {
  lower: number
  upper: number
  center: number
  strength: number
  state: 'SUPPORT_CANDIDATE' | 'RESISTANCE_CANDIDATE' | 'INSIDE_ZONE'
  startTime: number
  endTime: number
}
export type VolumeCandle = LightweightCandle & { volume: number }

const REGIME_KIJUN_PERIOD = 52
const REGIME_ONSET_CONFIRMATION_BARS = 10
const REGIME_ONSET_DOMINANCE = 0.70

function quantile(values: readonly number[], q: number): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (sorted.length === 0) return Number.NaN
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const fraction = position - lower
  return sorted[lower]! + fraction * ((sorted[lower + 1] ?? sorted[lower]!) - sorted[lower]!)
}

function rollingQuantile(values: readonly number[], index: number, lookback: number, q: number) {
  if (index < lookback) return Number.NaN
  return quantile(values.slice(index - lookback, index), q)
}

type Features = {
  body: number
  range: number
  bodyRatio: number
  directionalClose: number
  oppositeWickRatio: number
  direction: -1 | 0 | 1
}

function features(bar: LightweightCandle): Features {
  const range = bar.high - bar.low
  const body = Math.abs(bar.close - bar.open)
  const direction = bar.close > bar.open ? 1 : bar.close < bar.open ? -1 : 0
  const closePosition = range > 0 ? (bar.close - bar.low) / range : Number.NaN
  return {
    body,
    range,
    bodyRatio: range > 0 ? body / range : Number.NaN,
    directionalClose: direction > 0 ? closePosition : direction < 0 ? 1 - closePosition : Number.NaN,
    oppositeWickRatio:
      direction > 0
        ? (bar.high - bar.close) / range
        : direction < 0
          ? (bar.close - bar.low) / range
          : Number.NaN,
    direction,
  }
}

function forceScore(feature: Features, bodyFactor: number, rangeFactor: number): number {
  return 100 * (
    0.30 * Math.min(1, bodyFactor / 2.5) +
    0.25 * Math.min(1, rangeFactor / 2.5) +
    0.30 * Math.min(1, feature.bodyRatio / 0.85) +
    0.15 * feature.directionalClose
  )
}

export function calculateForceScores(bars: readonly LightweightCandle[]): ForceScorePoint[] {
  const fs = bars.map(features)
  const bodies = fs.map((item) => item.body)
  const ranges = fs.map((item) => item.range)
  const scores: ForceScorePoint[] = []
  for (let i = 100; i < bars.length; i++) {
    const feature = fs[i]!
    if (feature.direction === 0) continue
    const bodyBase = rollingQuantile(bodies, i, 100, 0.60)
    const rangeBase = rollingQuantile(ranges, i, 100, 0.60)
    if (!(bodyBase > 0) || !(rangeBase > 0)) continue
    scores.push({
      time: bars[i]!.time,
      score: Math.max(0, Math.min(100, forceScore(feature, feature.body / bodyBase, feature.range / rangeBase))),
      direction: feature.direction > 0 ? 'BULLISH' : 'BEARISH',
    })
  }
  return scores
}

export function detectBaselineForce(bars: readonly LightweightCandle[]): BaselineForceEvent[] {
  const fs = bars.map(features)
  const bodies = fs.map((item) => item.body)
  const ranges = fs.map((item) => item.range)
  const events: BaselineForceEvent[] = []
  for (let i = 100; i < bars.length; i++) {
    const feature = fs[i]!
    const bodyBase = rollingQuantile(bodies, i, 100, 0.60)
    const rangeBase = rollingQuantile(ranges, i, 100, 0.60)
    if (!(bodyBase > 0) || !(rangeBase > 0) || feature.direction === 0) continue
    const bodyFactor = feature.body / bodyBase
    const rangeFactor = feature.range / rangeBase
    const score = forceScore(feature, bodyFactor, rangeFactor)
    if (
      feature.bodyRatio < 0.65 ||
      bodyFactor < 1 ||
      rangeFactor < 1 ||
      feature.directionalClose < 0.80 ||
      feature.oppositeWickRatio > 0.20 ||
      score < 65
    ) continue
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

export function detectBaselineEngulfing(bars: readonly LightweightCandle[]): BaselineEngulfingEvent[] {
  const fs = bars.map(features)
  const bodies = fs.map((item) => item.body)
  const ranges = fs.map((item) => item.range)
  const events: BaselineEngulfingEvent[] = []
  for (let i = 101; i < bars.length; i++) {
    const prior = bars[i - 1]!
    const bar = bars[i]!
    const f1 = fs[i - 1]!
    const f2 = fs[i]!
    if (f1.direction === 0 || f2.direction === 0 || f1.direction === f2.direction) continue
    const bodyBase1 = rollingQuantile(bodies, i - 1, 100, 0.60)
    const rangeBase1 = rollingQuantile(ranges, i - 1, 100, 0.60)
    const bodyBase2 = rollingQuantile(bodies, i, 100, 0.60)
    const rangeBase2 = rollingQuantile(ranges, i, 100, 0.60)
    if (!(bodyBase1 > 0) || !(rangeBase1 > 0) || !(bodyBase2 > 0) || !(rangeBase2 > 0)) continue
    const previousBodyFactor = f1.body / bodyBase1
    if (previousBodyFactor < 0.5) continue
    let penetration: number
    if (f2.direction > 0) {
      if (bar.open > prior.close) continue
      const denominator = prior.open - prior.close
      if (!(denominator > 0)) continue
      penetration = (bar.close - prior.close) / denominator
    } else {
      if (bar.open < prior.close) continue
      const denominator = prior.close - prior.open
      if (!(denominator > 0)) continue
      penetration = (prior.close - bar.close) / denominator
    }
    if (penetration < 0.60) continue
    const bodyFactor = f2.body / bodyBase2
    const rangeFactor = f2.range / rangeBase2
    const score = forceScore(f2, bodyFactor, rangeFactor)
    if (f2.bodyRatio < 0.55 || bodyFactor < 1 || rangeFactor < 1 || f2.directionalClose < 0.70 || score < 50) continue
    const geometryScore = 100 * Math.max(0, Math.min(1, (penetration - 0.60) / 0.40))
    const patternScore = 0.40 * geometryScore + 0.60 * score
    if (patternScore < 60) continue
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

export function detectRegimeSegments(bars: readonly LightweightCandle[]): RegimeSegment[] {
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

type Swing = { kind: 'H' | 'L'; pivot: number; price: number; confirmedAt: number; threshold: number }
type SwingConfig = { lookback: number; sma: number; left: number; right: number; refine: number; minBars: number; move: number }

/** Mirrors swing_algo/config/swings/dense.json (M5, ~3× density). */
const DENSE_SWING_CONFIG: SwingConfig = {
  lookback: 100,
  sma: 2,
  left: 1,
  right: 1,
  refine: 3,
  minBars: 1,
  move: 0.55,
}

/** Mirrors swing_algo/config/swings/major.json */
const MAJOR_SWING_CONFIG: SwingConfig = {
  lookback: 100,
  sma: 5,
  left: 2,
  right: 2,
  refine: 5,
  minBars: 12,
  move: 2.75,
}

function detectSwings(bars: readonly VolumeCandle[], cfg: SwingConfig): Swing[] {
  const smooth = bars.map((_, i) => i + 1 < cfg.sma ? Number.NaN : bars.slice(i - cfg.sma + 1, i + 1).reduce((s, b) => s + b.close, 0) / cfg.sma)
  const moves = bars.map((bar, i) => i === 0 ? Number.NaN : Math.abs(bar.close - bars[i - 1]!.close))
  const candidates: Swing[] = []
  const first = Math.max(cfg.lookback, cfg.sma - 1) + cfg.left
  for (let i = first; i < bars.length - cfg.right; i++) {
    const window = smooth.slice(i - cfg.left, i + cfg.right + 1)
    if (window.some((value) => !Number.isFinite(value))) continue
    const center = window[cfg.left]!
    const kind = center === Math.max(...window) ? 'H' : center === Math.min(...window) ? 'L' : null
    if (!kind) continue
    const start = Math.max(0, i - cfg.refine)
    let pivot = start
    for (let j = start + 1; j <= i; j++) {
      if ((kind === 'H' && bars[j]!.high > bars[pivot]!.high) || (kind === 'L' && bars[j]!.low < bars[pivot]!.low)) pivot = j
    }
    const threshold = quantile(moves.slice(i - cfg.lookback + 1, i + 1), 0.60) * cfg.move
    if (!(threshold > 0)) continue
    candidates.push({ kind, pivot, price: kind === 'H' ? bars[pivot]!.high : bars[pivot]!.low, confirmedAt: i + cfg.right, threshold })
  }
  candidates.sort((a, b) => a.pivot - b.pivot || a.confirmedAt - b.confirmedAt)
  const accepted: Swing[] = []
  for (const item of candidates) {
    const previous = accepted.at(-1)
    if (!previous) { accepted.push(item); continue }
    if (item.pivot <= previous.pivot) continue
    if (item.kind === previous.kind) {
      const stronger = item.kind === 'H' ? item.price > previous.price : item.price < previous.price
      if (stronger) accepted[accepted.length - 1] = item
    } else if (item.pivot - previous.pivot >= cfg.minBars && Math.abs(item.price - previous.price) >= Math.max(item.threshold, previous.threshold)) {
      accepted.push(item)
    }
  }
  return accepted
}

export type KeyLevelDetectConfig = {
  lookbackBars: number
  minWarmupBars: number
  minIndependentTouches: number
  minTouchSeparationBars: number
  clusterProximityFactor: number
  maxZoneWidthFactor: number
  minZoneGapFactor: number
  spacingPenaltyFactor: number
  minAdjustedScore: number
  maxLevels: number
  rejectionHorizonBars: number
}

/** Mirrors swing_algo/config/swings/zones.json (M5 baseline). */
const DEFAULT_KEY_LEVEL_CONFIG: KeyLevelDetectConfig = {
  lookbackBars: 1000,
  minWarmupBars: 120,
  minIndependentTouches: 2,
  minTouchSeparationBars: 4,
  clusterProximityFactor: 3.5,
  maxZoneWidthFactor: 8,
  minZoneGapFactor: 3.5,
  spacingPenaltyFactor: 12,
  minAdjustedScore: 6,
  maxLevels: 30,
  rejectionHorizonBars: 8,
}

/** 3m pane: same zone geometry as M5; cap displayed levels for chart density. */
const KEY_LEVEL_3M_CONFIG: KeyLevelDetectConfig = {
  ...DEFAULT_KEY_LEVEL_CONFIG,
  lookbackBars: 500,
  minAdjustedScore: 0,
  maxLevels: 10,
}

export function keyLevelDetectConfig(intervalSec: number): KeyLevelDetectConfig {
  return intervalSec <= 180 ? KEY_LEVEL_3M_CONFIG : DEFAULT_KEY_LEVEL_CONFIG
}

export function keyLevelVolumeBarCount(paneId: string): number {
  return paneId === '3m' ? 500 : 1000
}

/** @deprecated use keyLevelVolumeBarCount */
export const KEY_LEVEL_CANDLE_COUNT = 500

export function detectKeyLevels(
  bars: readonly VolumeCandle[],
  intervalSec: number,
  config: KeyLevelDetectConfig = keyLevelDetectConfig(intervalSec),
): KeyLevelZone[] {
  const window = bars.slice(-config.lookbackBars)
  if (window.length < config.minWarmupBars) return []
  const dense = detectSwings(window, DENSE_SWING_CONFIG)
  const major = detectSwings(window, MAJOR_SWING_CONFIG)
  void major
  const moves = window.slice(-101).map((bar, i, arr) => i === 0 ? Number.NaN : Math.abs(bar.close - arr[i - 1]!.close))
  const scale = quantile(moves, 0.60)
  if (!(scale > 0) || dense.length === 0) return []
  const proximity = config.clusterProximityFactor * scale
  const maxWidth = config.maxZoneWidthFactor * scale
  const sorted = [...dense].sort((a, b) => a.price - b.price)
  const groups: Swing[][] = []
  for (const swing of sorted) {
    const group = groups.at(-1)
    if (group && swing.price - group[0]!.price <= maxWidth && swing.price - group.at(-1)!.price <= proximity) {
      group.push(swing)
    } else {
      groups.push([swing])
    }
  }
  const raw: Array<KeyLevelZone & { volumeScore: number; reactionCount: number; reaction: number; recency: number }> = []
  const halfPad = Math.max(scale * 0.25, 1e-7)
  for (const group of groups) {
    const chronological = [...group].sort((a, b) => a.pivot - b.pivot || a.confirmedAt - b.confirmedAt)
    const touches: Swing[] = []
    for (const swing of chronological) {
      if (!touches.length || swing.pivot - touches.at(-1)!.pivot >= config.minTouchSeparationBars) {
        touches.push(swing)
      }
    }
    if (touches.length < config.minIndependentTouches) continue
    const prices = group.map((item) => item.price).sort((a, b) => a - b)
    const center = quantile(prices, 0.5)
    const lower = prices[0]! - halfPad
    const upper = prices.at(-1)! + halfPad
    if (upper - lower > maxWidth + 2 * halfPad) continue
    let volume = 0
    for (const bar of window) {
      const overlap = Math.max(0, Math.min(bar.high, upper) - Math.max(bar.low, lower))
      volume += bar.high > bar.low ? bar.volume * overlap / (bar.high - bar.low) : 0
    }
    const reactions = touches.map((swing) => {
      const after = window.slice(
        swing.pivot + 1,
        Math.min(window.length, swing.pivot + config.rejectionHorizonBars),
      )
      if (!after.length) return 0
      return swing.kind === 'H' ? Math.max(0, swing.price - Math.min(...after.map((b) => b.low))) / scale : Math.max(0, Math.max(...after.map((b) => b.high)) - swing.price) / scale
    })
    const detectedAt = Math.max(...touches.map((item) => item.confirmedAt))
    const lastClose = window.at(-1)!.close
    raw.push({
      lower, upper, center, strength: 0,
      state: lastClose > upper ? 'SUPPORT_CANDIDATE' : lastClose < lower ? 'RESISTANCE_CANDIDATE' : 'INSIDE_ZONE',
      startTime: window[Math.min(detectedAt, window.length - 1)]!.time,
      endTime: window.at(-1)!.time + 50 * intervalSec,
      volumeScore: volume / Math.max(upper - lower, 1e-12),
      reactionCount: 1 - Math.exp(-(touches.length - 1) / 3),
      reaction: 1 - Math.exp(-quantile(reactions, 0.5) / 3),
      recency: Math.exp(
        -(window.length - 1 - Math.max(...touches.map((item) => item.pivot))) / Math.max(1, config.lookbackBars / 3),
      ),
    })
  }
  const maxVolume = Math.max(0, ...raw.map((item) => item.volumeScore))
  for (const item of raw) {
    item.strength =
      100 *
      (0.40 * item.reactionCount +
        0.25 * (maxVolume ? item.volumeScore / maxVolume : 0) +
        0.25 * item.reaction +
        0.10 * item.recency)
  }
  const minGap = config.minZoneGapFactor * scale
  const spacing = config.spacingPenaltyFactor * scale
  const remaining = [...raw].sort((a, b) => b.strength - a.strength)
  const selected: typeof raw = []
  while (remaining.length && selected.length < config.maxLevels) {
    if (!selected.length) { selected.push(remaining.shift()!); continue }
    const eligible = remaining.map((item, index) => {
      const gaps = selected.map((kept) => Math.max(0, item.lower - kept.upper, kept.lower - item.upper))
      if (gaps.some((gap) => gap < minGap)) return null
      const adjusted = item.strength * (1 - Math.exp(-Math.min(...gaps) / Math.max(spacing, 1e-12)))
      return adjusted >= config.minAdjustedScore ? { item, index, adjusted } : null
    }).filter((item): item is NonNullable<typeof item> => item != null)
    if (!eligible.length) break
    eligible.sort((a, b) => b.adjusted - a.adjusted || a.item.center - b.item.center)
    const best = eligible[0]!
    selected.push(best.item)
    remaining.splice(best.index, 1)
  }
  return selected.sort((a, b) => a.center - b.center).map(({ volumeScore: _v, reactionCount: _c, reaction: _r, recency: _e, ...zone }) => zone)
}
