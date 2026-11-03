import type { LightweightCandle } from '@/lib/ticks/candles'

export type CandleSyncDiff =
  | { kind: 'unchanged' }
  | { kind: 'lastUpdated' }
  | { kind: 'appended'; fromIndex: number }
  | { kind: 'prepended'; count: number }
  | { kind: 'replaced' }

export function candleOhlcEqual(a: LightweightCandle, b: LightweightCandle): boolean {
  return (
    a.time === b.time &&
    a.open === b.open &&
    a.high === b.high &&
    a.low === b.low &&
    a.close === b.close
  )
}

/** Classify how `next` relates to previously applied `prev` OHLC bars (no whitespace). */
export function diffCandles(
  prev: readonly LightweightCandle[],
  next: readonly LightweightCandle[],
): CandleSyncDiff {
  if (prev === next) return { kind: 'unchanged' }
  if (prev.length === 0) return next.length === 0 ? { kind: 'unchanged' } : { kind: 'replaced' }
  if (next.length === 0) return { kind: 'replaced' }

  if (next.length > prev.length) {
    const offset = next.length - prev.length
    if (next[offset]?.time === prev[0]?.time) {
      let prependMatch = true
      for (let i = 0; i < prev.length; i++) {
        if (!candleOhlcEqual(prev[i], next[offset + i])) {
          prependMatch = false
          break
        }
      }
      if (prependMatch) return { kind: 'prepended', count: offset }
    }

    let appendMatch = true
    for (let i = 0; i < prev.length; i++) {
      if (!candleOhlcEqual(prev[i], next[i])) {
        appendMatch = false
        break
      }
    }
    if (appendMatch) return { kind: 'appended', fromIndex: prev.length }
    return { kind: 'replaced' }
  }

  if (next.length < prev.length) return { kind: 'replaced' }

  for (let i = 0; i < prev.length - 1; i++) {
    if (!candleOhlcEqual(prev[i], next[i])) return { kind: 'replaced' }
  }

  const lastPrev = prev[prev.length - 1]
  const lastNext = next[next.length - 1]
  if (candleOhlcEqual(lastPrev, lastNext)) return { kind: 'unchanged' }
  if (lastPrev.time === lastNext.time) return { kind: 'lastUpdated' }
  return { kind: 'replaced' }
}
