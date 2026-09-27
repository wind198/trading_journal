import type { LightweightCandle } from './candles'

const CONVERSION = 18
const BASE = 52
const SPAN_B = 104
const DISPLACEMENT = 52

export type LinePoint = { time: number; value: number }
export type CloudPoint = { time: number; a: number; b: number }

export type Ichimoku = {
  conversion: LinePoint[]
  base: LinePoint[]
  cloud: CloudPoint[]
}

function donchian(bars: readonly LightweightCandle[], index: number, length: number): number | null {
  if (index < length - 1) return null
  let high = -Infinity
  let low = Infinity
  for (let i = index - length + 1; i <= index; i++) {
    high = Math.max(high, bars[i].high)
    low = Math.min(low, bars[i].low)
  }
  return (high + low) / 2
}

function timeAt(bars: readonly LightweightCandle[], index: number, intervalSec: number): number {
  if (index < bars.length) return bars[index].time
  const last = bars.length - 1
  return bars[last].time + (index - last) * intervalSec
}

/** Doubled Ichimoku inputs: 18 / 52 / 104, displaced 52 bars. Cloud is span A and span B values only. */
export function ichimoku(bars: readonly LightweightCandle[], intervalSec: number): Ichimoku {
  const conversion: LinePoint[] = []
  const base: LinePoint[] = []
  const cloud: CloudPoint[] = []

  for (let i = 0; i < bars.length; i++) {
    const tenkan = donchian(bars, i, CONVERSION)
    const kijun = donchian(bars, i, BASE)
    const spanB = donchian(bars, i, SPAN_B)
    if (tenkan != null) conversion.push({ time: bars[i].time, value: tenkan })
    if (kijun != null) base.push({ time: bars[i].time, value: kijun })
    if (tenkan != null && kijun != null && spanB != null) {
      cloud.push({
        time: timeAt(bars, i + DISPLACEMENT, intervalSec),
        a: (tenkan + kijun) / 2,
        b: spanB,
      })
    }
  }

  return { conversion, base, cloud }
}
