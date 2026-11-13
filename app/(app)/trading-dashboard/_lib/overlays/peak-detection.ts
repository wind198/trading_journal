import type { LightweightCandle } from '@/lib/ticks/candles'

export type PeakKind = 'peak' | 'trough'

export type PeakDetectionConfig = {
  enabled: boolean
  /** SMA length on close (typical 3–5). */
  smoothLen: number
  /** Local extremum half-window in bars. */
  pivotBars: number
  /** Max bar gap to merge into one group. */
  groupTimeBars: number
  /** Merge if |Δprice| ≤ this × rolling std of closes. */
  groupPriceStdMult: number
  /** Window for price std used when grouping. */
  varianceLookback: number
  showPeaks: boolean
  showTroughs: boolean
}

export const DEFAULT_PEAK_DETECTION_CONFIG: PeakDetectionConfig = {
  enabled: true,
  smoothLen: 4,
  pivotBars: 1,
  groupTimeBars: 5,
  groupPriceStdMult: 0.75,
  varianceLookback: 20,
  showPeaks: true,
  showTroughs: true,
}

export type PeakEvent = {
  time: number
  price: number
  kind: PeakKind
  /** Index in the source candle array. */
  index: number
}

function sma(values: readonly number[], len: number): number[] {
  const out = new Array<number>(values.length).fill(Number.NaN)
  if (len < 1 || values.length < len) return out
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!
    if (i >= len) sum -= values[i - len]!
    if (i >= len - 1) out[i] = sum / len
  }
  return out
}

function rollingStd(closes: readonly number[], endIndex: number, lookback: number): number {
  const start = Math.max(0, endIndex - lookback + 1)
  const n = endIndex - start + 1
  if (n < 2) return 0
  let sum = 0
  for (let i = start; i <= endIndex; i++) sum += closes[i]!
  const mean = sum / n
  let varSum = 0
  for (let i = start; i <= endIndex; i++) {
    const d = closes[i]! - mean
    varSum += d * d
  }
  return Math.sqrt(varSum / (n - 1))
}

function isLocalExtremum(
  smooth: readonly number[],
  i: number,
  pivotBars: number,
  peak: boolean,
): boolean {
  const v = smooth[i]
  if (v == null || !Number.isFinite(v)) return false
  for (let k = 1; k <= pivotBars; k++) {
    const left = smooth[i - k]
    const right = smooth[i + k]
    if (left == null || right == null || !Number.isFinite(left) || !Number.isFinite(right)) {
      return false
    }
    if (peak) {
      if (!(v > left && v > right)) return false
    } else if (!(v < left && v < right)) {
      return false
    }
  }
  return true
}

function groupExtremums(
  raw: PeakEvent[],
  closes: readonly number[],
  config: PeakDetectionConfig,
): PeakEvent[] {
  if (raw.length === 0) return []
  const sorted = [...raw].sort((a, b) => a.index - b.index)
  const out: PeakEvent[] = []
  let cluster: PeakEvent = sorted[0]!

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!
    if (next.kind !== cluster.kind) {
      out.push(cluster)
      cluster = next
      continue
    }
    const dt = next.index - cluster.index
    const std = rollingStd(closes, next.index, config.varianceLookback)
    const priceTol = Math.max(std * config.groupPriceStdMult, Number.EPSILON)
    const nearTime = dt <= config.groupTimeBars
    const nearPrice = Math.abs(next.price - cluster.price) <= priceTol
    if (nearTime && nearPrice) {
      if (cluster.kind === 'peak') {
        if (next.price >= cluster.price) cluster = next
      } else if (next.price <= cluster.price) {
        cluster = next
      }
    } else {
      out.push(cluster)
      cluster = next
    }
  }
  out.push(cluster)
  return out
}

/** Detect + group peaks/troughs on smoothed closes. */
export function detectPeaks(
  candles: readonly LightweightCandle[],
  config: PeakDetectionConfig = DEFAULT_PEAK_DETECTION_CONFIG,
): PeakEvent[] {
  if (!config.enabled || candles.length === 0) return []
  const smoothLen = Math.max(1, Math.round(config.smoothLen))
  const pivotBars = Math.max(1, Math.round(config.pivotBars))
  if (candles.length < smoothLen + pivotBars * 2) return []

  const closes = candles.map((c) => c.close)
  const smooth = sma(closes, smoothLen)
  const raw: PeakEvent[] = []

  const start = smoothLen - 1 + pivotBars
  const end = candles.length - 1 - pivotBars
  for (let i = start; i <= end; i++) {
    if (config.showPeaks && isLocalExtremum(smooth, i, pivotBars, true)) {
      raw.push({
        time: candles[i]!.time,
        price: closes[i]!,
        kind: 'peak',
        index: i,
      })
    }
    if (config.showTroughs && isLocalExtremum(smooth, i, pivotBars, false)) {
      raw.push({
        time: candles[i]!.time,
        price: closes[i]!,
        kind: 'trough',
        index: i,
      })
    }
  }

  return groupExtremums(raw, closes, config)
}
