import type { Time } from 'lightweight-charts'
import { ichimoku, type CloudPoint } from '@/lib/ticks/ichimoku'
import {
  CANDLE_TIMEFRAMES,
  type CandleTimeframe,
  type LightweightCandle,
} from '@/lib/ticks/candles'

export type IchimokuChartSeries = {
  conversion: { time: Time; value: number }[]
  base: { time: Time; value: number }[]
  cloud: CloudPoint[]
}

export function ichimokuForChart(
  candles: readonly LightweightCandle[],
  timeframe: CandleTimeframe,
): IchimokuChartSeries {
  const intervalSec = CANDLE_TIMEFRAMES[timeframe]
  const result = ichimoku(candles, intervalSec)
  return {
    conversion: result.conversion.map((p) => ({ time: p.time as Time, value: p.value })),
    base: result.base.map((p) => ({ time: p.time as Time, value: p.value })),
    cloud: result.cloud,
  }
}