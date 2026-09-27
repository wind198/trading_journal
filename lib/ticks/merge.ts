import type { LightweightCandle } from './candles'

/** Incoming bars replace any cached bar with the same `time`. Result is oldest first. */
export function mergeCandles(
  existing: readonly LightweightCandle[],
  incoming: readonly LightweightCandle[],
): LightweightCandle[] {
  const byTime = new Map<number, LightweightCandle>()
  for (const candle of existing) byTime.set(candle.time, candle)
  for (const candle of incoming) byTime.set(candle.time, candle)
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
}
