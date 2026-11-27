import type { Candle, MarketSnapshot, Timeframe } from './contracts'
import type { LightweightCandle } from '../ticks/candles'
import { TIMEFRAME_SECONDS, validateSnapshot } from './snapshot'

/** Provider bars use UTC open seconds; analysis uses completed UTC close timestamps. */
export function completedBars(input: readonly LightweightCandle[], timeframe: Timeframe, asOfMs: number): Candle[] {
  if (!Number.isFinite(asOfMs)) throw new Error('invalid snapshot time')
  const step = TIMEFRAME_SECONDS[timeframe]
  return input.filter(b => (b.time + step) * 1000 <= asOfMs).map(b => ({
    closeTime: new Date((b.time + step) * 1000).toISOString(),
    open: b.open, high: b.high, low: b.low, close: b.close, volume: null,
  }))
}
export function snapshotFromProvider(id: string, asOfMs: number, input: Readonly<Record<Timeframe, readonly LightweightCandle[]>>): MarketSnapshot {
  const snapshot: MarketSnapshot = {
    id, symbol: 'EURUSD', asOf: new Date(asOfMs).toISOString(), source: 'supabase:candles',
    pointSize: 0.00001, volumeKind: 'unknown',
    bars: { M3: completedBars(input.M3, 'M3', asOfMs), M15: completedBars(input.M15, 'M15', asOfMs) },
  }
  validateSnapshot(snapshot)
  return snapshot
}
