import type { LightweightCandle } from '@/lib/ticks/candles'
import { candleFeatures } from './candle-features'
import { defaultForceCandlesConfig } from './force-candles-config'

export type BaselineDojiEvent = {
  time: number
  srcOpen: number
  srcHigh: number
  srcLow: number
  srcClose: number
}

export function detectBaselineDoji(
  bars: readonly LightweightCandle[],
  lookback = defaultForceCandlesConfig().lookback,
): BaselineDojiEvent[] {
  const fs = bars.map(candleFeatures)
  const events: BaselineDojiEvent[] = []
  for (let i = lookback; i < bars.length; i++) {
    const feature = fs[i]!
    const bar = bars[i]!
    if (feature.invalidCandle) continue
    if (feature.direction !== 0) continue
    events.push({
      time: bar.time,
      srcOpen: bar.open,
      srcHigh: bar.high,
      srcLow: bar.low,
      srcClose: bar.close,
    })
  }
  return events
}