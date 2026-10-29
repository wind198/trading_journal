import {
  CANDLE_TIMEFRAMES,
  type CandleTimeframe,
  type LightweightCandle,
} from '@/lib/ticks/candles'
import type { BarTimeSeries } from './chart-coordinates'
import { chartZoneStartOfNextDayUnix } from './chart-timezone'

const MAX_FUTURE_BARS = 500

/** Unix times for bar slots after last real bar through end of today in chart zone. */
export function futureBarTimesUntilChartZoneEod(
  candles: readonly LightweightCandle[],
  timeframe: CandleTimeframe,
): number[] {
  if (candles.length === 0) return []
  const interval = CANDLE_TIMEFRAMES[timeframe]
  const last = candles[candles.length - 1]
  const endExclusive = chartZoneStartOfNextDayUnix()
  const times: number[] = []
  let t = last.time + interval
  while (t < endExclusive && times.length < MAX_FUTURE_BARS) {
    times.push(t)
    t += interval
  }
  return times
}

/** Real bars plus future time-only entries for coordinate extrapolation. */
export function chartCoordinateBars(
  candles: readonly LightweightCandle[],
  timeframe: CandleTimeframe,
): BarTimeSeries {
  const future = futureBarTimesUntilChartZoneEod(candles, timeframe)
  return [...candles, ...future.map((time) => ({ time }))]
}
