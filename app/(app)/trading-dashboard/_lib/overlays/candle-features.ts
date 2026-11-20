import type { LightweightCandle } from '@/lib/ticks/candles'

export type CandleFeatures = {
  body: number
  range: number
  bodyRatio: number
  directionalClose: number
  oppositeWickRatio: number
  direction: -1 | 0 | 1
  invalidCandle: boolean
}

export function quantile(values: readonly number[], q: number): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (sorted.length === 0) return Number.NaN
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const fraction = position - lower
  return sorted[lower]! + fraction * ((sorted[lower + 1] ?? sorted[lower]!) - sorted[lower]!)
}

/** Causal rolling quantile: bars [index - lookback, index) — excludes the current bar (Python shift(1).rolling). */
export function rollingQuantile(
  values: readonly number[],
  index: number,
  lookback: number,
  percentile: number,
): number {
  if (index < lookback) return Number.NaN
  const q = percentile / 100
  const slice = values.slice(index - lookback, index).filter(Number.isFinite)
  if (slice.length === 0) return Number.NaN
  const sorted = [...slice].sort((a, b) => a - b)
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const fraction = position - lower
  return sorted[lower]! + fraction * ((sorted[lower + 1] ?? sorted[lower]!) - sorted[lower]!)
}

export function candleFeatures(bar: LightweightCandle): CandleFeatures {
  const range = bar.high - bar.low
  const invalidCandle =
    !Number.isFinite(bar.open) ||
    !Number.isFinite(bar.high) ||
    !Number.isFinite(bar.low) ||
    !Number.isFinite(bar.close) ||
    range <= 0 ||
    bar.high < bar.low
  const body = Math.abs(bar.close - bar.open)
  const direction = bar.close > bar.open ? 1 : bar.close < bar.open ? -1 : 0
  const closePosition = range > 0 ? (bar.close - bar.low) / range : Number.NaN
  return {
    body,
    range,
    bodyRatio: range > 0 ? body / range : Number.NaN,
    directionalClose:
      direction > 0 ? closePosition : direction < 0 ? 1 - closePosition : Number.NaN,
    oppositeWickRatio:
      direction > 0
        ? (bar.high - bar.close) / range
        : direction < 0
          ? (bar.close - bar.low) / range
          : Number.NaN,
    direction,
    invalidCandle,
  }
}