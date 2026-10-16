import type { Time } from 'lightweight-charts'
import type { LightweightCandle } from '@/lib/ticks/candles'
import { BOLLINGER } from './price-chart-style'

export type ChartType = 'line' | 'area' | 'candlestick' | 'bar'

export type BandLevel = { upper: number; middle: number; lower: number }

export function bollinger(candles: readonly LightweightCandle[]) {
  const upper: { time: Time; value: number }[] = []
  const middle: { time: Time; value: number }[] = []
  const lower: { time: Time; value: number }[] = []
  const levels: (BandLevel | null)[] = Array.from({ length: candles.length }, () => null)
  for (let i = BOLLINGER.length - 1; i < candles.length; i++) {
    let sum = 0
    for (let j = i - BOLLINGER.length + 1; j <= i; j++) sum += candles[j].close
    const mean = sum / BOLLINGER.length
    let variance = 0
    for (let j = i - BOLLINGER.length + 1; j <= i; j++) {
      const delta = candles[j].close - mean
      variance += delta * delta
    }
    const deviation = Math.sqrt(variance / BOLLINGER.length)
    const time = candles[i].time as Time
    const level = {
      upper: mean + BOLLINGER.mult * deviation,
      middle: mean,
      lower: mean - BOLLINGER.mult * deviation,
    }
    levels[i] = level
    middle.push({ time, value: level.middle })
    upper.push({ time, value: level.upper })
    lower.push({ time, value: level.lower })
  }
  return { upper, middle, lower, levels }
}

export function outsideColor(close: number, level: BandLevel | null): string | null {
  if (!level) return null
  if (close > level.upper) return BOLLINGER.above
  if (close < level.lower) return BOLLINGER.below
  return null
}

/** Band-derived coloring applies to line charts only. */
export function pricePoint(
  bar: LightweightCandle,
  level: BandLevel | null,
  chartType: ChartType,
) {
  const time = bar.time as Time
  if (chartType === 'line') {
    const color = outsideColor(bar.close, level)
    return color ? { time, value: bar.close, color } : { time, value: bar.close }
  }
  if (chartType === 'area') {
    return { time, value: bar.close }
  }
  return {
    time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  }
}
