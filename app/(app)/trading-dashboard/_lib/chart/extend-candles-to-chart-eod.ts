import {
  CANDLE_TIMEFRAMES,
  type CandleTimeframe,
  type LightweightCandle,
} from '@/lib/ticks/candles'
import type { BarTimeSeries } from './chart-coordinates'
import { chartZoneStartOfNextDayUnix } from './chart-timezone'

const MAX_FUTURE_BARS = 2000

/** Use observed bucket cadence when the stored timeframe label differs from its actual spacing. */
export function projectionIntervalSec(candles: readonly {time:number}[], timeframe:CandleTimeframe):number {
  const nominal = CANDLE_TIMEFRAMES[timeframe]
  const candidates = timeframe === '3m' ? [180,300] : [nominal]
  const counts = new Map<number,number>()
  for(let i=Math.max(1,candles.length-64);i<candles.length;i++) {
    const delta=candles[i]!.time-candles[i-1]!.time
    if(candidates.includes(delta)) counts.set(delta,(counts.get(delta)??0)+1)
  }
  return candidates.reduce((best,next)=>(counts.get(next)??0)>(counts.get(best)??0)?next:best,nominal)
}

/** Unix times for bar slots after last real bar through end of today in chart zone. */
export function futureBarTimesUntilChartZoneEod(
  candles: readonly LightweightCandle[],
  timeframe: CandleTimeframe,
  endExclusive = chartZoneStartOfNextDayUnix(),
): number[] {
  if (candles.length === 0) return []
  const interval = projectionIntervalSec(candles,timeframe)
  const last = candles[candles.length - 1]
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
  future = futureBarTimesUntilChartZoneEod(candles, timeframe),
): BarTimeSeries {
  return [...candles, ...future.map((time) => ({ time }))]
}
