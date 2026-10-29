import {
  CANDLE_TIMEFRAMES,
  type CandleTimeframe,
  type LightweightCandle,
} from '@/lib/ticks/candles'
import { chartZoneStartOfNextDayUnix } from './chart-timezone'

const MAX_STUB_BARS = 500

/** Flat OHLC stubs from last real bar through end of today in chart zone. */
export function extendCandlesToChartZoneEod(
  candles: readonly LightweightCandle[],
  timeframe: CandleTimeframe,
): LightweightCandle[] {
  if (candles.length === 0) return []
  const interval = CANDLE_TIMEFRAMES[timeframe]
  const last = candles[candles.length - 1]
  const endExclusive = chartZoneStartOfNextDayUnix()
  const price = last.close
  const out: LightweightCandle[] = [...candles]
  let t = last.time + interval
  let added = 0
  while (t < endExclusive && added < MAX_STUB_BARS) {
    out.push({ time: t, open: price, high: price, low: price, close: price })
    t += interval
    added += 1
  }
  return out
}
